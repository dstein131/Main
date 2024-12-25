const { google } = require('googleapis');
const pool = require('../pool/pool'); // Main DB pool, ensure it connects to the `youtube` DB

// OAuth2 client setup
const OAuth2 = google.auth.OAuth2;
const oauth2Client = new OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    process.env.YOUTUBE_REDIRECT_URI
);

/**
 * Get All Channels
 */
exports.getChannels = async (req, res) => {
    try {
        const [channels] = await pool.query('SELECT * FROM youtube.channels ORDER BY added_at DESC');
        res.status(200).json({ success: true, data: channels });
    } catch (err) {
        console.error('Error fetching channels:', err);
        res.status(500).json({ success: false, message: 'Error fetching channels', error: err.message });
    }
};

/**
 * Add a New Channel
 * Body: { channel_id, name }
 */
exports.addChannel = async (req, res) => {
    const { channel_id, name } = req.body;

    if (!channel_id || !name) {
        return res.status(400).json({ message: 'Channel ID and name are required.' });
    }

    try {
        await pool.query(
            'INSERT INTO youtube.channels (id, name) VALUES (?, ?)',
            [channel_id, name]
        );
        res.status(201).json({ success: true, message: `Channel "${name}" added successfully.` });
    } catch (err) {
        console.error('Error adding channel:', err);
        res.status(500).json({ success: false, message: 'Error adding channel', error: err.message });
    }
};

/**
 * Remove a Channel
 * URL Param: :channel_id
 */
exports.removeChannel = async (req, res) => {
    const { channel_id } = req.params;

    try {
        const [result] = await pool.query('DELETE FROM youtube.channels WHERE id = ?', [channel_id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Channel not found.' });
        }

        res.status(200).json({ success: true, message: 'Channel removed successfully.' });
    } catch (err) {
        console.error('Error removing channel:', err);
        res.status(500).json({ success: false, message: 'Error removing channel', error: err.message });
    }
};

/**
 * Get Live Chat Messages for a Broadcast
 * URL Param: :live_chat_id
 */
exports.getLiveChatMessages = async (req, res) => {
    const { live_chat_id } = req.params;

    try {
        const [messages] = await pool.query(
            `SELECT lc.id AS message_id, lc.author_name, lc.message, lc.published_at,
                    sc.amount AS superChatAmount, ss.amount AS superStickerAmount, ss.sticker_metadata
             FROM youtube.live_chats lc
             LEFT JOIN youtube.super_chats sc ON lc.id = sc.id
             LEFT JOIN youtube.super_stickers ss ON lc.id = ss.id
             WHERE lc.live_chat_id = ?
             ORDER BY lc.published_at ASC`,
            [live_chat_id]
        );

        res.status(200).json({ success: true, data: messages });
    } catch (err) {
        console.error('Error fetching live chat messages:', err);
        res.status(500).json({ success: false, message: 'Error fetching live chat messages', error: err.message });
    }
};

/**
 * Add a Live Chat Message
 * Body: { live_chat_id, author_name, message, published_at }
 */
exports.addLiveChatMessage = async (req, res) => {
    const { live_chat_id, author_name, message, published_at } = req.body;

    if (!live_chat_id || !author_name || !message || !published_at) {
        return res.status(400).json({ message: 'All fields are required.' });
    }

    try {
        await pool.query(
            'INSERT INTO youtube.live_chats (id, live_chat_id, author_name, message, published_at) VALUES (UUID(), ?, ?, ?, ?)',
            [live_chat_id, author_name, message, published_at]
        );

        res.status(201).json({ success: true, message: 'Live chat message added successfully.' });
    } catch (err) {
        console.error('Error adding live chat message:', err);
        res.status(500).json({ success: false, message: 'Error adding live chat message', error: err.message });
    }
};

/**
 * Clear All Messages for a Live Chat
 * URL Param: :live_chat_id
 */
exports.clearLiveChatMessages = async (req, res) => {
    const { live_chat_id } = req.params;

    try {
        await pool.query('DELETE FROM youtube.live_chats WHERE live_chat_id = ?', [live_chat_id]);
        res.status(200).json({ success: true, message: 'Live chat messages cleared successfully.' });
    } catch (err) {
        console.error('Error clearing live chat messages:', err);
        res.status(500).json({ success: false, message: 'Error clearing live chat messages', error: err.message });
    }
};

/**
 * Handle OAuth2 Callback
 * Query Param: ?code=<authorization_code>
 */
exports.oauthCallback = async (req, res) => {
    const { code } = req.query;

    if (!code) {
        return res.status(400).json({ success: false, message: 'Authorization code is missing.' });
    }

    try {
        // Exchange authorization code for tokens
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        const { access_token, refresh_token, expiry_date } = tokens;

        // Save tokens in the database
        await pool.query(
            `INSERT INTO youtube.oauth_tokens (id, access_token, refresh_token, expiry_date)
             VALUES (UUID(), ?, ?, ?)
             ON DUPLICATE KEY UPDATE access_token = VALUES(access_token), refresh_token = VALUES(refresh_token), expiry_date = VALUES(expiry_date)`,
            [access_token, refresh_token, expiry_date]
        );

        res.status(200).json({ success: true, message: 'OAuth2 callback handled successfully.' });
    } catch (error) {
        console.error('Error handling OAuth callback:', error);
        res.status(500).json({ success: false, message: 'Error during OAuth callback.', error: error.message });
    }
};
