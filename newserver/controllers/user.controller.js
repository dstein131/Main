const jwt = require('jsonwebtoken');
const pool = require('../pool/userpool');
const bcrypt = require('bcryptjs');

// User Registration
exports.register = async (req, res) => {
    const { username, email, password } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert user into the database
        const query = 'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)';
        await pool.promise().query(query, [username, email, hashedPassword]);

        res.status(201).json({ message: 'User created successfully' });
    } catch (err) {
        console.error('Error during registration:', err);
        res.status(500).json({ message: 'Error creating user', error: err });
    }
};

// User Login
exports.login = async (req, res) => {
    const { email, password } = req.body;

    try {
        // Retrieve user by email
        const query = 'SELECT * FROM users WHERE email = ?';
        const [results] = await pool.promise().query(query, [email]);

        if (results.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const user = results[0];

        // Compare provided password with hashed password
        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid password' });
        }

        // Generate JWT token
        const token = jwt.sign(
            { id: user.user_id, username: user.username },
            process.env.JWT_SECRET_KEY,
            { expiresIn: '1h' }
        );

        res.status(200).json({ message: 'Login successful', token });
    } catch (err) {
        console.error('Error during login:', err);
        res.status(500).json({ message: 'Error logging in', error: err });
    }
};

// Get User Data (Authenticated)
exports.getUserData = async (req, res) => {
    const userId = req.user.id; // Assumes user ID is injected via middleware

    try {
        // Retrieve user data
        const query = 'SELECT user_id, username, email FROM users WHERE user_id = ?';
        const [results] = await pool.promise().query(query, [userId]);

        if (results.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json({ user: results[0] });
    } catch (err) {
        console.error('Error fetching user data:', err);
        res.status(500).json({ message: 'Error fetching user data', error: err });
    }
};

// Assign Role to User
exports.assignRole = async (req, res) => {
    const { userId, appId, roleId } = req.body;

    try {
        // Assign role to user for a specific application
        const query = 'INSERT INTO user_roles (user_id, app_id, role_id) VALUES (?, ?, ?)';
        await pool.promise().query(query, [userId, appId, roleId]);

        res.status(200).json({ message: 'Role assigned successfully' });
    } catch (err) {
        console.error('Error assigning role:', err);
        res.status(500).json({ message: 'Error assigning role', error: err });
    }
};

// Get User Roles
exports.getUserRoles = async (req, res) => {
    const userId = req.user.id; // Assumes user ID is injected via middleware

    try {
        // Retrieve roles for the user
        const query = `
            SELECT r.role_name, a.app_name
            FROM user_roles ur
            JOIN roles r ON ur.role_id = r.role_id
            JOIN applications a ON ur.app_id = a.app_id
            WHERE ur.user_id = ?`;
        const [results] = await pool.promise().query(query, [userId]);

        res.status(200).json({ roles: results });
    } catch (err) {
        console.error('Error fetching user roles:', err);
        res.status(500).json({ message: 'Error fetching user roles', error: err });
    }
};

// User Logout
exports.logout = (req, res) => {
    if (req.session) {
        req.session.destroy((err) => {
            if (err) {
                return res.status(500).json({ message: 'Failed to log out' });
            }
            res.clearCookie('user_sid'); // Clear session cookie
            res.status(200).json({ message: 'Logged out successfully' });
        });
    } else {
        res.status(200).json({ message: 'Logged out successfully. Please delete the token on the client side.' });
    }
};
