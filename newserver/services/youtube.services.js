// services/youtube.service.js

const ytdl = require('ytdl-core');

const downloadVideo = async (url) => {
    console.log(`Attempting to download video from URL: ${url}`);

    if (!ytdl.validateURL(url)) {
        console.error('Invalid YouTube URL');
        throw new Error('Invalid YouTube URL');
    }

    try {
        const videoInfo = await ytdl.getInfo(url);
        console.log('Video info retrieved:', videoInfo.videoDetails.title);
        const format = ytdl.chooseFormat(videoInfo.formats, { quality: 'highest' });

        if (!format.url) {
            console.error('No valid download URL found');
            throw new Error('No valid download URL found');
        }

        return {
            title: videoInfo.videoDetails.title,
            author: videoInfo.videoDetails.author.name,
            downloadUrl: format.url,
        };
    } catch (error) {
        console.error('Error in downloadVideo:', error.message);
        throw error;
    }
};


module.exports = { downloadVideo };
