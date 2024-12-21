// bot.controller.js

const messageService = require('../services/messageService');

/**
 * Send Message
 * Supports both authenticated (via userId) and unauthenticated users (via phoneNumber).
 */
exports.sendMessage = async (req, res) => {
    const userId = req.user ? req.user.id : null; // Optional if logged in
    const { message, phoneNumber } = req.body; // phoneNumber for unauthenticated users

    if (!message) {
        return res.status(400).json({ message: 'Message content is required.' });
    }

    if (!userId && !phoneNumber) {
        return res.status(400).json({ message: 'User ID or phone number is required.' });
    }

    try {
        const botResponse = await messageService.sendMessageToBot({ userId, message, phoneNumber });
        res.status(200).json({ botResponse });
    } catch (err) {
        console.error('Error sending message:', err);
        res.status(500).json({ message: 'Error sending message to bot', error: err.message });
    }
};

/**
 * Get Conversation History
 * Fetches conversation history for authenticated users only.
 */
exports.getConversationHistory = async (req, res) => {
    const userId = req.user ? req.user.id : null;

    if (!userId) {
        return res.status(401).json({ message: 'Authentication required to view conversation history.' });
    }

    try {
        const history = await messageService.getConversationHistory(userId);
        res.status(200).json({ history });
    } catch (err) {
        console.error('Error fetching conversation history:', err);
        res.status(500).json({ message: 'Error fetching conversation history', error: err.message });
    }
};

/**
 * Clear Conversation History
 * Clears conversation history for authenticated users only.
 */
exports.clearConversationHistory = async (req, res) => {
    const userId = req.user ? req.user.id : null;

    if (!userId) {
        return res.status(401).json({ message: 'Authentication required to clear conversation history.' });
    }

    try {
        await messageService.clearConversationHistory(userId);
        res.status(200).json({ message: 'Conversation history cleared successfully.' });
    } catch (err) {
        console.error('Error clearing conversation history:', err);
        res.status(500).json({ message: 'Error clearing conversation history', error: err.message });
    }
};
