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
});

// Email route with file attachment handling
router.post('/send', upload.single('file'), async (req, res) => {
  const { name, email, message } = req.body;
  const file = req.file;

  // Validate required fields
  if (!name || !email || !message) {
    return res
      .status(400)
      .json({ success: false, message: 'All fields are required except attachment.' });
  }

  // Build email options
  const mailOptions = {
    from: `"${name}" <${process.env.EMAIL_USER}>`, // Sender's Microsoft 365 email address
    to: 'your-recipient@example.com', // Replace with your actual recipient email
    subject: `Contact Form Submission from ${name}`,
    text: message,
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
    // Send email
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.response);
    res.status(200).json({ success: true, message: 'Message sent successfully!' });
  } catch (error) {
    console.error('Error sending email:', error.message);
    res.status(500).json({ success: false, message: 'Failed to send message.' });
  }
});

module.exports = router;
