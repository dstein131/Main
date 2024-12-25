const { exec } = require('child_process');
const ApiError = require('../utils/ApiError');

/**
 * Executes a shell command and returns the output as a Promise.
 * @param {string} command - The command to execute.
 * @returns {Promise<string>}
 */
const execCommand = (command) => {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(new Error(stderr || error.message));
            } else {
                resolve(stdout);
            }
        });
    });
};

/**
 * Downloads video information and returns download URL and metadata.
 * @param {string} url - The YouTube video URL.
 * @returns {Promise<object>}
 */
const downloadVideo = async (url) => {
    console.log(`Attempting to download video from URL: ${url}`);

    // Validate URL format
    const isValidYouTubeURL = /^https?:\/\/(www\.)?youtube\.com\/watch\?v=/.test(url);
    if (!isValidYouTubeURL) {
        console.error('Invalid YouTube URL');
        throw new ApiError('Invalid YouTube URL', 400);
    }

    try {
        // Fetch video information using yt-dlp
        const command = `yt-dlp -J ${url}`;
        const output = await execCommand(command);
        const videoInfo = JSON.parse(output);

        console.log('Retrieved video info:', {
            title: videoInfo.title,
            uploader: videoInfo.uploader,
            formats: videoInfo.formats.map((f) => f.format_id),
        });

        // Select the best format
        const bestFormat = videoInfo.formats.find(
            (format) => format.acodec !== 'none' && format.vcodec !== 'none'
        );

        if (!bestFormat) {
            console.error('No valid formats available');
            throw new ApiError('Video is no longer available or cannot be accessed.', 410);
        }

        console.log(`Selected format: ${bestFormat.format_id}, URL: ${bestFormat.url}`);

        return {
            title: videoInfo.title,
            author: videoInfo.uploader,
            downloadUrl: bestFormat.url,
        };
    } catch (error) {
        console.error('Error in downloadVideo:', error.message);
        throw new ApiError('Failed to download video', 500);
    }
};

module.exports = { downloadVideo };
