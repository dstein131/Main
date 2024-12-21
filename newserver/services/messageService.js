const twilio = require('twilio');
const pool = require('../pool/pool'); // Database pool

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioNumber = process.env.TWILIO_WHATSAPP_NUMBER;

const client = twilio(accountSid, authToken);

/**
 * Send a WhatsApp message via Twilio
 * @param {number} userId - The ID of the user sending the message
 * @param {string} message - The message content
 * @returns {string} - Confirmation of the sent message
 */
exports.sendMessage = async (userId, message) => {
    try {
        // Fetch user's phone number from the database
        const [user] = await pool.query('SELECT phone_number FROM users WHERE user_id = ?', [userId]);
        if (!user.length || !user[0].phone_number) {
            throw new Error('User not found or phone number not provided.');
        }

        const toNumber = user[0].phone_number;

        // Send the message via Twilio
        const response = await client.messages.create({
            from: twilioNumber,
            to: `whatsapp:${toNumber}`,
            body: message,
        });

        // Log the message to conversation history in the database
        await pool.query(
            'INSERT INTO bot_conversations (user_id, user_message, bot_response) VALUES (?, ?, ?)',
            [userId, message, 'Message sent via Twilio']
        );

        return `Message successfully sent to ${toNumber}`;
    } catch (err) {
        console.error('Error sending message via Twilio:', err);
        throw new Error('Failed to send message.');
    }
};

/**
 * Get conversation history for a user
 * @param {number} userId - The ID of the user
 * @returns {Array} - List of conversation history
 */
exports.getConversationHistory = async (userId) => {
    try {
        const [history] = await pool.query(
            'SELECT user_message, bot_response, created_at FROM bot_conversations WHERE user_id = ? ORDER BY created_at ASC',
            [userId]
        );
        return history;
    } catch (err) {
        console.error('Error fetching conversation history:', err);
        throw new Error('Failed to fetch conversation history.');
    }
};

/**
 * Clear conversation history for a user
 * @param {number} userId - The ID of the user
 * @returns {void}
 */
exports.clearConversationHistory = async (userId) => {
    try {
        await pool.query('DELETE FROM bot_conversations WHERE user_id = ?', [userId]);
    } catch (err) {
        console.error('Error clearing conversation history:', err);
        throw new Error('Failed to clear conversation history.');
    }
};
