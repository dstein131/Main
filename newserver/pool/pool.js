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
    console.error('[MySQL Pool Error] An unexpected error occurred:', err.message);
    console.error('Error Code:', err.code);
    console.error('Stack Trace:', err.stack);
    // Depending on the application, you might want to terminate the process
    // process.exit(1);
});

// Function to test the connection
const testConnection = async () => {
    console.log('[MySQL Connection Test] Starting connection test...');
    try {
        const connection = await pool.getConnection();
        console.log('[MySQL Connection Test] Connection established successfully.');
        console.log(`[MySQL Connection Test] Connected to database: ${process.env.DB_NAME || 'resume_server'} on host: ${process.env.DB_HOST || 'localhost'}`);
        connection.release();
    } catch (err) {
        console.error('[MySQL Connection Test Error] Error connecting to MySQL:', err.message);
        console.error('Error Code:', err.code);
        console.error('Stack Trace:', err.stack);
    }
};

// Log pool configuration for debugging
console.log('[MySQL Pool Configuration] Pool initialized with the following settings:');
console.log(`Host: ${process.env.DB_HOST || 'localhost'}`);
console.log(`User: ${process.env.DB_USER || 'root'}`);
console.log(`Database: ${process.env.DB_NAME || 'resume_server'}`);
console.log(`Connection Limit: ${10}`);
console.log('SSL: Enabled');

// Invoke the test connection (optional, can be removed in production)
testConnection();

// Export the promise-based pool to be used in other files
module.exports = pool;
