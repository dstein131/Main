const jwt = require('jsonwebtoken');
const pool = require('../pool/pool');
const bcrypt = require('bcryptjs'); // Updated to bcryptjs

// User Registration
exports.register = (req, res) => {
    const { username, email, password } = req.body;

    // Hash the password before saving it to the database
    bcrypt.hash(password, 10, (err, hashedPassword) => {
        if (err) {
            return res.status(500).json({ message: 'Error hashing password', error: err });
        }

        // Store the new user in the database
        pool.query(
            'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
            [username, email, hashedPassword],
            (err, results) => {
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

    // Check if the user exists in the database
    pool.query(
        'SELECT * FROM users WHERE email = ?',
        [email],
        (err, results) => {
            if (err) {
                return res.status(500).json({ message: 'Error querying database', error: err });
            }

            if (results.length === 0) {
                return res.status(400).json({ message: 'User not found' });
            }

            // Compare password with the stored hash
            const user = results[0];
            bcrypt.compare(password, user.password, (err, isMatch) => {
                if (err) {
                    return res.status(500).json({ message: 'Error comparing passwords', error: err });
                }

                if (!isMatch) {
                    return res.status(400).json({ message: 'Invalid password' });
                }

                // Generate JWT token
                const token = jwt.sign(
                    { id: user.id, username: user.username },
                    process.env.JWT_SECRET_KEY,
                    { expiresIn: '1h' }
                );

                res.status(200).json({ message: 'Login successful', token });
            });
        }
    );
};

// Get user data (Authenticated)
exports.getUserData = (req, res) => {
    const userId = req.user.id; // This should come from the JWT token

    pool.query(
        'SELECT id, username, email FROM users WHERE id = ?',
        [userId],
        (err, results) => {
            if (err) {
                return res.status(500).json({ message: 'Error querying user data', error: err });
            }

            if (results.length === 0) {
                return res.status(404).json({ message: 'User not found' });
            }

            res.status(200).json({ user: results[0] });
        }
    );
};