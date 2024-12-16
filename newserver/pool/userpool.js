const mysql = require('mysql2/promise'); // Import the promise-based interface
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config(); // Load environment variables from .env file

// Read the DigiCertGlobalRootCA.crt.pem file
const sslCert = fs.readFileSync(path.join(__dirname, 'DigiCertGlobalRootCA.crt.pem'));

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
    console.error('Unexpected MySQL error in userpool:', err);
    // Depending on the application, you might want to terminate the process
    // process.exit(1);
});

// Function to test the connection
const testUserPoolConnection = async () => {
    try {
        const connection = await userpool.getConnection();
        console.log('Userpool MySQL connection established successfully.');
        connection.release();
    } catch (err) {
        console.error('Error connecting to userpool MySQL:', err);
    }
};

// Invoke the test connection (optional, can be removed in production)
testUserPoolConnection();

// Export the promise-based userpool to be used in other files
module.exports = userpool;
