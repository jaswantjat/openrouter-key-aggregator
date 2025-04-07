const express = require('express');
const router = express.Router();
const { proxyRequest } = require('../controllers/proxyController');
const { authenticate } = require('../middleware/auth');
const { apiKeyAuth } = require('../middleware/apiKeyAuth');

// Determine which auth middleware to use based on environment variables
const getAuthMiddleware = () => {
  if (process.env.API_KEY_AUTH_ENABLED === 'true') {
    return apiKeyAuth;
  }
  if (process.env.AUTH_ENABLED === 'true') {
    return authenticate;
  }
  return (req, res, next) => next(); // No auth if both are disabled
};

// Proxy all requests to OpenRouter
router.post('/proxy/chat/completions', getAuthMiddleware(), proxyRequest);
router.post('/proxy/completions', getAuthMiddleware(), proxyRequest);
router.post('/proxy/embeddings', getAuthMiddleware(), proxyRequest);

// Catch-all route for any other OpenRouter endpoints
router.all('/proxy', getAuthMiddleware(), proxyRequest);

module.exports = router;
