// controllers/services.controller.js

const pool = require('../pool/pool'); // Promise-based pool for main DB
const userpool = require('../pool/userpool'); // Promise-based pool for user_management DB

// ---------------------
// Helper Functions
// ---------------------

/**
 * Fetch user information from userpool based on user ID.
 * @param {number} userId - The ID of the user.
 * @returns {Object} - User information.
 */
const getUserById = async (userId) => {
    if (!userId) return null;

    try {
        const [users] = await userpool.query('SELECT user_id, username, email FROM users WHERE user_id = ?', [userId]);
        if (users.length === 0) return null;
        return users[0];
    } catch (err) {
        console.error('Error fetching user from userpool:', err);
        throw err;
    }
};

// ---------------------
// Services
// ---------------------

/**
 * Get all services.
 */
exports.getAllServices = async (req, res) => {
    try {
        const [services] = await pool.query('SELECT * FROM services ORDER BY created_at DESC');
        res.status(200).json({ services });
    } catch (err) {
        console.error('Error fetching services:', err);
        res.status(500).json({ message: 'Error fetching services', error: err.message });
    }
};

/**
 * Get a specific service by ID.
 */
exports.getServiceById = async (req, res) => {
    const { id } = req.params;

    try {
        const [services] = await pool.query('SELECT * FROM services WHERE service_id = ?', [id]);

        if (services.length === 0) {
            return res.status(404).json({ message: 'Service not found' });
        }

        res.status(200).json({ service: services[0] });
    } catch (err) {
        console.error('Error fetching service:', err);
        res.status(500).json({ message: 'Error fetching service', error: err.message });
    }
};

/**
 * Create a new service.
 */
exports.createService = async (req, res) => {
    const { title, price, description } = req.body;
    const userId = req.user.id; // Assuming user ID is available from authentication middleware

    // Validate input
    if (!title || !price) {
        return res.status(400).json({ message: 'Title and price are required.' });
    }

    try {
        const [result] = await pool.query(
            'INSERT INTO services (title, price, description) VALUES (?, ?, ?)',
            [title, price, description]
        );

        const newServiceId = result.insertId;

        // Optionally, log the creation in audit_logs
        await pool.query(
            'INSERT INTO audit_logs (user_id, app_id, action, action_details) VALUES (?, ?, ?, ?)',
            [userId, 1, 'create_service', `Created service with ID ${newServiceId}`]
        );

        res.status(201).json({ message: 'Service created successfully', service_id: newServiceId });
    } catch (err) {
        console.error('Error creating service:', err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: 'Service title must be unique.' });
        }
        res.status(500).json({ message: 'Error creating service', error: err.message });
    }
};

/**
 * Update an existing service.
 */
exports.updateService = async (req, res) => {
    const { id } = req.params;
    const { title, price, description } = req.body;
    const userId = req.user.id; // Assuming user ID is available from authentication middleware

    try {
        // Check if service exists
        const [services] = await pool.query('SELECT * FROM services WHERE service_id = ?', [id]);
        if (services.length === 0) {
            return res.status(404).json({ message: 'Service not found' });
        }

        // Update the service
        const [result] = await pool.query(
            'UPDATE services SET title = ?, price = ?, description = ?, updated_at = NOW() WHERE service_id = ?',
            [title, price, description, id]
        );

        if (result.affectedRows === 0) {
            return res.status(500).json({ message: 'Failed to update service.' });
        }

        // Optionally, log the update in audit_logs
        await pool.query(
            'INSERT INTO audit_logs (user_id, app_id, action, action_details) VALUES (?, ?, ?, ?)',
            [userId, 1, 'update_service', `Updated service with ID ${id}`]
        );

        res.status(200).json({ message: 'Service updated successfully' });
    } catch (err) {
        console.error('Error updating service:', err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: 'Service title must be unique.' });
        }
        res.status(500).json({ message: 'Error updating service', error: err.message });
    }
};

/**
 * Delete a service.
 */
exports.deleteService = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id; // Assuming user ID is available from authentication middleware

    try {
        // Delete the service
        const [result] = await pool.query('DELETE FROM services WHERE service_id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Service not found or already deleted.' });
        }

        // Optionally, log the deletion in audit_logs
        await pool.query(
            'INSERT INTO audit_logs (user_id, app_id, action, action_details) VALUES (?, ?, ?, ?)',
            [userId, 1, 'delete_service', `Deleted service with ID ${id}`]
        );

        res.status(200).json({ message: 'Service deleted successfully' });
    } catch (err) {
        console.error('Error deleting service:', err);
        res.status(500).json({ message: 'Error deleting service', error: err.message });
    }
};

// ---------------------
// Service Add-Ons
// ---------------------

/**
 * Get all add-ons for a specific service.
 */
exports.getAddonsByServiceId = async (req, res) => {
    const { serviceId } = req.params;

    try {
        // Check if service exists
        const [services] = await pool.query('SELECT * FROM services WHERE service_id = ?', [serviceId]);
        if (services.length === 0) {
            return res.status(404).json({ message: 'Service not found' });
        }

        // Fetch add-ons
        const [addons] = await pool.query('SELECT * FROM service_addons WHERE service_id = ? ORDER BY created_at ASC', [serviceId]);

        res.status(200).json({ addons });
    } catch (err) {
        console.error('Error fetching add-ons:', err);
        res.status(500).json({ message: 'Error fetching add-ons', error: err.message });
    }
};

/**
 * Create a new add-on for a specific service.
 */
exports.createAddon = async (req, res) => {
    const { serviceId } = req.params;
    const { name, price, description } = req.body;
    const userId = req.user.id; // Assuming user ID is available from authentication middleware

    // Validate input
    if (!name || !price) {
        return res.status(400).json({ message: 'Name and price are required for add-ons.' });
    }

    try {
        // Check if service exists
        const [services] = await pool.query('SELECT * FROM services WHERE service_id = ?', [serviceId]);
        if (services.length === 0) {
            return res.status(404).json({ message: 'Service not found' });
        }

        // Insert the new add-on
        const [result] = await pool.query(
            'INSERT INTO service_addons (service_id, name, price, description) VALUES (?, ?, ?, ?)',
            [serviceId, name, price, description]
        );

        const newAddonId = result.insertId;

        // Optionally, log the creation in audit_logs
        await pool.query(
            'INSERT INTO audit_logs (user_id, app_id, action, action_details) VALUES (?, ?, ?, ?)',
            [userId, 1, 'create_service_addon', `Created add-on with ID ${newAddonId} for service ID ${serviceId}`]
        );

        res.status(201).json({ message: 'Service add-on created successfully', addon_id: newAddonId });
    } catch (err) {
        console.error('Error creating service add-on:', err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: 'Add-on name must be unique for this service.' });
        }
        res.status(500).json({ message: 'Error creating service add-on', error: err.message });
    }
};

/**
 * Update an existing service add-on.
 */
exports.updateAddon = async (req, res) => {
    const { serviceId, addonId } = req.params;
    const { name, price, description } = req.body;
    const userId = req.user.id; // Assuming user ID is available from authentication middleware

    try {
        // Check if service and add-on exist
        const [addons] = await pool.query('SELECT * FROM service_addons WHERE addon_id = ? AND service_id = ?', [addonId, serviceId]);
        if (addons.length === 0) {
            return res.status(404).json({ message: 'Add-on not found for the specified service.' });
        }

        // Update the add-on
        const [result] = await pool.query(
            'UPDATE service_addons SET name = ?, price = ?, description = ?, updated_at = NOW() WHERE addon_id = ? AND service_id = ?',
            [name, price, description, addonId, serviceId]
        );

        if (result.affectedRows === 0) {
            return res.status(500).json({ message: 'Failed to update add-on.' });
        }

        // Optionally, log the update in audit_logs
        await pool.query(
            'INSERT INTO audit_logs (user_id, app_id, action, action_details) VALUES (?, ?, ?, ?)',
            [userId, 1, 'update_service_addon', `Updated add-on with ID ${addonId} for service ID ${serviceId}`]
        );

        res.status(200).json({ message: 'Service add-on updated successfully' });
    } catch (err) {
        console.error('Error updating service add-on:', err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: 'Add-on name must be unique for this service.' });
        }
        res.status(500).json({ message: 'Error updating service add-on', error: err.message });
    }
};

/**
 * Delete a service add-on.
 */
exports.deleteAddon = async (req, res) => {
    const { serviceId, addonId } = req.params;
    const userId = req.user.id; // Assuming user ID is available from authentication middleware

    try {
        // Delete the add-on
        const [result] = await pool.query('DELETE FROM service_addons WHERE addon_id = ? AND service_id = ?', [addonId, serviceId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Add-on not found for the specified service.' });
        }

        // Optionally, log the deletion in audit_logs
        await pool.query(
            'INSERT INTO audit_logs (user_id, app_id, action, action_details) VALUES (?, ?, ?, ?)',
            [userId, 1, 'delete_service_addon', `Deleted add-on with ID ${addonId} from service ID ${serviceId}`]
        );

        res.status(200).json({ message: 'Service add-on deleted successfully' });
    } catch (err) {
        console.error('Error deleting service add-on:', err);
        res.status(500).json({ message: 'Error deleting service add-on', error: err.message });
    }
};
