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
 * Get all services with associated add-ons.
 */
exports.getAllServices = async (req, res) => {
    try {
        const [services] = await pool.query('SELECT * FROM services ORDER BY created_at DESC');
        const [addons] = await pool.query('SELECT * FROM service_addons');

        const servicesWithAddons = services.map(service => {
            const serviceAddons = addons.filter(addon => addon.service_id === service.service_id);
            return { ...service, addons: serviceAddons };
        });

        res.status(200).json({ services: servicesWithAddons });
    } catch (err) {
        console.error('Error fetching services:', err);
        res.status(500).json({ message: 'Error fetching services', error: err.message });
    }
};

/**
 * Get a specific service by ID with its associated add-ons.
 */
exports.getServiceById = async (req, res) => {
    const { id } = req.params;

    try {
        const [services] = await pool.query('SELECT * FROM services WHERE service_id = ?', [id]);

        if (services.length === 0) {
            return res.status(404).json({ message: 'Service not found' });
        }

        const service = services[0];
        const [addons] = await pool.query('SELECT * FROM service_addons WHERE service_id = ?', [id]);

        res.status(200).json({ service: { ...service, addons } });
    } catch (err) {
        console.error('Error fetching service:', err);
        res.status(500).json({ message: 'Error fetching service', error: err.message });
    }
};

/**
 * Create a new service.
 */
exports.createService = async (req, res) => {
    const { title, price, description, isMonthly } = req.body;
    const userId = req.user.id;

    if (!title || !price) {
        return res.status(400).json({ message: 'Title and price are required.' });
    }

    try {
        const [result] = await pool.query(
            'INSERT INTO services (title, price, description, isMonthly) VALUES (?, ?, ?, ?)',
            [title, price, description, isMonthly || 0]
        );

        const newServiceId = result.insertId;

        await pool.query(
            'INSERT INTO audit_logs (user_id, app_id, action, action_details) VALUES (?, ?, ?, ?)',
            [userId, 1, 'create_service', `Created service with ID ${newServiceId}`]
        );

        res.status(201).json({ message: 'Service created successfully', service_id: newServiceId });
    } catch (err) {
        console.error('Error creating service:', err);
        res.status(500).json({ message: 'Error creating service', error: err.message });
    }
};

/**
 * Update an existing service.
 */
exports.updateService = async (req, res) => {
    const { id } = req.params;
    const { title, price, description, isMonthly } = req.body;
    const userId = req.user.id;

    try {
        const [services] = await pool.query('SELECT * FROM services WHERE service_id = ?', [id]);
        if (services.length === 0) {
            return res.status(404).json({ message: 'Service not found' });
        }

        const [result] = await pool.query(
            'UPDATE services SET title = ?, price = ?, description = ?, isMonthly = ?, updated_at = NOW() WHERE service_id = ?',
            [title, price, description, isMonthly || 0, id]
        );

        await pool.query(
            'INSERT INTO audit_logs (user_id, app_id, action, action_details) VALUES (?, ?, ?, ?)',
            [userId, 1, 'update_service', `Updated service with ID ${id}`]
        );

        res.status(200).json({ message: 'Service updated successfully' });
    } catch (err) {
        console.error('Error updating service:', err);
        res.status(500).json({ message: 'Error updating service', error: err.message });
    }
};

/**
 * Delete a service.
 */
exports.deleteService = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        const [result] = await pool.query('DELETE FROM services WHERE service_id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Service not found or already deleted.' });
        }

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
        const [services] = await pool.query('SELECT * FROM services WHERE service_id = ?', [serviceId]);
        if (services.length === 0) {
            return res.status(404).json({ message: 'Service not found' });
        }

        const [addons] = await pool.query('SELECT * FROM service_addons WHERE service_id = ?', [serviceId]);

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
    const userId = req.user.id;

    if (!name || !price) {
        return res.status(400).json({ message: 'Name and price are required for add-ons.' });
    }

    try {
        const [services] = await pool.query('SELECT * FROM services WHERE service_id = ?', [serviceId]);
        if (services.length === 0) {
            return res.status(404).json({ message: 'Service not found' });
        }

        const [result] = await pool.query(
            'INSERT INTO service_addons (service_id, name, price, description) VALUES (?, ?, ?, ?)',
            [serviceId, name, price, description]
        );

        const newAddonId = result.insertId;

        await pool.query(
            'INSERT INTO audit_logs (user_id, app_id, action, action_details) VALUES (?, ?, ?, ?)',
            [userId, 1, 'create_service_addon', `Created add-on with ID ${newAddonId} for service ID ${serviceId}`]
        );

        res.status(201).json({ message: 'Service add-on created successfully', addon_id: newAddonId });
    } catch (err) {
        console.error('Error creating add-on:', err);
        res.status(500).json({ message: 'Error creating add-on', error: err.message });
    }
};

/**
 * Update an existing add-on.
 */
exports.updateAddon = async (req, res) => {
    const { serviceId, addonId } = req.params;
    const { name, price, description } = req.body;
    const userId = req.user.id;

    try {
        const [addons] = await pool.query('SELECT * FROM service_addons WHERE addon_id = ? AND service_id = ?', [addonId, serviceId]);
        if (addons.length === 0) {
            return res.status(404).json({ message: 'Add-on not found for this service.' });
        }

        await pool.query(
            'UPDATE service_addons SET name = ?, price = ?, description = ?, updated_at = NOW() WHERE addon_id = ? AND service_id = ?',
            [name, price, description, addonId, serviceId]
        );

        await pool.query(
            'INSERT INTO audit_logs (user_id, app_id, action, action_details) VALUES (?, ?, ?, ?)',
            [userId, 1, 'update_service_addon', `Updated add-on with ID ${addonId} for service ID ${serviceId}`]
        );

        res.status(200).json({ message: 'Service add-on updated successfully' });
    } catch (err) {
        console.error('Error updating add-on:', err);
        res.status(500).json({ message: 'Error updating add-on', error: err.message });
    }
};

/**
 * Delete an add-on.
 */
exports.deleteAddon = async (req, res) => {
    const { serviceId, addonId } = req.params;
    const userId = req.user.id;

    try {
        const [result] = await pool.query('DELETE FROM service_addons WHERE addon_id = ? AND service_id = ?', [addonId, serviceId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Add-on not found for this service.' });
        }

        await pool.query(
            'INSERT INTO audit_logs (user_id, app_id, action, action_details) VALUES (?, ?, ?, ?)',
            [userId, 1, 'delete_service_addon', `Deleted add-on with ID ${addonId} from service ID ${serviceId}`]
        );

        res.status(200).json({ message: 'Add-on deleted successfully' });
    } catch (err) {
        console.error('Error deleting add-on:', err);
        res.status(500).json({ message: 'Error deleting add-on', error: err.message });
    }
};
