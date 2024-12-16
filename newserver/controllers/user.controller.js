const jwt = require('jsonwebtoken');
const pool = require('../userpool/userpool');
const bcrypt = require('bcryptjs');

// ---------------------
// User Registration
// ---------------------
exports.register = async (req, res) => {
    const { username, email, password, isSuperadmin = false } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert new user into the database
        const query = `
            INSERT INTO users (username, email, password_hash, is_superadmin) 
            VALUES (?, ?, ?, ?)`;
        await pool.promise().query(query, [username, email, hashedPassword, isSuperadmin]);

        res.status(201).json({ message: 'User registered successfully' });
    } catch (err) {
        console.error('Error during user registration:', err);
        res.status(500).json({ message: 'Error registering user', error: err.message || err });
    }
};

// ---------------------
// User Login
// ---------------------
exports.login = async (req, res) => {
    const { email, password } = req.body;

    try {
        const query = 'SELECT * FROM users WHERE email = ?';
        const [results] = await pool.promise().query(query, [email]);

        if (results.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const user = results[0];

        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid password' });
        }

        const token = jwt.sign(
            { id: user.user_id, username: user.username, isSuperadmin: !!user.is_superadmin },
            process.env.JWT_SECRET_KEY,
            { expiresIn: '2h' }
        );

        // Optionally track session
        const sessionQuery = `
            INSERT INTO sessions (user_id, session_token, ip_address, user_agent, expires_at) 
            VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 2 HOUR))`;
        await pool.promise().query(sessionQuery, [
            user.user_id,
            token,
            req.ip || null,
            req.headers['user-agent'] || null,
        ]);

        res.status(200).json({ message: 'Login successful', token });
    } catch (err) {
        console.error('Error during user login:', err);
        res.status(500).json({ message: 'Error logging in', error: err.message || err });
    }
};

// ---------------------
// Get User Roles
// ---------------------
exports.getUserRoles = async (req, res) => {
    const userId = req.user.id;

    try {
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
        res.status(500).json({ message: 'Error fetching user roles', error: err.message || err });
    }
};

// ---------------------
// Assign Role to User
// ---------------------
exports.assignRole = async (req, res) => {
    const { userId, appId, roleId } = req.body;

    try {
        const query = `
            INSERT INTO user_roles (user_id, app_id, role_id) 
            VALUES (?, ?, ?)`;
        await pool.promise().query(query, [userId, appId, roleId]);

        res.status(200).json({ message: 'Role assigned successfully' });
    } catch (err) {
        console.error('Error assigning role:', err);
        res.status(500).json({ message: 'Error assigning role', error: err.message || err });
    }
};

// ---------------------
// Middleware: Authenticate
// ---------------------
exports.authenticate = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Unauthorized: No token provided' });
    }

    jwt.verify(token, process.env.JWT_SECRET_KEY, (err, decoded) => {
        if (err) {
            return res.status(401).json({ message: 'Unauthorized: Invalid token', error: err.message || err });
        }

        req.user = decoded;
        next();
    });
};

// ---------------------
// Logout: Invalidate Session
// ---------------------
exports.logout = async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];

    try {
        if (token) {
            const query = 'DELETE FROM sessions WHERE session_token = ?';
            await pool.promise().query(query, [token]);
        }

        res.status(200).json({ message: 'Logged out successfully' });
    } catch (err) {
        console.error('Error during logout:', err);
        res.status(500).json({ message: 'Error during logout', error: err.message || err });
    }
};
