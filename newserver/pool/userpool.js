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

// Create a pool of connections for the user database with SSL
const userpool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_USERS || 'user_database', // Ensure this is the correct users database
    waitForConnections: true,
    connectionLimit: 10, // Limit the number of concurrent connections
    queueLimit: 0,
    connectTimeout: 10000, // 10 seconds for initial connection timeout
    ssl: {
        ca: sslCert, // Include the SSL certificate
    },
});

// Handle connection errors gracefully
userpool.on('error', (err) => {
    console.error('[MySQL Userpool Error] An unexpected error occurred:', err.message);
    console.error('Error Code:', err.code);
    console.error('Stack Trace:', err.stack);
    // Consider exiting the process if this is a critical error
    // process.exit(1);
});

// Function to test the connection
const testUserPoolConnection = async () => {
    console.log('[MySQL Userpool Connection Test] Starting connection test...');
    try {
        const connection = await userpool.getConnection();
        console.log('[MySQL Userpool Connection Test] Connection established successfully.');
        console.log(`[MySQL Userpool Connection Test] Connected to database: ${process.env.DB_USERS || 'user_database'} on host: ${process.env.DB_HOST || 'localhost'}`);
        connection.release();
    } catch (err) {
        console.error('[MySQL Userpool Connection Test Error] Error connecting to MySQL:', err.message);
        console.error('Error Code:', err.code);
        console.error('Stack Trace:', err.stack);
    }
};

// Log userpool configuration for debugging
console.log('[MySQL Userpool Configuration] Pool initialized with the following settings:');
console.log(`Host: ${process.env.DB_HOST || 'localhost'}`);
console.log(`User: ${process.env.DB_USER || 'root'}`);
console.log(`Database: ${process.env.DB_USERS || 'user_database'}`);
console.log(`Connection Limit: 10`);
console.log(`SSL: Enabled`);

// Invoke the test connection (optional, can be removed in production)
testUserPoolConnection();

// Export the promise-based userpool to be used in other files
module.exports = userpool;
