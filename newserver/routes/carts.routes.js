// routes/carts.routes.js

const express = require('express');
const router = express.Router();
const cartsController = require('../controllers/carts.controller');
const { authenticateJWT } = require('../middleware/auth.middleware'); // Import JWT middleware

// ---------------------
// Routes for Carts
// ---------------------

// Get the current user's cart with items and addons
router.get('/', authenticateJWT, cartsController.getUserCart);

// Add an item (and optional addons) to the current user's cart
router.post('/items', authenticateJWT, cartsController.addItemToCart);

// Update cart item quantity
router.put('/items/:cart_item_id', authenticateJWT, cartsController.updateCartItemQuantity);

// Remove a specific item from the cart
router.delete('/items/:cart_item_id', authenticateJWT, cartsController.removeCartItem);

// Clear the entire cart (remove all items)
router.delete('/clear', authenticateJWT, cartsController.clearCart);

module.exports = router;
