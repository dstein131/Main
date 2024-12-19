// server.js

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const multer = require('multer');
const socketIo = require('socket.io');
const path = require('path'); // Import path module
const fs = require('fs'); // Import file system module

const userRoutes = require('./routes/user.routes'); // Import user routes
const { authenticateJWT } = require('./middleware/auth.middleware'); // Import JWT auth middleware
const emailRoutes = require('./routes/email.routes'); // Import email routes
const blogRoutes = require('./routes/blog.routes'); // Import blog routes
const chatgptRoutes = require('./routes/chatgpt.routes'); // Import ChatGPT routes
const servicesRoutes = require('./routes/services.routes'); // Import services routes
const cartsRoutes = require('./routes/carts.routes'); // Import carts routes
const paymentsRoutes = require('./routes/payments.routes'); // Import payments routes

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Set EJS as the templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views')); // Define the views directory

// Middleware
app.use(helmet());

// Configure CORS
app.use(cors({
    origin: [
        'http://localhost:3000', // Local development
        'https://murrayhillwebdesign.netlify.app', // Netlify deployment
        'https://murrayhillwebdevelopment.com' // Custom domain
    ],
    methods: 'GET,POST,PUT,DELETE',
    credentials: true
}));

// Important: Use bodyParser.json() and bodyParser.urlencoded() before defining routes
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// File upload setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir); // Directory for file uploads
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf', 'application/msword'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Unsupported file type'), false);
        }
    }
});

// Use routes
app.use('/api/users', userRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/blog', blogRoutes);
app.use('/api/chatgpt', chatgptRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/carts', cartsRoutes); // Mounting the carts routes
app.use('/api/payments', paymentsRoutes); // Mounting the payments routes

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

// Error handling for file upload errors
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        // Multer-specific errors
        res.status(400).json({ success: false, message: err.message });
    } else if (err) {
        // Other errors
        res.status(500).json({ success: false, message: err.message });
    } else {
        next();
    }
});

// Start the server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
