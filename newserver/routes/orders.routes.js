// routes/orders.routes.js

const express = require('express');
const router = express.Router();
const ordersController = require('../controllers/orders.controller');
const { authenticateJWT } = require('../middleware/auth.middleware');

/**
 * @route   GET /api/orders
 * @desc    Get all orders for the authenticated user
 * @access  Private
 */
router.get('/', authenticateJWT, ordersController.getAllOrders);

/**
 * @route   GET /api/orders/:order_id
 * @desc    Get a specific order by ID for the authenticated user
 * @access  Private
 */
router.get('/:order_id', authenticateJWT, ordersController.getOrderById);

/**
 * @route   POST /api/orders
 * @desc    Create a new order (Optional)
 * @access  Private
 */
router.post('/', authenticateJWT, ordersController.createOrder); // Optional

module.exports = router;
