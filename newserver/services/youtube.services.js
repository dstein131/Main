const ytdl = require('ytdl-core');
const ApiError = require('../utils/ApiError');

const downloadVideo = async (url) => {
    console.log(`Attempting to download video from URL: ${url}`);

    // Validate YouTube URL
    if (!ytdl.validateURL(url)) {
        console.error('Invalid YouTube URL');
        throw new ApiError('Invalid YouTube URL', 400);
    }

    try {
        const videoInfo = await ytdl.getInfo(url);
        console.log('Retrieved video info:', videoInfo.videoDetails);

        // Log available formats
        console.log('Available formats:', videoInfo.formats);

        // Choose the best available format
        const format = ytdl.chooseFormat(videoInfo.formats, { quality: 'highestvideo' });

        if (!format || !format.url) {
            console.error('No valid download URL found in formats:', videoInfo.formats);
            throw new ApiError('Video is no longer available or cannot be accessed.', 410);
        }

        return {
            title: videoInfo.videoDetails.title,
            author: videoInfo.videoDetails.author.name,
            downloadUrl: format.url,
        };
    } catch (error) {
        if (error instanceof ApiError) {
            // Re-throw ApiErrors
            throw error;
        }

        console.error('Error in downloadVideo:', error.message);
        throw new ApiError('Failed to download video', 500);
    }
};

module.exports = { downloadVideo };
