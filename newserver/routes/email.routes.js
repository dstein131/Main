const express = require('express');
const multer = require('multer');
const sgMail = require('@sendgrid/mail');
const dotenv = require('dotenv');
dotenv.config();

// Initialize router
const router = express.Router();

// Configure SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Configure Multer for file uploads
const storage = multer.memoryStorage(); // Store files in memory
const upload = multer({ storage });

// Email route with file attachment handling
router.post('/send', upload.single('file'), async (req, res) => {
  const { name, email, message } = req.body;
  const file = req.file;

  const msg = {
    to: 'your-email@example.com', // Replace with your actual email
    from: email, // User's email
    subject: `Contact Form Submission from ${name}`,
    text: message,
    html: `<p><strong>Name:</strong> ${name}</p>
           <p><strong>Email:</strong> ${email}</p>
           <p><strong>Message:</strong> ${message}</p>`,
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
    await sgMail.send(msg);
    res.status(200).json({ success: true, message: 'Message sent successfully!' });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ success: false, message: 'Failed to send message.' });
  }
});

module.exports = router;
