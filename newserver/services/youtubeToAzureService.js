// services/youtubeToAzureService.js

const { google } = require('googleapis');
const { BlobServiceClient } = require('@azure/storage-blob');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const ytdl = require('ytdl-core'); // Use ytdl-core for reliable downloads
const cron = require('node-cron');

// Load environment variables
dotenv.config();

// Initialize YouTube API
const youtube = google.youtube({
    version: 'v3',
    auth: process.env.YOUTUBE_API_KEY,
});

// Initialize Azure Blob Storage Clients
const connectionStrings = [
    process.env.AZURE_STORAGE_CONNECTION_STRING_PRIMARY,
    process.env.AZURE_STORAGE_CONNECTION_STRING_SECONDARY,
];

// Function to initialize BlobServiceClients from connection strings
function initializeBlobClients(connectionStrings) {
    return connectionStrings.map((connStr) => BlobServiceClient.fromConnectionString(connStr));
}

// Initialize BlobServiceClients
const blobServiceClients = initializeBlobClients(connectionStrings);

// Function to get an active container client with failover
async function getActiveContainerClient(containerName) {
    for (const client of blobServiceClients) {
        try {
            const containerClient = client.getContainerClient(containerName);
            // Attempt to list blobs to verify connection
            await containerClient.listBlobsFlat().next();
            return containerClient;
        } catch (error) {
            console.error('Error connecting to Azure Storage with current connection string:', error.message);
            // Try the next connection string
        }
    }
    throw new Error('All Azure Storage connection strings failed.');
}

// Path to store processed video IDs per channel
const processedVideosDir = path.join(__dirname, 'processedVideos');
if (!fs.existsSync(processedVideosDir)) {
    fs.mkdirSync(processedVideosDir, { recursive: true });
}

// Function to load processed videos for a specific channel
function loadProcessedVideos(channelId) {
    const filePath = path.join(processedVideosDir, `${channelId}.json`);
    if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath);
        return JSON.parse(data);
    }
    // Initialize empty object if file doesn't exist
    fs.writeFileSync(filePath, JSON.stringify({}, null, 2));
    return {};
}

// Function to save processed videos for a specific channel
function saveProcessedVideos(channelId, processedVideos) {
    const filePath = path.join(processedVideosDir, `${channelId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(processedVideos, null, 2));
}

// Function to fetch latest videos from a channel
async function fetchLatestVideos(channelId) {
    try {
        const response = await youtube.search.list({
            part: 'id,snippet',
            channelId: channelId,
            order: 'date',
            maxResults: 5, // Adjust as needed
            type: 'video',
        });

        return response.data.items;
    } catch (error) {
        console.error(`Error fetching videos for channel ${channelId}:`, error.message);
        return [];
    }
}

// Function to download YouTube video using ytdl-core
async function downloadVideo(videoId, filePath) {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    return new Promise((resolve, reject) => {
        const videoStream = ytdl(videoUrl, { quality: 'highest' });

        videoStream.pipe(fs.createWriteStream(filePath))
            .on('finish', () => {
                console.log(`Downloaded video: ${videoId}`);
                resolve();
            })
            .on('error', (err) => {
                console.error(`Error downloading video ${videoId}:`, err.message);
                reject(err);
            });
    });
}

// Function to upload file to Azure Blob Storage with failover
async function uploadToAzure(containerName, filePath, blobName) {
    let containerClient;
    try {
        containerClient = await getActiveContainerClient(containerName);
    } catch (error) {
        console.error('Failed to get an active Azure Blob Container Client:', error.message);
        throw error;
    }

    try {
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        await blockBlobClient.uploadFile(filePath, {
            blobHTTPHeaders: { blobContentType: 'video/mp4' },
        });
        console.log(`Uploaded ${blobName} to Azure Blob Storage`);
    } catch (error) {
        console.error(`Error uploading ${blobName} to Azure:`, error.message);
        throw error;
    }
}

// Function to process videos for all channels
async function processAllChannels() {
    const channelIdsEnv = process.env.CHANNEL_IDS;
    if (!channelIdsEnv) {
        console.error('CHANNEL_IDS is not defined in the environment variables.');
        return;
    }

    const channelIds = channelIdsEnv.split(',').map(id => id.trim()).filter(id => id.length > 0);
    if (channelIds.length === 0) {
        console.error('No valid CHANNEL_IDS found in the environment variables.');
        return;
    }

    for (const channelId of channelIds) {
        console.log(`Processing channel: ${channelId}`);
        const processedVideos = loadProcessedVideos(channelId);
        const videos = await fetchLatestVideos(channelId);

        for (const video of videos) {
            const videoId = video.id.videoId;

            if (!processedVideos[videoId]) {
                const title = video.snippet.title.replace(/[<>:"/\\|?*]+/g, ''); // Sanitize title
                const filePath = path.join(__dirname, `${videoId}.mp4`);
                const blobName = `${channelId}/${videoId}.mp4`; // Organize blobs by channel ID

                try {
                    await downloadVideo(videoId, filePath);
                    await uploadToAzure(process.env.AZURE_CONTAINER_NAME, filePath, blobName);
                    fs.unlinkSync(filePath); // Remove local file after upload

                    // Mark video as processed
                    processedVideos[videoId] = {
                        title: video.snippet.title,
                        publishedAt: video.snippet.publishedAt,
                    };
                    saveProcessedVideos(channelId, processedVideos);
                } catch (error) {
                    console.error(`Failed to process video ${videoId} from channel ${channelId}:`, error.message);
                }
            } else {
                console.log(`Video ${videoId} from channel ${channelId} has already been processed.`);
            }
        }
    }
}

// Schedule the task using cron
function scheduleVideoProcessing() {
    const cronExpression = process.env.CHECK_INTERVAL_CRON || '0 * * * *'; // Default: every hour
    cron.schedule(cronExpression, () => {
        console.log('Scheduled Task: Checking for new videos...');
        processAllChannels();
    });

    console.log(`Scheduled video processing with cron expression: "${cronExpression}"`);
}

// Initialize the service
function init() {
    console.log('Initializing YouTube to Azure service...');
    processAllChannels(); // Initial run
    scheduleVideoProcessing();
}

module.exports = { init };
