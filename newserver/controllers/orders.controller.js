// controllers/orders.controller.js

const ordersService = require('../services/orders');

/**
 * Get all orders for the authenticated user.
 * GET /api/orders
 */
const getAllOrders = async (req, res) => {
    const userId = req.user.id; // Ensure authenticateJWT middleware attaches user to req

    try {
        const orders = await ordersService.getUserOrders(userId);
        res.status(200).json({ orders });
    } catch (error) {
        console.error('Error retrieving orders:', error);
        res.status(500).json({ message: 'Failed to retrieve orders.' });
    }
};

/**
 * Get a specific order by ID for the authenticated user.
 * GET /api/orders/:order_id
 */
const getOrderById = async (req, res) => {
    const userId = req.user.id; // Ensure authenticateJWT middleware attaches user to req
    const { order_id } = req.params;

    // Validate order_id
    if (isNaN(parseInt(order_id, 10))) {
        return res.status(400).json({ message: 'Invalid order ID.' });
    }

    try {
        const order = await ordersService.getOrderById(userId, order_id);
        if (!order) {
            return res.status(404).json({ message: 'Order not found.' });
        }
        res.status(200).json({ order });
    } catch (error) {
        console.error('Error retrieving order:', error);
        res.status(500).json({ message: 'Failed to retrieve order.' });
    }
};

/**
 * (Optional) Create a new order.
 * POST /api/orders
 * This endpoint can be used if you want users to create orders manually,
 * but in your current setup, orders are created automatically via Stripe webhooks.
 */
const createOrder = async (req, res) => {
    const userId = req.user.id;
    const { service_id, addons } = req.body;

    // Validate input
    if (!service_id) {
        return res.status(400).json({ message: 'Service ID is required.' });
    }

    try {
        // Logic to create a new order can be implemented here
        // However, if orders are created via Stripe webhooks, this might not be necessary
        res.status(501).json({ message: 'Not implemented.' });
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ message: 'Failed to create order.' });
    }
};

module.exports = {
    getAllOrders,
    getOrderById,
    createOrder, // Optional
};
