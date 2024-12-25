const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const socketIo = require('socket.io');
const path = require('path'); // Import path module
const fs = require('fs'); // Import file system module
const util = require('util'); // Import util for formatting
const rateLimit = require('express-rate-limit'); // Import rate limiting middleware

const userRoutes = require('./routes/user.routes'); // Import user routes
const { authenticateJWT } = require('./middleware/auth.middleware'); // Import JWT auth middleware
const emailRoutes = require('./routes/email.routes'); // Import email routes
const blogRoutes = require('./routes/blog.routes'); // Import blog routes
const chatgptRoutes = require('./routes/chatgpt.routes'); // Import ChatGPT routes
const servicesRoutes = require('./routes/services.routes'); // Import services routes
const cartsRoutes = require('./routes/carts.routes'); // Import carts routes
const paymentsRoutes = require('./routes/payments.routes'); // Import payments routes
const ordersRoutes = require('./routes/orders.routes'); // Import orders routes
const directMessageRoutes = require('./routes/directMessage.routes'); // Import direct message routes
const youtubeRoutes = require('./routes/youtube.routes');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Apply rate limiting to all requests
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again after 15 minutes.'
});

// Set EJS as the templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views')); // Define the views directory

// Middleware
app.use(helmet());

// limit requests to the API
app.use(limiter);

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

// Stripe webhook requires raw body parsing (apply before body parsers)
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

// Use body parsers for JSON and URL-encoded requests (apply after raw middleware)
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Setup logging
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}
const accessLogStream = fs.createWriteStream(path.join(logsDir, 'access.log'), { flags: 'a' });
app.use(morgan('combined', { stream: accessLogStream })); // Log requests to a file
app.use(morgan('dev')); // Log requests to the console

// Custom console logging for server logs using util.format for better formatting
const logFile = fs.createWriteStream(path.join(logsDir, 'server.log'), { flags: 'a' });
const log = (...args) => {
    const formattedMessage = `[INFO] ${new Date().toISOString()} ${util.format(...args)}\n`;
    process.stdout.write(formattedMessage);
    logFile.write(formattedMessage);
};
const errorLog = (...args) => {
    const formattedMessage = `[ERROR] ${new Date().toISOString()} ${util.format(...args)}\n`;
    process.stderr.write(formattedMessage);
    logFile.write(formattedMessage);
};
console.log = log;
console.error = errorLog;

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// File upload setup (Not used globally; handled in individual routes)
const multer = require('multer');
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
app.use('/api/carts', cartsRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/messages', directMessageRoutes);
app.use('/api/youtube', youtubeRoutes);

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

// Landing page route
const landingPageRoute = require('./routes/landingPage.routes');
app.use('/', landingPageRoute); // Mount the landing page route at root

// Error handling for file upload errors
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        // Multer-specific errors
        console.error('Multer error:', err.message);
        res.status(400).json({ success: false, message: err.message });
    } else if (err) {
        // Other errors
        console.error('Server error:', err.message);
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
