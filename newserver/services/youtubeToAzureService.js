// services/youtubeToAzureService.js

const { google } = require('googleapis');
const { BlobServiceClient } = require('@azure/storage-blob');
const dotenv = require('dotenv');
const fs = require('fs'); // Standard fs module for streaming
const fsp = require('fs').promises; // Promise-based fs
const path = require('path');
const ytdl = require('ytdl-core');
const cron = require('node-cron');
const winston = require('winston'); // Logging library

// Load environment variables from .env file
dotenv.config();

// Validate essential environment variables
const requiredEnvVars = [
    'YOUTUBE_API_KEY',
    'CHANNEL_IDS',
    'AZURE_STORAGE_CONNECTION_STRING_PRIMARY',
    'AZURE_STORAGE_CONNECTION_STRING_SECONDARY',
    'AZURE_CONTAINER_NAME',
    'CHECK_INTERVAL_CRON'
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
    console.error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
    process.exit(1);
}

// Initialize YouTube API client
const youtube = google.youtube({
    version: 'v3',
    auth: process.env.YOUTUBE_API_KEY,
});

// Initialize Azure Blob Storage Clients
const connectionStrings = [
    process.env.AZURE_STORAGE_CONNECTION_STRING_PRIMARY,
    process.env.AZURE_STORAGE_CONNECTION_STRING_SECONDARY,
];

function initializeBlobClients(connectionStrings) {
    return connectionStrings.map(connStr => BlobServiceClient.fromConnectionString(connStr));
}

const blobServiceClients = initializeBlobClients(connectionStrings);

// Logger configuration using winston
const logsDir = path.join(__dirname, '..', 'logs');
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => `${timestamp} [${level.toUpperCase()}]: ${message}`)
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: path.join(logsDir, 'youtubeToAzureService.log') }),
    ],
});

// Ensure logs directory exists
(async () => {
    try {
        await fsp.mkdir(logsDir, { recursive: true });
        logger.info('Logs directory ensured.');
    } catch (error) {
        console.error(`Failed to create logs directory: ${error.message}`);
        process.exit(1);
    }
})();

// Concurrency limit (e.g., 3 concurrent downloads/uploads)
const MAX_CONCURRENT_OPERATIONS = 3;
let activeOperations = 0;
const operationQueue = [];

// Function to handle concurrency
function enqueueOperation(operation) {
    return new Promise((resolve, reject) => {
        const executeOperation = async () => {
            activeOperations++;
            try {
                const result = await operation();
                resolve(result);
            } catch (error) {
                reject(error);
            } finally {
                activeOperations--;
                if (operationQueue.length > 0) {
                    const nextOperation = operationQueue.shift();
                    nextOperation();
                }
            }
        };

        if (activeOperations < MAX_CONCURRENT_OPERATIONS) {
            executeOperation();
        } else {
            operationQueue.push(executeOperation);
        }
    });
}

// Function to get an active container client with failover
async function getActiveContainerClient(containerName) {
    for (const client of blobServiceClients) {
        try {
            const containerClient = client.getContainerClient(containerName);
            // Verify connection by listing blobs
            await containerClient.listBlobsFlat().next();
            logger.info('Connected to Azure Blob Storage successfully.');
            return containerClient;
        } catch (error) {
            logger.error(`Error connecting to Azure Storage: ${error.message}`);
            // Continue to the next connection string
        }
    }
    throw new Error('All Azure Storage connection strings failed.');
}

// Path to store processed video IDs per channel
const processedVideosDir = path.join(__dirname, 'processedVideos');

// Ensure processedVideos directory exists
async function ensureProcessedVideosDir() {
    try {
        await fsp.mkdir(processedVideosDir, { recursive: true });
        logger.info('Processed videos directory ensured.');
    } catch (error) {
        logger.error(`Failed to create processedVideos directory: ${error.message}`);
        throw error;
    }
}

// Load processed videos for a specific channel
async function loadProcessedVideos(channelId) {
    const filePath = path.join(processedVideosDir, `${channelId}.json`);
    try {
        const data = await fsp.readFile(filePath, 'utf-8');
        logger.info(`Loaded processed videos for channel ${channelId}.`);
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            // File doesn't exist, initialize it
            await saveProcessedVideos(channelId, {});
            logger.info(`Initialized processed videos for new channel ${channelId}.`);
            return {};
        } else {
            logger.error(`Failed to load processed videos for channel ${channelId}: ${error.message}`);
            throw error;
        }
    }
}

// Save processed videos for a specific channel
async function saveProcessedVideos(channelId, processedVideos) {
    const filePath = path.join(processedVideosDir, `${channelId}.json`);
    try {
        await fsp.writeFile(filePath, JSON.stringify(processedVideos, null, 2), 'utf-8');
        logger.info(`Saved processed videos for channel ${channelId}.`);
    } catch (error) {
        logger.error(`Failed to save processed videos for channel ${channelId}: ${error.message}`);
        throw error;
    }
}

// Fetch latest videos from a channel
async function fetchLatestVideos(channelId) {
    try {
        const response = await youtube.search.list({
            part: 'id,snippet',
            channelId: channelId,
            order: 'date',
            maxResults: 5, // Adjust as needed
            type: 'video',
        });

        logger.info(`Fetched ${response.data.items.length} videos for channel ${channelId}.`);
        return response.data.items;
    } catch (error) {
        logger.error(`Error fetching videos for channel ${channelId}: ${error.message}`);
        return [];
    }
}

// Check if video is a live stream that has started
async function isVideoLive(videoId) {
    try {
        const response = await youtube.videos.list({
            part: 'snippet,liveStreamingDetails',
            id: videoId,
        });

        if (response.data.items.length === 0) {
            logger.warn(`Video ${videoId} not found.`);
            return false;
        }

        const video = response.data.items[0];
        if (video.liveStreamingDetails && video.liveStreamingDetails.actualStartTime) {
            return true; // Live stream has started
        }

        return false; // Not a live stream or hasn't started
    } catch (error) {
        logger.error(`Error checking live status for video ${videoId}: ${error.message}`);
        return false;
    }
}

// Download YouTube video using ytdl-core with better error handling
async function downloadVideo(videoId, filePath) {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    return new Promise((resolve, reject) => {
        const videoStream = ytdl(videoUrl, { quality: 'highest' });

        const writeStream = fs.createWriteStream(filePath);

        videoStream.pipe(writeStream)
            .on('finish', () => {
                logger.info(`Downloaded video: ${videoId}`);
                resolve();
            })
            .on('error', (err) => {
                logger.error(`Error downloading video ${videoId}: ${err.message}`);
                reject(err);
            });

        videoStream.on('error', (err) => {
            logger.error(`Error streaming video ${videoId}: ${err.message}`);
            reject(err);
        });
    });
}

// Upload file to Azure Blob Storage with better error handling
async function uploadToAzure(containerName, filePath, blobName) {
    let containerClient;
    try {
        containerClient = await getActiveContainerClient(containerName);
    } catch (error) {
        logger.error(`Failed to get an active Azure Blob Container Client: ${error.message}`);
        throw error;
    }

    try {
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        await blockBlobClient.uploadFile(filePath, {
            blobHTTPHeaders: { blobContentType: 'video/mp4' },
        });
        logger.info(`Uploaded ${blobName} to Azure Blob Storage`);
    } catch (error) {
        logger.error(`Error uploading ${blobName} to Azure: ${error.message}`);
        throw error;
    }
}

// Process videos for a single channel
async function processChannel(channelId) {
    logger.info(`Processing channel: ${channelId}`);
    const processedVideos = await loadProcessedVideos(channelId);
    const videos = await fetchLatestVideos(channelId);

    for (const video of videos) {
        const videoId = video.id.videoId;

        if (!processedVideos[videoId]) {
            const sanitizedTitle = video.snippet.title.replace(/[<>:"/\\|?*]+/g, ''); // Sanitize title
            const filePath = path.join(__dirname, `${videoId}.mp4`);
            const blobName = `${channelId}/${videoId}.mp4`; // Organize blobs by channel ID

            try {
                const live = await isVideoLive(videoId);
                if (live) {
                    logger.warn(`Video ${videoId} is a live stream that has started. Skipping download.`);
                    continue; // Skip live streams that have started
                }

                // Enqueue download operation
                await enqueueOperation(async () => {
                    await downloadVideo(videoId, filePath);
                });

                // Enqueue upload operation
                await enqueueOperation(async () => {
                    await uploadToAzure(process.env.AZURE_CONTAINER_NAME, filePath, blobName);
                });

                // Enqueue file deletion operation
                await enqueueOperation(async () => {
                    await fsp.unlink(filePath); // Remove local file after upload
                });

                // Mark video as processed
                processedVideos[videoId] = {
                    title: video.snippet.title,
                    publishedAt: video.snippet.publishedAt,
                };
                await saveProcessedVideos(channelId, processedVideos);
            } catch (error) {
                logger.error(`Failed to process video ${videoId} from channel ${channelId}: ${error.message}`);
            }
        } else {
            logger.info(`Video ${videoId} from channel ${channelId} has already been processed.`);
        }
    }
}

// Process all channels with concurrency control
async function processAllChannels() {
    const channelIdsEnv = process.env.CHANNEL_IDS;
    const channelIds = channelIdsEnv.split(',').map(id => id.trim()).filter(id => id.length > 0);

    if (channelIds.length === 0) {
        logger.warn('No valid CHANNEL_IDS found in the environment variables.');
        return;
    }

    // Initialize processedVideos directory
    await ensureProcessedVideosDir();

    // Process channels sequentially to manage concurrency across channels
    for (const channelId of channelIds) {
        await processChannel(channelId);
    }
}

// Schedule the task using cron
function scheduleVideoProcessing() {
    const cronExpression = process.env.CHECK_INTERVAL_CRON || '0 * * * *'; // Default: every hour

    cron.schedule(cronExpression, async () => {
        logger.info('Scheduled Task: Checking for new videos...');
        try {
            await processAllChannels();
            logger.info('Scheduled Task: Completed checking for new videos.');
        } catch (error) {
            logger.error(`Scheduled Task: Failed to check for new videos: ${error.message}`);
        }
    });

    logger.info(`Scheduled video processing with cron expression: "${cronExpression}"`);
}

// Initialize the service
function init() {
    logger.info('Initializing YouTube to Azure service...');
    (async () => {
        try {
            await processAllChannels(); // Initial run
            scheduleVideoProcessing();
        } catch (error) {
            logger.error(`Initialization failed: ${error.message}`);
        }
    })();
}

module.exports = { init };
