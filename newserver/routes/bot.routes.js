const express = require('express');
const router = express.Router();
const botController = require('../controllers/bot.controller'); // Import bot controller
const { authenticateJWT } = require('../middleware/auth.middleware'); // Import JWT middleware

// ---------------------
// Routes for Bot
// ---------------------

// Send a message to the bot (supports unauthenticated users)
router.post('/send', botController.sendMessage); // Removed authenticateJWT to allow unauthenticated access

// Retrieve conversation history (authenticated users only)
router.get('/history', authenticateJWT, botController.getConversationHistory);

// Clear conversation history (authenticated users only)
router.delete('/history', authenticateJWT, botController.clearConversationHistory);

// Add integration with Teams (authenticated users only)
router.post('/teams/integrate', authenticateJWT, botController.integrateWithTeams);

module.exports = router;
