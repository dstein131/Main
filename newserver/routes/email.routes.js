// src/routes/email.routes.js

const express = require('express');
const sgMail = require('@sendgrid/mail');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const upload = require('../middleware/upload'); // Import the Multer middleware

dotenv.config();

// Initialize router
const router = express.Router();

// Configure SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Email route with file attachment handling
router.post('/send', upload.single('file'), async (req, res) => {
  console.log('Incoming request body:', req.body);
  console.log('Incoming file:', req.file);

  const { name, email, service, message } = req.body; // Destructure 'service' instead of 'filePath'
  const file = req.file; // Access the uploaded file

  // Validate required fields
  if (!name || !email || !message) {
    console.log('Validation failed: missing fields');
    return res
      .status(400)
      .json({ success: false, message: 'All fields are required except attachment.' });
  }

  // Build email options
  const mailOptions = {
    to: process.env.RECIPIENT_EMAIL, // Recipient email address
    from: {
      email: process.env.SENDGRID_FROM_EMAIL, // Sender email configured in environment variables
      name: name, // Sender's name
    },
    subject: `Contact Form Submission from ${name}`,
    text: `Name: ${name}\nEmail: ${email}\nService: ${service}\nMessage: ${message}`,
    html: `<p><strong>Name:</strong> ${name}</p>
           <p><strong>Email:</strong> ${email}</p>
           <p><strong>Service:</strong> ${service}</p>
           <p><strong>Message:</strong> ${message}</p>`,
  };

  try {
    // If there's an uploaded file, attach it
    if (file) {
      const fileBuffer = fs.readFileSync(file.path);
      const fileName = path.basename(file.originalname);
      mailOptions.attachments = [
        {
          content: fileBuffer.toString('base64'), // File content in Base64 format
          filename: fileName,
          type: file.mimetype,
          disposition: 'attachment',
        },
      ];
    }

    console.log('Attempting to send email with options:', mailOptions);
    await sgMail.send(mailOptions);
    console.log('Email sent successfully');
    res.status(200).json({ success: true, message: 'Message sent successfully!' });
  } catch (error) {
    console.error('Error sending email:', error);
    if (error.response) {
      console.error('SendGrid Response:', error.response.body);
    }
    res.status(500).json({ success: false, message: 'Failed to send message.', error: error.message });
  } finally {
    // Delete the file from the server after sending the email
    if (file) {
      fs.unlink(file.path, (err) => {
        if (err) console.error('Error deleting uploaded file:', err);
        else console.log('Uploaded file deleted successfully.');
      });
    }
  }
});

module.exports = router;
