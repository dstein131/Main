// services/orders.service.js

const pool = require('../pool/pool'); // Main DB pool

/**
 * Fetch all orders for a specific user.
 * @param {number} userId - The ID of the user.
 * @returns {Promise<Array>} - An array of orders with their items and addons.
 */
const getUserOrders = async (userId) => {
    const connection = await pool.getConnection();
    try {
        // Fetch orders for the user
        const [orders] = await connection.query(
            `SELECT 
                o.order_id, 
                o.order_status, 
                o.total_price, 
                o.created_at, 
                o.updated_at,
                o.stripe_payment_intent,
                p.payment_id,
                p.payment_method,
                p.payment_status,
                p.amount,
                p.payment_date
             FROM orders o
             LEFT JOIN payments p ON o.order_id = p.order_id
             WHERE o.user_id = ?
             ORDER BY o.created_at DESC`,
            [userId]
        );

        // For each order, fetch order items and their addons
        const ordersWithDetails = await Promise.all(
            orders.map(async (order) => {
                // Fetch order items
                const [orderItems] = await connection.query(
                    `SELECT 
                        oi.order_item_id,
                        oi.service_id,
                        s.title,
                        oi.quantity,
                        oi.price,
                        oi.total_price
                     FROM order_items oi
                     JOIN services s ON oi.service_id = s.service_id
                     WHERE oi.order_id = ?`,
                    [order.order_id]
                );

                // For each order item, fetch addons
                const itemsWithAddons = await Promise.all(
                    orderItems.map(async (item) => {
                        const [addons] = await connection.query(
                            `SELECT 
                                oa.order_addon_id,
                                oa.addon_id,
                                sa.name,
                                oa.price
                             FROM order_addons oa
                             JOIN service_addons sa ON oa.addon_id = sa.addon_id
                             WHERE oa.order_id = ? AND oa.addon_id IN (
                                 SELECT addon_id FROM order_addons WHERE order_id = ? AND addon_id = ?
                             )`,
                            [order.order_id, order.order_id, item.service_id]
                        );

                        return {
                            ...item,
                            addons: addons || [],
                        };
                    })
                );

                return {
                    ...order,
                    items: itemsWithAddons,
                };
            })
        );

        return ordersWithDetails;
    } catch (error) {
        console.error('Error fetching user orders:', error);
        throw error;
    } finally {
        connection.release();
    }
};

/**
 * Fetch a specific order by ID for a user.
 * @param {number} userId - The ID of the user.
 * @param {number} orderId - The ID of the order.
 * @returns {Promise<Object|null>} - The order details or null if not found.
 */
const getOrderById = async (userId, orderId) => {
    const connection = await pool.getConnection();
    try {
        // Fetch the specific order
        const [orders] = await connection.query(
            `SELECT 
                o.order_id, 
                o.order_status, 
                o.total_price, 
                o.created_at, 
                o.updated_at,
                o.stripe_payment_intent,
                p.payment_id,
                p.payment_method,
                p.payment_status,
                p.amount,
                p.payment_date
             FROM orders o
             LEFT JOIN payments p ON o.order_id = p.order_id
             WHERE o.user_id = ? AND o.order_id = ?`,
            [userId, orderId]
        );

        if (orders.length === 0) {
            return null;
        }

        const order = orders[0];

        // Fetch order items
        const [orderItems] = await connection.query(
            `SELECT 
                oi.order_item_id,
                oi.service_id,
                s.title,
                oi.quantity,
                oi.price,
                oi.total_price
             FROM order_items oi
             JOIN services s ON oi.service_id = s.service_id
             WHERE oi.order_id = ?`,
            [order.order_id]
        );

        // For each order item, fetch addons
        const itemsWithAddons = await Promise.all(
            orderItems.map(async (item) => {
                const [addons] = await connection.query(
                    `SELECT 
                        oa.order_addon_id,
                        oa.addon_id,
                        sa.name,
                        oa.price
                     FROM order_addons oa
                     JOIN service_addons sa ON oa.addon_id = sa.addon_id
                     WHERE oa.order_id = ? AND oa.addon_id IN (
                         SELECT addon_id FROM order_addons WHERE order_id = ? AND addon_id = ?
                     )`,
                    [order.order_id, order.order_id, item.service_id]
                );

                return {
                    ...item,
                    addons: addons || [],
                };
            })
        );

        return {
            ...order,
            items: itemsWithAddons,
        };
    } catch (error) {
        console.error('Error fetching order by ID:', error);
        throw error;
    } finally {
        connection.release();
    }
};

module.exports = {
    getUserOrders,
    getOrderById,
};
