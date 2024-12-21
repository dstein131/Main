const axios = require('axios');

/**
 * Integrate the bot with Microsoft Teams.
 * @param {number} userId - The ID of the user integrating Teams.
 * @param {string} teamsId - The Teams ID for the user.
 * @returns {Promise<void>}
 */
exports.integrateWithTeams = async (userId, teamsId) => {
    try {
        // Replace with your Teams API or bot integration endpoint
        const teamsIntegrationEndpoint = process.env.TEAMS_INTEGRATION_ENDPOINT;

        // Make a request to integrate with Teams
        const response = await axios.post(teamsIntegrationEndpoint, {
            userId,
            teamsId,
        });

        if (response.status !== 200) {
            throw new Error('Failed to integrate with Microsoft Teams.');
        }
    } catch (err) {
        console.error('Error integrating with Teams:', err);
        throw new Error('Failed to integrate with Teams.');
    }
};
