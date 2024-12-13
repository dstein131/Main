const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { authenticateJWT } = require('../middleware/auth.middleware');

// User Registration Route (No authentication required)
router.post('/register', userController.register);

// User Login Route (No authentication required)
router.post('/login', userController.login);

// Get User Data Route (Protected, authentication required)
router.get('/me', authenticateJWT, userController.getUserData);

module.exports = router;
