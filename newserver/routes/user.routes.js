const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');

// User Registration Route (No authentication required)
router.post('/register', userController.register);

// User Login Route (No authentication required, but manages session)
router.post('/login', userController.login);

// Get User Data Route (Session-based authentication required)
router.get('/me', userController.authenticateSession, userController.getUserData);

// User Logout Route
router.post('/logout', userController.logout);

module.exports = router;
