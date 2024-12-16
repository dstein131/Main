const mysql = require('mysql2');
const util = require('util');

// Create a pool of connections to the "users" database
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost', // Database host
    user: process.env.DB_USER || 'root',     // Database user
    password: process.env.DB_PASSWORD || '', // Database password
    database: process.env.DB_NAME || 'users', // Connect to the "users" database
    waitForConnections: true,
    connectionLimit: 10, // Limit the number of concurrent connections
    queueLimit: 0,
    connectTimeout: 10000, // 10 seconds for initial connection timeout
    acquireTimeout: 10000, // 10 seconds for pool to acquire connection
    timeout: 30000, // 30 seconds total timeout
    enableKeepAlive: true, // Enable keep-alive for persistent connections
    keepAliveInitialDelay: 30000, // 30 seconds for initial keep-alive delay
});

// Promisify for async/await usage
pool.promise = pool.promise();

// Handle connection errors gracefully
pool.on('error', (err) => {
    console.error('Unexpected MySQL error:', err);
    // Consider exiting the process or other recovery steps
    // process.exit(1);
});

// Function to test the connection
const testConnection = async () => {
    try {
        const connection = await pool.promise().getConnection();
        console.log('MySQL connection to "users" database established successfully.');
        connection.release();
    } catch (err) {
        console.error('Error connecting to MySQL "users" database:', err);
    }
};

// Invoke the test connection (optional, can be removed in production)
testConnection();

// Export the pool to be used in other files
module.exports = pool;
