const express = require('express');
const router = express.Router();
const axios = require('axios');

/**
 * @route   POST /api/chatgpt/respond
 * @desc    Receive user message and respond using ChatGPT
 * @access  Public
 */
router.post('/respond', async (req, res) => {
  console.log('OpenAI API Key:', process.env.OPENAI_API_KEY);

  const { message } = req.body;

  // Validate the incoming message
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'A valid message is required.' });
  }

  try {
    // Make a request to the OpenAI ChatGPT API
    const openaiResponse = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo', // Use a model that aligns with your limits
        messages: [{ role: 'user', content: message }],
        max_tokens: 50, // Reduced token usage for better API efficiency
        temperature: 0.7, // Adjust for creativity
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, // Access the API key securely
        },
      }
    );

    // Extract the reply from OpenAI's response
    const reply = openaiResponse.data.choices[0].message.content.trim();

    // Send the reply back to the frontend
    res.json({ reply });
  } catch (error) {
    console.error('Error communicating with OpenAI:', error.message);

    // Handle specific OpenAI API errors
    if (error.response) {
      const { status, data } = error.response;
      return res.status(status).json({ error: data.error?.message || 'Error from OpenAI API' });
    }

    // Handle other possible errors
    res.status(500).json({ error: 'An unexpected error occurred while processing your request.' });
  }
});

module.exports = router;
