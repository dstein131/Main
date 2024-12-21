const twilio = require('twilio');
const pool = require('../pool/pool'); // Database pool

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioNumber = process.env.TWILIO_WHATSAPP_NUMBER;

const client = twilio(accountSid, authToken);

/**
 * Send a direct message via Twilio WhatsApp
 * @param {string} phoneNumber - The recipient's phone number (for unauthenticated users)
 * @param {string} message - The message content
 * @returns {Promise<string>} - Confirmation message
 */
exports.sendMessageDirect = async (phoneNumber, message) => {
    try {
        if (!phoneNumber || !message) {
            throw new Error('Phone number and message content are required.');
        }

        // Send the message via Twilio
        const response = await client.messages.create({
            from: twilioNumber,
            to: `whatsapp:${phoneNumber}`,
            body: message,
        });

        return `Message successfully sent to ${phoneNumber}`;
    } catch (err) {
        console.error('Error sending message via Twilio:', err);
        throw new Error('Failed to send message.');
    }
};

/**
 * Log a message in the database
 * @param {string} sender - Identifier for the sender (userId or phoneNumber)
 * @param {string} message - The message content
 * @returns {Promise<void>}
 */
exports.logMessage = async (sender, message) => {
    try {
        await pool.query(
            'INSERT INTO direct_messages (sender, message_content) VALUES (?, ?)',
            [sender, message]
        );
    } catch (err) {
        console.error('Error logging message to database:', err);
        throw new Error('Failed to log message.');
    }
};
