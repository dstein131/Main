const mysql = require('mysql2');

// Create a pool of connections
const userpool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_USERS,
    waitForConnections: true,
    connectionLimit: 10, // Limit the number of concurrent connections
    queueLimit: 0,
    connectTimeout: 10000, // 10 seconds for initial connection timeout
    acquireTimeout: 10000, // 10 seconds for pool to acquire connection
    timeout: 30000, // 30 seconds total timeout
});

// Promisify the pool for async/await usage
module.exports = userpool.promise();
