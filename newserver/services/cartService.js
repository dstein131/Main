// services/cartService.js

const pool = require('../pool/pool'); // Main DB pool

/**
 * Ensures that the user has an active cart.
 * If the user doesn't have a cart, creates one.
 * @param {number} userId - The ID of the user.
 * @returns {Promise<number>} - The cart_id of the user's cart.
 */
const ensureUserCart = async (userId) => {
    console.log(`Ensuring cart exists for user ID: ${userId}`);

    // Check if the user already has a cart
    const [carts] = await pool.query('SELECT cart_id FROM carts WHERE user_id = ?', [userId]);
    if (carts.length > 0) {
        console.log(`User ID: ${userId} already has cart ID: ${carts[0].cart_id}`);
        return carts[0].cart_id;
    }

    // If no cart exists, create one
    const [result] = await pool.query('INSERT INTO carts (user_id) VALUES (?)', [userId]);
    const newCartId = result.insertId;
    console.log(`Created new cart with ID: ${newCartId} for user ID: ${userId}`);
    return newCartId;
};

/**
 * Clears the user's cart by deleting all cart items.
 * Associated addons will be deleted automatically due to ON DELETE CASCADE.
 * @param {number} userId - The ID of the user.
 * @returns {Promise<void>}
 */
const clearUserCart = async (userId) => {
    console.log(`Attempting to clear cart for user ID: ${userId}`);

    try {
        // Fetch the cart ID for the user
        const [carts] = await pool.query('SELECT cart_id FROM carts WHERE user_id = ?', [userId]);
        if (carts.length === 0) {
            console.log(`No cart found for user ID: ${userId}. Nothing to clear.`);
            return;
        }

        const cartId = carts[0].cart_id;
        console.log(`Found cart ID: ${cartId} for user ID: ${userId}. Proceeding to clear cart.`);

        // Delete all cart items; ON DELETE CASCADE will handle associated addons
        const [deletedCartItems] = await pool.query('DELETE FROM cart_items WHERE cart_id = ?', [cartId]);
        console.log(`Deleted ${deletedCartItems.affectedRows} cart_items for cart ID: ${cartId}.`);
    } catch (err) {
        console.error('Error clearing user cart:', err);
        throw err;
    }
};


module.exports = {
    ensureUserCart,
    clearUserCart,
};
