const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const multer = require('multer');
const socketIo = require('socket.io');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const path = require('path');
const fs = require('fs');

const pool = require('./pool/pool');
const userRoutes = require('./routes/user.routes');
const emailRoutes = require('./routes/email.routes');
const landingPageRoute = require('./routes/landingPage.routes');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Set EJS as the templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(helmet());

app.use(
    cors({
        origin: [
            'http://localhost:3000',
            'https://murrayhillwebdesign.netlify.app',
            'https://murrayhillwebdevelopment.com',
        ],
        methods: 'GET,POST,PUT,DELETE',
        credentials: true,
    })
);

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
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    },
});
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf', 'application/msword'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Unsupported file type'), false);
        }
    },
});

app.use((req, res, next) => {
    console.log('Session:', req.session);
    next();
});




// Session configuration
const sessionStore = new MySQLStore({}, pool.promise());
app.use(
    session({
        key: 'user_sid',
        secret: process.env.VITE_SESSION_SECRET || 'default_secret',
        store: sessionStore,
        resave: false,
        saveUninitialized: true, // Set to true to save sessions even when they are uninitialized
        cookie: {
            maxAge: 1000 * 60 * 60 * 24,
            httpOnly: true,
            secure: process.env.VITE_NODE_ENV === 'production',
        },
    })
);


// Use routes
app.use('/api/users', userRoutes);
app.use('/api/email', emailRoutes);
app.use('/', landingPageRoute);

// Socket.io setup
const http = require('http');
const server = http.createServer(app);
const io = socketIo(server);

io.on('connection', (socket) => {
    console.log('A user connected');
    socket.on('disconnect', () => {
        console.log('A user disconnected');
    });
});

// Error handling for file upload errors
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        res.status(400).json({ success: false, message: err.message });
    } else if (err) {
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
