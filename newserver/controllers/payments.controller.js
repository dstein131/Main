// controllers/payments.controller.js

const stripe = require('../config/stripe');
const pool = require('../pool/pool'); // Main DB pool
const { clearUserCart } = require('../services/cartService'); // Import the cart service

/**
 * Create a Payment Intent
 * POST /api/payments/create-intent
 */
const createPaymentIntent = async (req, res) => {
    const userId = req.user.id; // Ensure authenticateJWT middleware attaches user to req
    const { items, currency = 'usd' } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: 'No items provided for payment.' });
    }

    try {
        // Calculate total amount
        let totalAmount = 0;
        for (const item of items) {
            const { service_id, quantity = 1, addons = [] } = item;

            // Fetch service price
            const [services] = await pool.query('SELECT price FROM services WHERE service_id = ?', [service_id]);
            if (services.length === 0) {
                return res.status(404).json({ message: `Service with ID ${service_id} not found.` });
            }
            const servicePrice = parseFloat(services[0].price);
            totalAmount += servicePrice * quantity;

            // Add addons price
            if (addons && Array.isArray(addons)) {
                for (const addon of addons) {
                    const { addon_id, quantity: addonQty = 1 } = addon;

                    const [addonsData] = await pool.query('SELECT price FROM service_addons WHERE addon_id = ?', [addon_id]);
                    if (addonsData.length === 0) {
                        return res.status(404).json({ message: `Addon with ID ${addon_id} not found.` });
                    }
                    const addonPrice = parseFloat(addonsData[0].price);
                    totalAmount += addonPrice * addonQty;
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
const handleWebhook = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        // Verify raw body
        console.log('Raw request body:', req.body.toString()); // Debug log
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Process event types
    switch (event.type) {
        case 'payment_intent.succeeded':
            console.log('PaymentIntent succeeded:', event.data.object);
            break;
        case 'payment_intent.payment_failed':
            console.error('Payment failed:', event.data.object);
            break;
        default:
            console.warn(`Unhandled event type: ${event.type}`);
    }

    res.status(200).json({ received: true });
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
        await pool.query('START TRANSACTION');

        console.log('Creating order...');
        const [orderResult] = await pool.query(
            `INSERT INTO orders 
                (user_id, stripe_payment_intent, order_status, total_amount, currency) 
             VALUES (?, ?, ?, ?, ?)`,
            [userId, paymentIntentId, 'completed', amount / 100, currency]
        );
        const orderId = orderResult.insertId;
        console.log('Order created with ID:', orderId);

        // Fetch user's cart
        const [carts] = await pool.query('SELECT cart_id FROM carts WHERE user_id = ?', [userId]);
        if (carts.length === 0) {
            throw new Error(`No cart found for user ID: ${userId}`);
        }
        const cartId = carts[0].cart_id;

        // Fetch cart items
        const [cartItems] = await pool.query(
            `SELECT ci.cart_item_id, ci.service_id, ci.quantity, ci.price 
             FROM cart_items ci 
             WHERE ci.cart_id = ?`,
            [cartId]
        );

        if (cartItems.length === 0) {
            throw new Error('No items found in the user’s cart.');
        }

        // Insert items into `order_items` and handle addons
        for (const item of cartItems) {
            const { service_id, quantity, price, cart_item_id } = item;
            const totalPrice = parseFloat(price) * parseInt(quantity, 10);

            await pool.query(
                `INSERT INTO order_items 
                    (order_id, service_id, quantity, price, total_price) 
                 VALUES (?, ?, ?, ?, ?)`,
                [orderId, service_id, quantity, price, totalPrice]
            );

            // Fetch and insert addons for each item
            const [addons] = await pool.query(
                `SELECT addon_id, price 
                 FROM cart_item_addons 
                 WHERE cart_item_id = ?`,
                [cart_item_id]
            );

            for (const addon of addons) {
                await pool.query(
                    `INSERT INTO order_addons 
                        (order_id, addon_id, price) 
                     VALUES (?, ?, ?)`,
                    [orderId, addon.addon_id, addon.price]
                );
            }
        }

        // Insert payment record
        await pool.query(
            `INSERT INTO payments 
                (order_id, payment_method, payment_status, amount, payment_date) 
             VALUES (?, ?, ?, ?, ?)`,
            [orderId, 'credit_card', 'completed', amount / 100, new Date()]
        );

        // Commit the transaction
        await pool.query('COMMIT');
        console.log(`Order ${orderId} committed successfully.`);

        // Clear user's cart
        await clearUserCart(userId);
        console.log(`Cart cleared for user ID: ${userId}`);
    } catch (err) {
        await pool.query('ROLLBACK');
        console.error('Transaction rolled back due to error:', err);
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

module.exports = {
    createPaymentIntent,
    handleWebhook,

};
