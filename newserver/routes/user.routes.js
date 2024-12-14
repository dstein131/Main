const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { authenticateJWT } = require('../middleware/auth.middleware');

// User Registration Route
router.post('/register', userController.register);

// User Login Route
router.post('/login', userController.login);

// Get User Data Route (Protected)
router.get('/me', authenticateJWT, userController.getUserData);

// User Logout Route
router.post('/logout', userController.logout);

module.exports = router;
