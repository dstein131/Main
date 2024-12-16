// pools.js

const mysql = require('mysql2/promise'); // Import the promise-based interface
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config(); // Load environment variables from .env file

// Create a pool of connections with SSL and additional configurations
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'resume_server',
    waitForConnections: true,
    connectionLimit: 10, // Limit the number of concurrent connections
    queueLimit: 0,
    // Keep-Alive options
    connectTimeout: 10000, // 10 seconds
    acquireTimeout: 10000, // 10 seconds
    timeout: 30000, // 30 seconds
    enableKeepAlive: true,
    keepAliveInitialDelay: 30000, // 30 seconds
    // SSL Configuration
    ssl: {
        rejectUnauthorized: true, // Enforce certificate validation
        ca: fs.readFileSync(path.resolve(__dirname, 'DigiCertGlobalRootCA.crt.pem')), // Path to the DigiCert CA file
    },
});

// Handle connection errors gracefully
pool.on('error', (err) => {
    console.error('Unexpected MySQL error:', err);
    // Depending on the application, you might want to terminate the process
    // process.exit(1);
});

// Function to test the connection
const testConnection = async () => {
    try {
        const connection = await pool.getConnection();
        console.log('MySQL connection established successfully.');
        connection.release();
    } catch (err) {
        console.error('Error connecting to MySQL:', err);
    }
};

// Invoke the test connection (optional, can be removed in production)
testConnection();

// Export the promise-based pool to be used in other files
module.exports = pool;
