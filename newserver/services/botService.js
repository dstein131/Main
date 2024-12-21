const axios = require('axios'); // For making HTTP requests
const pool = require('../pool/pool'); // For database interactions
const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioNumber = process.env.TWILIO_WHATSAPP_NUMBER;

const client = twilio(accountSid, authToken);

/**
 * Send a message to the bot and get a response.
 * If userId is not provided, use a phone number.
 * @param {object} params - Contains userId, message, and optional phoneNumber.
 * @returns {Promise<string>} - The bot's response.
 */
exports.sendMessageToBot = async ({ userId, message, phoneNumber }) => {
    try {
        if (!message) {
            throw new Error('Message content is required.');
        }

        // Determine the recipient
        let toNumber;
        if (userId) {
            // Fetch user's phone number from the database
            const [user] = await pool.query('SELECT phone_number FROM users WHERE user_id = ?', [userId]);
            if (!user.length) {
                throw new Error('User not found or phone number not provided.');
            }
            toNumber = user[0].phone_number;
        } else if (phoneNumber) {
            // Validate phoneNumber for unauthenticated users
            toNumber = phoneNumber;
        } else {
            throw new Error('Either userId or phoneNumber is required.');
        }

        // Send the message to the bot and get a response
        const botEndpoint = process.env.BOT_ENDPOINT; // Your bot's endpoint
        const botResponse = await axios.post(botEndpoint, {
            userId,
            phoneNumber,
            message,
        });

        if (!botResponse.data || !botResponse.data.response) {
            throw new Error('Invalid response from the bot.');
        }

        const botReply = botResponse.data.response;

        // Send the bot's response via Twilio WhatsApp
        await client.messages.create({
            from: twilioNumber,
            to: `whatsapp:${toNumber}`,
            body: botReply,
        });

        // Log the message to conversation history in DB (if applicable)
        if (userId) {
            await pool.query(
                'INSERT INTO bot_conversations (user_id, user_message, bot_response) VALUES (?, ?, ?)',
                [userId, message, botReply]
            );
        }

        return botReply;
    } catch (err) {
        console.error('Error sending message to bot:', err);
        throw new Error('Failed to communicate with the bot or send WhatsApp message.');
    }
};
