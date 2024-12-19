// services/cartService.js

const pool = require('../pool/pool'); // Main DB pool

/**
 * Ensures that the user has a cart. If not, creates one.
 * @param {number} userId - The ID of the user.
 * @returns {Promise<number>} - The cart_id of the user's cart.
 */
const ensureUserCart = async (userId) => {
    const [carts] = await pool.query('SELECT cart_id FROM carts WHERE user_id = ?', [userId]);
    if (carts.length > 0) {
        return carts[0].cart_id;
    }

    // Create a new cart for the user
    const [result] = await pool.query('INSERT INTO carts (user_id) VALUES (?)', [userId]);
    return result.insertId;
};

/**
 * Clears the user's cart by deleting all cart items and associated addons.
 * @param {number} userId - The ID of the user.
 * @returns {Promise<void>}
 */
const clearUserCart = async (userId) => {
    const [carts] = await pool.query('SELECT cart_id FROM carts WHERE user_id = ?', [userId]);
    if (carts.length === 0) {
        // No cart to clear
        return;
    }
    const cartId = carts[0].cart_id;

    // Start a transaction to ensure data integrity
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // Delete all cart item addons
        await connection.query(
            `DELETE cia 
             FROM cart_item_addons cia
             JOIN cart_items ci ON cia.cart_item_id = ci.cart_item_id
             WHERE ci.cart_id = ?`,
            [cartId]
        );

        // Delete all cart items
        await connection.query('DELETE FROM cart_items WHERE cart_id = ?', [cartId]);

        await connection.commit();
    } catch (err) {
        await connection.rollback();
        console.error('Error clearing user cart:', err);
        throw err;
    } finally {
        connection.release();
    }
};

module.exports = {
    ensureUserCart,
    clearUserCart,
};
