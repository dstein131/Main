// backend/routes/youtube.routes.js

const express = require('express');
const router = express.Router();
const { downloadVideo } = require('../services/youtube.services');
const ApiError = require('../utils/ApiError');

router.post('/download', async (req, res) => {
    const { url } = req.body;
    console.log(`Received download request for URL: ${url}`);

    try {
        const videoData = await downloadVideo(url);
        console.log('Video data retrieved successfully:', videoData);
        res.status(200).json(videoData);
    } catch (error) {
        if (error instanceof ApiError) {
            console.error(`Error downloading video: ${error.message}`);
            res.status(error.statusCode).json({ error: error.message });
        } else {
            console.error(`Unexpected error: ${error.message}`);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
});

module.exports = router;
