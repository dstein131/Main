const jwt = require('jsonwebtoken');
const userpool = require('../pool/userpool');
const bcrypt = require('bcryptjs');

// User Registration
exports.register = async (req, res) => {
    const { username, email, password } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        // Start a transaction to ensure both user creation and association are atomic
        const connection = await userpool.promise().getConnection();
        await connection.beginTransaction();

        try {
            // Insert user into the database
            const userQuery = 'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)';
            const [userResult] = await connection.query(userQuery, [username, email, hashedPassword]);

            const userId = userResult.insertId; // Get the newly created user's ID

            // Fetch the app_id for the "mhwd" application
            const appQuery = 'SELECT app_id FROM applications WHERE app_name = ?';
            const [appResult] = await connection.query(appQuery, ['mhwd']);

            if (appResult.length === 0) {
                throw new Error('Application "mhwd" not found in database.');
            }

            const appId = appResult[0].app_id;

            // Fetch the role_id for the "mhwd_user" role
            const roleQuery = 'SELECT role_id FROM roles WHERE role_name = ?';
            const [roleResult] = await connection.query(roleQuery, ['mhwd_user']);

            if (roleResult.length === 0) {
                throw new Error('Role "mhwd_user" not found in database.');
            }

            const roleId = roleResult[0].role_id;

            // Associate the user with the "mhwd" application and "mhwd_user" role
            const userRoleQuery = 'INSERT INTO user_roles (user_id, app_id, role_id) VALUES (?, ?, ?)';
            await connection.query(userRoleQuery, [userId, appId, roleId]);

            // Commit the transaction
            await connection.commit();

            res.status(201).json({ message: 'User created and associated with mhwd application successfully' });
        } catch (transactionErr) {
            // Rollback the transaction in case of an error
            await connection.rollback();
            throw transactionErr;
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error('Error during registration:', err);
        res.status(500).json({ message: 'Error creating user', error: err.message });
    }
};

// User Login
exports.login = async (req, res) => {
    const { email, password } = req.body;

    try {
        // Retrieve user by email
        const query = 'SELECT * FROM users WHERE email = ?';
        const [results] = await userpool.promise().query(query, [email]);

        if (results.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const user = results[0];

        // Compare provided password with hashed password
        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid password' });
        }

        // Check if the user has access to the mhwd application
        const appQuery = `
            SELECT ur.user_id
            FROM user_roles ur
            JOIN applications a ON ur.app_id = a.app_id
            WHERE ur.user_id = ? AND a.app_name = ?`;
        const [appResults] = await userpool.promise().query(appQuery, [user.user_id, 'mhwd']);

        if (appResults.length === 0) {
            return res.status(403).json({ message: 'Access to the mhwd application is denied.' });
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
        res.status(500).json({ message: 'Error logging in', error: err.message });
    }
};

// Get User Data (Authenticated)
exports.getUserData = async (req, res) => {
    const userId = req.user.id; // Assumes user ID is injected via middleware

    try {
        // Retrieve user data
        const query = 'SELECT user_id, username, email FROM users WHERE user_id = ?';
        const [results] = await userpool.promise().query(query, [userId]);

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
        await userpool.promise().query(query, [userId, appId, roleId]);

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
        const [results] = await userpool.promise().query(query, [userId]);

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
