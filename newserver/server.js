const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const multer = require('multer');
const socketIo = require('socket.io');
const path = require('path'); // Import path module

const userRoutes = require('./routes/user.routes'); // Import user routes
const { authenticateJWT } = require('./middleware/auth.middleware'); // Import JWT auth middleware
const emailRoutes = require('./routes/email.routes'); // Import email routes

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Set EJS as the templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views')); // Define the views directory

// Middleware
app.use(helmet());

// Configure CORS to allow requests from both localhost and Netlify deployment
app.use(cors({
    origin: [
        'http://localhost:3000', // Local development
        'https://murrayhillwebdesign.netlify.app', // Netlify deployment
        'https://murrayhillwebdevelopment.com/' // Netlify deployment
    ],
    methods: 'GET,POST,PUT,DELETE', // Allowed HTTP methods
    credentials: true // Allow cookies to be sent
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(morgan('dev'));

// File upload setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // Directory for file uploads
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage });

// Use routes
app.use('/api/users', userRoutes); // Mounting the user routes
app.use('/api/email', emailRoutes); // Mounting the email routes

// Socket.io setup (for real-time functionalities)
const http = require('http');
const server = http.createServer(app);
const io = socketIo(server);
io.on('connection', (socket) => {
    console.log('A user connected');
    socket.on('disconnect', () => {
        console.log('A user disconnected');
    });
});

// Import and use the landing page route
const landingPageRoute = require('./routes/landingPage.routes');
app.use('/', landingPageRoute); // Mount the landing page route at root

// Ensure uploads directory exists
const fs = require('fs');
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// Start the server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
