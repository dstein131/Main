// services/youtube.service.js

const ytdl = require('ytdl-core');

const downloadVideo = async (url) => {
    if (!ytdl.validateURL(url)) {
        throw new Error('Invalid YouTube URL');
    }

    const videoInfo = await ytdl.getInfo(url);
    const format = ytdl.chooseFormat(videoInfo.formats, { quality: 'highest' });

    if (!format.url) {
        throw new Error('No valid download URL found');
    }

    return {
        title: videoInfo.videoDetails.title,
        author: videoInfo.videoDetails.author.name,
        downloadUrl: format.url,
    };
};

module.exports = { downloadVideo };
