const jwt = require('jsonwebtoken');
const pool = require('../pool/pool');
const bcrypt = require('bcryptjs'); // Updated to bcryptjs

// User Registration
exports.register = (req, res) => {
    const { username, email, password } = req.body;

    bcrypt.hash(password, 10, (err, hashedPassword) => {
        if (err) {
            return res.status(500).json({ message: 'Error hashing password', error: err });
        }

        pool.query(
            'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
            [username, email, hashedPassword],
            (err) => {
                if (err) {
                    return res.status(500).json({ message: 'Error creating user', error: err });
                }
                res.status(201).json({ message: 'User created successfully' });
            }
        );
    });
};

// User Login
exports.login = (req, res) => {
    const { email, password } = req.body;

    pool.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
        if (err) {
            return res.status(500).json({ message: 'Error querying database', error: err });
        }

        if (results.length === 0) {
            return res.status(400).json({ message: 'User not found' });
        }

        const user = results[0];
        bcrypt.compare(password, user.password, (err, isMatch) => {
            if (err) {
                return res.status(500).json({ message: 'Error comparing passwords', error: err });
            }

            if (!isMatch) {
                return res.status(400).json({ message: 'Invalid password' });
            }

            const token = jwt.sign(
                { id: user.id, username: user.username },
                process.env.JWT_SECRET_KEY,
                { expiresIn: '1h' }
            );

            res.status(200).json({ message: 'Login successful', token });
        });
    });
};

// Get user data (Authenticated)
exports.getUserData = (req, res) => {
    const userId = req.user.id;

    pool.query('SELECT id, username, email FROM users WHERE id = ?', [userId], (err, results) => {
        if (err) {
            return res.status(500).json({ message: 'Error querying user data', error: err });
        }

        if (results.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json({ user: results[0] });
    });
};

// User Logout
exports.logout = (req, res) => {
    // Destroy session if using session-based auth
    if (req.session) {
        req.session.destroy((err) => {
            if (err) {
                return res.status(500).json({ message: 'Failed to log out' });
            }
            res.clearCookie('user_sid'); // Clear session cookie
            return res.status(200).json({ message: 'Logged out successfully' });
        });
    } else {
        // If not using sessions, inform the client to delete the token
        return res.status(200).json({ message: 'Logged out successfully. Please delete the token on the client side.' });
    }
};
