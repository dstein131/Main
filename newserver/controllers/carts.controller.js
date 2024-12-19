// controllers/carts.controller.js

const pool = require('../pool/pool'); // main DB pool
const { ensureUserCart, clearUserCart } = require('../services/cartService'); // Import the cart service

/**
 * Get User Cart
 * Fetches the current user's cart, including items and addons.
 */
exports.getUserCart = async (req, res) => {
    const userId = req.user.id;

    try {
        const cartId = await ensureUserCart(userId);

        // Fetch cart items
        const [items] = await pool.query(
            `SELECT ci.cart_item_id, ci.service_id, s.title, ci.quantity, ci.price
             FROM cart_items ci
             JOIN services s ON ci.service_id = s.service_id
             WHERE ci.cart_id = ?
             ORDER BY ci.created_at ASC`, 
             [cartId]
        );

        // Fetch addons for these items
        const cartItemIds = items.map(i => i.cart_item_id);
        let addons = [];
        if (cartItemIds.length > 0) {
            const [addonsRows] = await pool.query(
                `SELECT cia.cart_item_addon_id, cia.cart_item_id, cia.addon_id, sa.name, cia.price
                 FROM cart_item_addons cia
                 JOIN service_addons sa ON cia.addon_id = sa.addon_id
                 WHERE cia.cart_item_id IN (?) 
                 ORDER BY cia.created_at ASC`, 
                 [cartItemIds]
            );
            addons = addonsRows;
        }

        // Combine addons with their respective cart items
        const itemsWithAddons = items.map(item => ({
            ...item,
            addons: addons.filter(a => a.cart_item_id === item.cart_item_id).map(addon => ({
                addon_id: addon.addon_id,
                name: addon.name,
                price: addon.price,
            }))
        }));

        res.status(200).json({ cart_id: cartId, items: itemsWithAddons });
    } catch (err) {
        console.error('Error fetching user cart:', err);
        res.status(500).json({ message: 'Error fetching cart', error: err.message });
    }
};

/**
 * Add Item to Cart
 * Body: { service_id, quantity, addons: [{ addon_id, price }] }
 * If quantity is not provided, default to 1.
 */
exports.addItemToCart = async (req, res) => {
    const userId = req.user.id;
    const { service_id, quantity = 1, addons = [] } = req.body;

    if (!service_id) {
        return res.status(400).json({ message: 'Service ID is required.' });
    }

    try {
        const cartId = await ensureUserCart(userId);

        // Fetch service to get price
        const [services] = await pool.query('SELECT service_id, price FROM services WHERE service_id = ?', [service_id]);
        if (services.length === 0) {
            return res.status(404).json({ message: 'Service not found.' });
        }
        const service = services[0];
        if (service.price === null) {
            return res.status(400).json({ message: 'Cannot add a service with no price to the cart.' });
        }

        // Insert cart item
        const itemPrice = parseFloat(service.price);
        const [itemResult] = await pool.query(
            'INSERT INTO cart_items (cart_id, service_id, quantity, price) VALUES (?, ?, ?, ?)',
            [cartId, service_id, quantity, itemPrice]
        );

        const cartItemId = itemResult.insertId;

        // Insert addons if provided
        for (const addon of addons) {
            const { addon_id, price } = addon;
            if (!addon_id || price === undefined) {
                return res.status(400).json({ message: 'Addon id and price are required for each addon.' });
            }
            await pool.query(
                'INSERT INTO cart_item_addons (cart_item_id, addon_id, price) VALUES (?, ?, ?)',
                [cartItemId, addon_id, price]
            );
        }

        res.status(201).json({ message: 'Item added to cart successfully', cart_item_id: cartItemId });
    } catch (err) {
        console.error('Error adding item to cart:', err);
        res.status(500).json({ message: 'Error adding item to cart', error: err.message });
    }
};

/**
 * Update Cart Item Quantity
 * Body: { quantity }
 * Updates the quantity of a given cart_item_id.
 */
exports.updateCartItemQuantity = async (req, res) => {
    const userId = req.user.id;
    const { cart_item_id } = req.params;
    const { quantity } = req.body;

    if (quantity === undefined || quantity < 1) {
        return res.status(400).json({ message: 'Quantity must be at least 1.' });
    }

    try {
        // Verify that the cart item belongs to the user
        const [items] = await pool.query(
            `SELECT ci.cart_id 
             FROM cart_items ci
             JOIN carts c ON ci.cart_id = c.cart_id
             WHERE ci.cart_item_id = ? AND c.user_id = ?`,
            [cart_item_id, userId]
        );

        if (items.length === 0) {
            return res.status(404).json({ message: 'Cart item not found or does not belong to you.' });
        }

        await pool.query(
            'UPDATE cart_items SET quantity = ?, updated_at = NOW() WHERE cart_item_id = ?',
            [quantity, cart_item_id]
        );

        res.status(200).json({ message: 'Cart item quantity updated successfully.' });
    } catch (err) {
        console.error('Error updating cart item quantity:', err);
        res.status(500).json({ message: 'Error updating cart item quantity', error: err.message });
    }
};

/**
 * Remove Cart Item
 * Deletes a specific cart item from the user's cart.
 */
exports.removeCartItem = async (req, res) => {
    const userId = req.user.id;
    const { cart_item_id } = req.params;

    try {
        // Verify that the cart item belongs to the user
        const [items] = await pool.query(
            `SELECT ci.cart_id
             FROM cart_items ci
             JOIN carts c ON ci.cart_id = c.cart_id
             WHERE ci.cart_item_id = ? AND c.user_id = ?`,
            [cart_item_id, userId]
        );

        if (items.length === 0) {
            return res.status(404).json({ message: 'Cart item not found or does not belong to you.' });
        }

        await pool.query('DELETE FROM cart_items WHERE cart_item_id = ?', [cart_item_id]);

        res.status(200).json({ message: 'Cart item removed successfully.' });
    } catch (err) {
        console.error('Error removing cart item:', err);
        res.status(500).json({ message: 'Error removing cart item', error: err.message });
    }
};

/**
 * Clear the Cart
 * Removes all items from the current user's cart.
 */
exports.clearCart = async (req, res) => {
    const userId = req.user.id;

    try {
        await clearUserCart(userId);
        res.status(200).json({ message: 'Cart cleared successfully.' });
    } catch (err) {
        console.error('Error clearing cart:', err);
        res.status(500).json({ message: 'Error clearing cart', error: err.message });
    }
};
