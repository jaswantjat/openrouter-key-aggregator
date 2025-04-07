const express = require('express');
const router = express.Router();
const { generateApiKey, getApiKeys, revokeApiKey, exportApiKeys } = require('../controllers/apiKeyController');
const { authenticate } = require('../middleware/auth');

// API Key management routes (protected by basic auth)
router.post('/keys', authenticate, generateApiKey);
router.get('/keys', authenticate, getApiKeys);
router.delete('/keys/:key', authenticate, revokeApiKey);
router.get('/keys/export', authenticate, exportApiKeys);

module.exports = router;
