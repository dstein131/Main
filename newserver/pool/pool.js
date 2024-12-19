const mysql = require('mysql2/promise'); // Import the promise-based interface
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config(); // Load environment variables from .env file

// Read the DigiCertGlobalRootCA.crt.pem file
let sslCert;
try {
    sslCert = fs.readFileSync(path.join(__dirname, 'DigiCertGlobalRootCA.crt.pem'));
    console.log('[SSL Certificate] DigiCertGlobalRootCA.crt.pem loaded successfully.');
} catch (err) {
    console.error('[SSL Certificate Error] Failed to load DigiCertGlobalRootCA.crt.pem:', err.message);
    console.error('Ensure the certificate file is located at:', path.join(__dirname, 'DigiCertGlobalRootCA.crt.pem'));
    process.exit(1); // Exit the process if the SSL certificate cannot be loaded
}

// Create a pool of connections for the main database with SSL, mirroring userpool's pattern
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'resume_server',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 10000, // 10 seconds for initial connection timeout
    ssl: {
        ca: sslCert, // Include the SSL certificate, no rejectUnauthorized here
    },
});

// Handle connection errors gracefully
pool.on('error', (err) => {
    console.error('[MySQL Pool Error] An unexpected error occurred:', err.message);
    console.error('Error Code:', err.code);
    console.error('Stack Trace:', err.stack);
    // Consider exiting the process if this is a critical error
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
console.log(`Connection Limit: 10`);
console.log('SSL: Enabled');

// Invoke the test connection (optional, can be removed in production)
testConnection();

// Export the promise-based pool to be used in other files
module.exports = pool;
