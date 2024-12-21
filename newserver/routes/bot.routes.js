const express = require('express');
const router = express.Router();
const botController = require('../controllers/bot.controller'); // Import bot controller
const { authenticateJWT } = require('../middleware/auth.middleware'); // Import JWT middleware

// Debugging
console.log('botController:', botController);

// Routes for Bot
router.post('/send', botController.sendMessage); // Allow unauthenticated access
router.get('/history', authenticateJWT, botController.getConversationHistory); // Authenticated
router.delete('/history', authenticateJWT, botController.clearConversationHistory); // Authenticated
router.post('/teams/integrate', authenticateJWT, botController.integrateWithTeams); // Authenticated

module.exports = router;
