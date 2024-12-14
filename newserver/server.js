const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const multer = require('multer');
const socketIo = require('socket.io');
const userRoutes = require('./routes/user.routes');  // Import user routes
const { authenticateJWT } = require('./middleware/auth.middleware');  // Import JWT auth middleware
const path = require('path'); // Import path module

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Set EJS as the templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views')); // Define the views directory

// Middleware
app.use(helmet());
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Use routes
app.use('/api/users', userRoutes); // Mounting the user routes

// File upload setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage });

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

// Start the server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
