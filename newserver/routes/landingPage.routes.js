const express = require('express');
const router = express.Router();

// Landing Page Route
router.get('/', (req, res) => {
    res.render('landingPage'); // Render the EJS template
});

module.exports = router;
