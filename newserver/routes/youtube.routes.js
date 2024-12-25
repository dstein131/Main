const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const youtubeController = require('../controllers/youtube.controller');

// OAuth2 client setup
const OAuth2 = google.auth.OAuth2;
const oauth2Client = new OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    process.env.YOUTUBE_REDIRECT_URI
);

// Routes for channels
router.get('/channels', youtubeController.getChannels); // Get all channels
router.post('/channels', youtubeController.addChannel); // Add a channel
router.delete('/channels/:channel_id', youtubeController.removeChannel); // Remove a channel

// Routes for live chat messages
router.get('/live-chats/:live_chat_id', youtubeController.getLiveChatMessages); // Get live chat messages
router.post('/live-chats', youtubeController.addLiveChatMessage); // Add a live chat message
router.delete('/live-chats/:live_chat_id', youtubeController.clearLiveChatMessages); // Clear live chat messages

// OAuth2 callback route
router.get('/callback', youtubeController.oauthCallback);

// Generate OAuth2 Authorization URL
router.get('/auth', (req, res) => {
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline', // Ensures the refresh token is returned
        scope: ['https://www.googleapis.com/auth/youtube.readonly'], // Permissions for the YouTube API
    });

    res.status(200).json({ success: true, authUrl });
});

module.exports = router;
