const { google } = require('googleapis');
const pool = require('../pool/pool'); // Database connection
const cron = require('node-cron');

// Load OAuth client
const OAuth2 = google.auth.OAuth2;
const oauth2Client = new OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    process.env.YOUTUBE_REDIRECT_URI
);

// Automatically set the refresh token
oauth2Client.setCredentials({
    refresh_token: process.env.YOUTUBE_REFRESH_TOKEN,
});

// Load the YouTube API
const youtube = google.youtube('v3');

/**
 * Check for live broadcasts on all channels in the database.
 */
const checkLiveBroadcasts = async () => {
    try {
        // Get all channels from the database
        const [channels] = await pool.query('SELECT * FROM youtube.channels ORDER BY added_at DESC');

        for (const channel of channels) {
            const channelId = channel.id;

            // Search for live broadcasts
            const response = await youtube.search.list({
                part: 'snippet',
                channelId,
                eventType: 'live', // Search for live broadcasts
                type: 'video', // Only videos
                auth: oauth2Client,
            });

            if (response.data.items.length > 0) {
                for (const item of response.data.items) {
                    const broadcast = {
                        id: item.id.videoId,
                        title: item.snippet.title,
                        channelId: channelId,
                        liveChatId: item.snippet.liveChatId || null,
                        startTime: item.snippet.publishedAt,
                    };

                    // Save the live broadcast to the database
                    await pool.query(
                        `INSERT INTO youtube.live_broadcasts (id, channel_id, title, live_chat_id, start_time)
                         VALUES (?, ?, ?, ?, ?)
                         ON DUPLICATE KEY UPDATE title = VALUES(title), start_time = VALUES(start_time)`,
                        [broadcast.id, broadcast.channelId, broadcast.title, broadcast.liveChatId, broadcast.startTime]
                    );

                    // Fetch live chat messages if a live chat is available
                    if (broadcast.liveChatId) {
                        await fetchLiveChatMessages(broadcast.liveChatId);
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error checking live broadcasts:', error.message);
    }
};

/**
 * Fetch live chat messages and superchats for a live broadcast.
 * @param {string} liveChatId - The live chat ID of the broadcast.
 */
const fetchLiveChatMessages = async (liveChatId) => {
    try {
        let nextPageToken = null;

        do {
            const response = await youtube.liveChatMessages.list({
                liveChatId,
                part: 'snippet,authorDetails',
                pageToken: nextPageToken,
                auth: oauth2Client,
            });

            for (const item of response.data.items) {
                const messageId = item.id;
                const authorName = item.authorDetails.displayName;
                const messageText = item.snippet.displayMessage;
                const publishedAt = item.snippet.publishedAt;

                // Save the message to the database
                await pool.query(
                    `INSERT INTO youtube.live_chats (id, live_chat_id, author_name, message, published_at)
                     VALUES (?, ?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE message = VALUES(message), published_at = VALUES(published_at)`,
                    [messageId, liveChatId, authorName, messageText, publishedAt]
                );

                // Check for superchat messages
                if (item.snippet.superChatDetails) {
                    const superChatDetails = item.snippet.superChatDetails;
                    await pool.query(
                        `INSERT INTO youtube.super_chats (id, live_chat_id, author_name, amount, currency, message, published_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?)
                         ON DUPLICATE KEY UPDATE amount = VALUES(amount), currency = VALUES(currency)`,
                        [
                            messageId,
                            liveChatId,
                            authorName,
                            superChatDetails.amountMicros / 1e6,
                            superChatDetails.currency,
                            messageText,
                            publishedAt,
                        ]
                    );
                }
            }

            nextPageToken = response.data.nextPageToken;
        } while (nextPageToken);
    } catch (error) {
        console.error('Error fetching live chat messages:', error.message);
    }
};

// Schedule a cron job to check for live broadcasts every 5 minutes
cron.schedule('*/5 * * * *', async () => {
    console.log('Running scheduled job: Checking for live broadcasts...');
    await checkLiveBroadcasts();
});

module.exports = {
    checkLiveBroadcasts,
    fetchLiveChatMessages,
};
