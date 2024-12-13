const mysql = require('mysql2');

// Create a pool of connections
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'resume_server',
    waitForConnections: true,
    connectionLimit: 10, // Limit the number of concurrent connections
    queueLimit: 0
});

// Export the pool to be used in other files
module.exports = pool;
