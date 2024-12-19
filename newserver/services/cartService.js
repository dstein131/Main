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
    
    const [carts] = await pool.query('SELECT cart_id FROM carts WHERE user_id = ?', [userId]);
    if (carts.length === 0) {
        console.log(`No cart found for user ID: ${userId}. Nothing to clear.`);
        return;
    }
    
    const cartId = carts[0].cart_id;
    console.log(`Found cart ID: ${cartId} for user ID: ${userId}. Proceeding to clear cart.`);
    
    // Start a transaction to ensure data integrity
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        console.log(`Transaction started for clearing cart ID: ${cartId}`);
        
        // Delete all cart items; ON DELETE CASCADE will handle cart_item_addons
        const [deletedCartItems] = await connection.query('DELETE FROM cart_items WHERE cart_id = ?', [cartId]);
        console.log(`Deleted ${deletedCartItems.affectedRows} cart_items for cart ID: ${cartId}`);
        
        await connection.commit();
        console.log(`Transaction committed for clearing cart ID: ${cartId}`);
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
