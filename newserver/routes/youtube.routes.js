const express = require('express');
const router = express.Router();
const { downloadVideo } = require('../services/youtube.services');

router.post('/download', async (req, res) => {
    const { url } = req.body;

    try {
        const videoData = await downloadVideo(url);
        res.status(200).json(videoData);
    } catch (error) {
        console.error('Error downloading video:', error.message);
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;
