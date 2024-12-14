const express = require('express');
const multer = require('multer');
const axios = require('axios');
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

// Email route with file attachment handling
router.post('/send', upload.single('file'), async (req, res) => {
  console.log('Request received at /send');

  const { name, email, message } = req.body;
  const file = req.file;

  console.log('Request Body:', req.body);
  if (file) {
    console.log('File Received:', req.file.originalname);
  } else {
    console.log('No file uploaded.');
  }

  // Validate required fields
  if (!name || !email || !message) {
    return res.status(400).json({ success: false, message: 'All fields are required except attachment.' });
  }

  // Build email payload
  const payload = {
    personalizations: [
      {
        to: [{ email: 'your-email@example.com' }], // Replace with your actual email
        subject: `Contact Form Submission from ${name}`,
      },
    ],
    from: { email }, // Sender's email
    content: [
      {
        type: 'text/plain',
        value: message,
      },
      {
        type: 'text/html',
        value: `<p><strong>Name:</strong> ${name}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Message:</strong> ${message}</p>`,
      },
    ],
    // Add attachment if file exists
    attachments: file
      ? [
          {
            content: file.buffer.toString('base64'),
            filename: file.originalname,
            type: file.mimetype,
            disposition: 'attachment',
          },
        ]
      : [],
  };

  console.log('Payload:', JSON.stringify(payload, null, 2));

  try {
    const response = await axios.post(
      'https://api.sendgrid.com/v3/mail/send',
      payload,
      {
        headers: {
          Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 5000, // 5-second timeout
      }
    );
    console.log('Email sent successfully:', response.data);
    res.status(200).json({ success: true, message: 'Message sent successfully!' });
  } catch (error) {
    console.error('Error sending email:', error.response?.data || error.message);
    res.status(500).json({ success: false, message: 'Failed to send message.' });
  }
});

module.exports = router;
