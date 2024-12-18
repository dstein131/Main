// routes/monday.routes.js

const express = require('express');
const router = express.Router();
const mondayController = require('../controllers/monday.controller');
const { authenticateJWT } = require('../middleware/auth.middleware');

// Create a new item on Monday.com
router.post('/monday', authenticateJWT, mondayController.createItem);

// Get all items from Monday.com
router.get('/monday', authenticateJWT, mondayController.getItems);

// Get a single item by ID from Monday.com
router.get('/monday/:id', authenticateJWT, mondayController.getItemById);

// Update an existing item on Monday.com
router.put('/monday/:id', authenticateJWT, mondayController.updateItem);

// Delete an item from Monday.com
router.delete('/monday/:id', authenticateJWT, mondayController.deleteItem);

module.exports = router;
