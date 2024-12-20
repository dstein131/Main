const express = require('express');
const sgMail = require('@sendgrid/mail');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config();

// Initialize router
const router = express.Router();

// Configure SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Email route with file attachment handling
router.post('/send', async (req, res) => {
  console.log('Incoming request:', req.body);

  const { name, email, message, filePath } = req.body;

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
    text: `Name: ${name}\nEmail: ${email}\nMessage: ${message}`,
    html: `<p><strong>Name:</strong> ${name}</p>
           <p><strong>Email:</strong> ${email}</p>
           <p><strong>Message:</strong> ${message}</p>`,
  };

  try {
    // If there is a filePath (uploaded file), attach it
    if (filePath) {
      const fileBuffer = fs.readFileSync(path.join(__dirname, '..', 'uploads', filePath));
      const fileName = path.basename(filePath);
      mailOptions.attachments = [
        {
          content: fileBuffer.toString('base64'), // File content in Base64 format
          filename: fileName,
          type: 'application/octet-stream', // General binary stream MIME type
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
  }
});

module.exports = router;
