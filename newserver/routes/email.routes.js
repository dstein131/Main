const express = require('express');
const multer = require('multer');
const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

// Initialize router
const router = express.Router();

// Configure Multer for file uploads
const storage = multer.memoryStorage(); // Store files in memory
const upload = multer({ storage });

// Email route with file attachment handling
router.post('/send', upload.single('file'), async (req, res) => {
  const { name, email, message } = req.body;
  const file = req.file;

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
    attachments: file
      ? [
          {
            content: file.buffer.toString('base64'), // Convert file to Base64
            filename: file.originalname,
            type: file.mimetype,
            disposition: 'attachment',
          },
        ]
      : [],
  };

  try {
    const response = await axios.post(
      'https://api.sendgrid.com/v3/mail/send',
      payload,
      {
        headers: {
          Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`, // SendGrid API key
          'Content-Type': 'application/json',
        },
      }
    );
    res.status(200).json({ success: true, message: 'Message sent successfully!' });
  } catch (error) {
    console.error('Error sending email:', error.response?.data || error.message);
    res.status(500).json({ success: false, message: 'Failed to send message.' });
  }
});

module.exports = router;
