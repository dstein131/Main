// routes/services.routes.js

const express = require('express');
const router = express.Router();
const servicesController = require('../controllers/services.controller'); // Import services controller
const { authenticateJWT } = require('../middleware/auth.middleware'); // Import JWT middleware

// ---------------------
// Routes for Services
// ---------------------

// Get all services
router.get('/', servicesController.getAllServices);

// Get a specific service by ID
router.get('/:id', servicesController.getServiceById);

// Create a new service (requires authentication)
router.post('/', authenticateJWT, servicesController.createService);

// Update a service (requires authentication)
router.put('/:id', authenticateJWT, servicesController.updateService);

// Delete a service (requires authentication)
router.delete('/:id', authenticateJWT, servicesController.deleteService);

// ---------------------
// Routes for Service Add-Ons
// ---------------------

// Get all add-ons for a specific service
router.get('/:serviceId/addons', servicesController.getAddonsByServiceId);

// Create a new add-on for a specific service (requires authentication)
router.post('/:serviceId/addons', authenticateJWT, servicesController.createAddon);

// Update an add-on (requires authentication)
router.put('/:serviceId/addons/:addonId', authenticateJWT, servicesController.updateAddon);

// Delete an add-on (requires authentication)
router.delete('/:serviceId/addons/:addonId', authenticateJWT, servicesController.deleteAddon);

module.exports = router;
