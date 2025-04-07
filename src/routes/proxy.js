const express = require('express');
const router = express.Router();
const { proxyRequest } = require('../controllers/proxyController');
const { authenticate } = require('../middleware/auth');

// Proxy all requests to OpenRouter
router.post('/proxy/chat/completions', authenticate, proxyRequest);
router.post('/proxy/completions', authenticate, proxyRequest);
router.post('/proxy/embeddings', authenticate, proxyRequest);

// Catch-all route for any other OpenRouter endpoints
router.all('/proxy', authenticate, proxyRequest);

module.exports = router;
