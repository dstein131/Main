const express = require('express');
const multer = require('multer');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
dotenv.config();

// Initialize router
const router = express.Router();

// Configure Multer for file uploads with size limits
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf', 'application/msword'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Allowed types are .jpeg, .png, .pdf, .docx'), false);
    }
  },
});

// Configure Nodemailer transporter for Microsoft 365
const transporter = nodemailer.createTransport({
  host: 'smtp.office365.com', // Microsoft 365 SMTP server
  port: 587,
  secure: false, // Use TLS
  auth: {
    user: process.env.EMAIL_USER, // Your Microsoft 365 email address
    pass: process.env.EMAIL_PASS, // Your email account password or app password
  },
  logger: true, // Enable Nodemailer logging
  debug: true,  // Show debugging output
});

// Email route with file attachment handling
router.post('/send', upload.single('file'), async (req, res) => {
  console.log('Incoming request:', req.body, req.file);

  const { name, email, message } = req.body;
  const file = req.file;

  // Validate required fields
  if (!name || !email || !message) {
    console.log('Validation failed: missing fields');
    return res
      .status(400)
      .json({ success: false, message: 'All fields are required except attachment.' });
  }

  // Build email options
  const mailOptions = {
    from: `"${name}" <${process.env.EMAIL_USER}>`, // Sender's Microsoft 365 email address
    to: process.env.RECIPIENT_EMAIL, // Your recipient's email, stored in the .env file
    subject: `Contact Form Submission from ${name}`,
    text: `Name: ${name}\nEmail: ${email}\nMessage: ${message}`,
    html: `<p><strong>Name:</strong> ${name}</p>
           <p><strong>Email:</strong> ${email}</p>
           <p><strong>Message:</strong> ${message}</p>`,
    attachments: file
      ? [
          {
            filename: file.originalname,
            content: file.buffer,
          },
        ]
      : [],
  };

  try {
    console.log('Attempting to send email with options:', mailOptions);
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info);
    res.status(200).json({ success: true, message: 'Message sent successfully!' });
  } catch (error) {
    console.error('Error sending email:', error);
    if (error.response) {
      console.error('SMTP Response:', error.response);
    }
    res.status(500).json({ success: false, message: 'Failed to send message.', error: error.message });
  }
});

// Error handling for file upload issues
router.use((err, req, res, next) => {
  console.error('Middleware error handler caught an error:', err);
  if (err instanceof multer.MulterError) {
    res.status(400).json({ success: false, message: err.message });
  } else if (err.message === 'Unsupported file type. Allowed types are .jpeg, .png, .pdf, .docx') {
    res.status(400).json({ success: false, message: err.message });
  } else {
    next(err);
  }
});

module.exports = router;
