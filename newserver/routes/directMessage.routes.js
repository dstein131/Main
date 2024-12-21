const express = require('express');
const router = express.Router();
const directMessageController = require('../controllers/directMessage.controller');
const { authenticateJWT } = require('../middleware/auth.middleware');

// Route for unauthenticated users to send a message
router.post('/send', directMessageController.sendMessage);

// Route to retrieve message history (authenticated users only)
router.get('/history', authenticateJWT, directMessageController.getMessageHistory);

// Route to clear message history (authenticated users only)
router.delete('/history', authenticateJWT, directMessageController.clearMessageHistory);

module.exports = router;
