// services/cartService.js

const pool = require('../pool/pool'); // Main DB pool

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
