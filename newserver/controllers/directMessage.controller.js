const messageService = require('../services/messageService');
const pool = require('../pool/pool');

/**
 * Handle sending a message (direct to you via WhatsApp)
 */
exports.sendMessage = async (req, res) => {
    const { phoneNumber, message } = req.body; // For unauthenticated users

    if (!phoneNumber || !message) {
        return res.status(400).json({ message: 'Phone number and message content are required.' });
    }

    try {
        // Log the message in the database
        await messageService.logMessage(phoneNumber, message);

        // Send the message to your WhatsApp via Twilio
        const confirmation = await messageService.sendMessageDirect(phoneNumber, message);

        res.status(200).json({ message: confirmation });
    } catch (err) {
        console.error('Error processing direct message:', err);
        res.status(500).json({ message: 'Failed to process message.', error: err.message });
    }
};

/**
 * Get message history (authenticated users only)
 */
exports.getMessageHistory = async (req, res) => {
    try {
        const [history] = await pool.query('SELECT * FROM direct_messages ORDER BY created_at DESC');
        res.status(200).json({ history });
    } catch (err) {
        console.error('Error fetching message history:', err);
        res.status(500).json({ message: 'Failed to fetch message history.' });
    }
};

/**
 * Clear message history (authenticated users only)
 */
exports.clearMessageHistory = async (req, res) => {
    try {
        await pool.query('DELETE FROM direct_messages');
        res.status(200).json({ message: 'Message history cleared successfully.' });
    } catch (err) {
        console.error('Error clearing message history:', err);
        res.status(500).json({ message: 'Failed to clear message history.' });
    }
};
