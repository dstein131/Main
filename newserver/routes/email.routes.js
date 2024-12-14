const express = require('express');
const multer = require('multer');
const sgMail = require('@sendgrid/mail');
const dotenv = require('dotenv');
dotenv.config();

// Initialize router
const router = express.Router();

// Set SendGrid API Key
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

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

  // Build email data
  const mailOptions = {
    to: process.env.RECIPIENT_EMAIL,
    from: `"${name}" <no-reply@example.com>`, // SendGrid requires verified sender
    subject: `Contact Form Submission from ${name}`,
    text: `Name: ${name}\nEmail: ${email}\nMessage: ${message}`,
    html: `<p><strong>Name:</strong> ${name}</p>
           <p><strong>Email:</strong> ${email}</p>
           <p><strong>Message:</strong> ${message}</p>`,
    attachments: file
      ? [
          {
            content: file.buffer.toString('base64'), // Convert to base64 for SendGrid
            filename: file.originalname,
            type: file.mimetype,
            disposition: 'attachment',
          },
        ]
      : [],
  };

  try {
    console.log('Attempting to send email with options:', mailOptions);
    await sgMail.send(mailOptions);
    console.log('Email sent successfully');
    res.status(200).json({ success: true, message: 'Message sent successfully!' });
  } catch (error) {
    console.error('Error sending email:', error);
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
