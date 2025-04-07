const apiKeyManager = require('../utils/apiKeyManager');

/**
 * API Key authentication middleware
 */
const apiKeyAuth = (req, res, next) => {
  // Skip authentication if disabled
  if (process.env.API_KEY_AUTH_ENABLED !== 'true') {
    return next();
  }

  // Get API key from header or query parameter
  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  
  if (!apiKey) {
    return res.status(401).json({
      error: true,
      message: 'API key is required'
    });
  }
  
  // Validate API key
  if (!apiKeyManager.validateKey(apiKey)) {
    return res.status(401).json({
      error: true,
      message: 'Invalid or rate-limited API key'
    });
  }
  
  // API key is valid, proceed
  next();
};

module.exports = { apiKeyAuth };
