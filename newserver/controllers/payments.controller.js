// controllers/payments.controller.js

const stripe = require('../config/stripe');
const pool = require('../pool/pool'); // Main DB pool
const { clearUserCart } = require('../services/cartService'); // Import the cart service

/**
 * Create a Payment Intent
 * POST /api/payments/create-intent
 */
exports.createPaymentIntent = async (req, res) => {
    const userId = req.user.id; // Ensure authenticateJWT middleware attaches user to req
    const { items, currency = 'usd' } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: 'No items provided for payment.' });
    }

    try {
        // Calculate total amount
        let totalAmount = 0;
        for (const item of items) {
            const { service_id, quantity, addons } = item;

            // Fetch service price
            const [services] = await pool.query('SELECT price FROM services WHERE service_id = ?', [service_id]);
            if (services.length === 0) {
                return res.status(404).json({ message: `Service with ID ${service_id} not found.` });
            }
            const servicePrice = parseFloat(services[0].price);
            totalAmount += servicePrice * (quantity || 1);

            // Add addons price
            if (addons && Array.isArray(addons)) {
                for (const addon of addons) {
                    const { addon_id, quantity: addonQty } = addon;

                    const [addonsData] = await pool.query('SELECT price FROM service_addons WHERE addon_id = ?', [addon_id]);
                    if (addonsData.length === 0) {
                        return res.status(404).json({ message: `Addon with ID ${addon_id} not found.` });
                    }
                    const addonPrice = parseFloat(addonsData[0].price);
                    totalAmount += addonPrice * (addonQty || 1);
                }
            }
        }

        // Convert amount to cents as Stripe expects the amount in the smallest currency unit
        const amountInCents = Math.round(totalAmount * 100);

        // Create Payment Intent with Stripe
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amountInCents,
            currency: currency.toLowerCase(),
            metadata: { integration_check: 'accept_a_payment', user_id: userId.toString() },
        });

        res.status(200).json({
            clientSecret: paymentIntent.client_secret,
            amount: totalAmount,
            currency: currency.toLowerCase(),
        });
    } catch (err) {
        console.error('Error creating payment intent:', err);
        res.status(500).json({ message: 'Internal server error', error: err.message });
    }
};

/**
 * Handle Stripe Webhooks
 * POST /api/payments/webhook
 */
exports.handleWebhook = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
        case 'payment_intent.succeeded':
            const paymentIntent = event.data.object;
            await handlePaymentIntentSucceeded(paymentIntent);
            break;
        case 'payment_intent.payment_failed':
            const failedPaymentIntent = event.data.object;
            await handlePaymentIntentFailed(failedPaymentIntent);
            break;
        // ... handle other event types as needed
        default:
            console.warn(`Unhandled event type ${event.type}`);
    }

    // Return a response to acknowledge receipt of the event
    res.json({ received: true });
};

/**
 * Helper function to handle successful payments
 * Inserts order, order items, order addons, and payment records into the database.
 */
const handlePaymentIntentSucceeded = async (paymentIntent) => {
    const { id: paymentIntentId, metadata, amount, currency } = paymentIntent;
    const userId = parseInt(metadata.user_id, 10);

    try {
        // Start a transaction
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // Create an order
            const [orderResult] = await connection.query(
                'INSERT INTO orders (user_id, stripe_payment_intent, order_status, total_amount, currency) VALUES (?, ?, ?, ?, ?)',
                [userId, paymentIntentId, 'completed', amount / 100, currency]
            );
            const orderId = orderResult.insertId;

            // Fetch cart associated with the user
            const [carts] = await connection.query('SELECT cart_id FROM carts WHERE user_id = ?', [userId]);
            if (carts.length === 0) {
                throw new Error('No cart found for the user.');
            }
            const cartId = carts[0].cart_id;

            // Fetch cart items
            const [cartItems] = await connection.query(
                `SELECT ci.cart_item_id, ci.service_id, s.title, ci.quantity, ci.price
                 FROM cart_items ci
                 JOIN services s ON ci.service_id = s.service_id
                 WHERE ci.cart_id = ?`,
                [cartId]
            );

            // Insert order items
            for (const item of cartItems) {
                const { service_id, quantity, price, cart_item_id } = item;
                const totalPrice = parseFloat(price) * parseInt(quantity, 10);

                await connection.query(
                    'INSERT INTO order_items (order_id, service_id, quantity, price, total_price) VALUES (?, ?, ?, ?, ?)',
                    [orderId, service_id, quantity, price, totalPrice]
                );

                // Fetch addons for each cart item
                const [addons] = await connection.query(
                    `SELECT addon_id, price
                     FROM cart_item_addons
                     WHERE cart_item_id = ?`,
                    [cart_item_id]
                );

                // Insert order addons
                for (const addon of addons) {
                    const { addon_id, price: addonPrice } = addon;
                    await connection.query(
                        'INSERT INTO order_addons (order_id, addon_id, price) VALUES (?, ?, ?)',
                        [orderId, addon_id, addonPrice]
                    );
                }
            }

            // Insert payment record
            await connection.query(
                'INSERT INTO payments (order_id, payment_method, payment_status, amount, payment_date) VALUES (?, ?, ?, ?, ?)',
                [orderId, 'credit_card', 'completed', amount / 100, new Date()]
            );

            // Commit the transaction
            await connection.commit();
            connection.release();

            // Clear the user's cart after committing the transaction
            await clearUserCart(userId);
        } catch (err) {
            await connection.rollback();
            connection.release();
            console.error('Error processing payment intent succeeded:', err);
        }
    } catch (err) {
        console.error('Database connection error:', err);
    }
};

/**
 * Helper function to handle failed payments
 * Updates the order status to 'failed' and logs the error.
 */
const handlePaymentIntentFailed = async (paymentIntent) => {
    const { id: paymentIntentId, metadata, amount, currency, last_payment_error } = paymentIntent;
    const userId = parseInt(metadata.user_id, 10);

    try {
        // Update the order status to 'failed' if it exists
        const [updateResult] = await pool.query(
            'UPDATE orders SET order_status = ?, updated_at = NOW() WHERE stripe_payment_intent = ?',
            ['failed', paymentIntentId]
        );

        if (updateResult.affectedRows === 0) {
            console.warn(`No order found for payment intent ID ${paymentIntentId}`);
        }

        // Optionally, log the error or notify the user
        console.error(`Payment failed for user ID ${userId}:`, last_payment_error);
    } catch (err) {
        console.error('Error updating order status for failed payment:', err);
    }
};
