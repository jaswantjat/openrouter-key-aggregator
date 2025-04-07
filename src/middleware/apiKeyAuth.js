const apiKeyManager = require('../utils/apiKeyManager');

/**
 * API Key authentication middleware
 */
const apiKeyAuth = (req, res, next) => {
  // Skip authentication if disabled
  if (process.env.API_KEY_AUTH_ENABLED !== 'true') {
    return next();
  }

  // Get API key from various possible locations
  // 1. x-api-key header (case insensitive)
  // 2. authorization header with Bearer prefix
  // 3. query parameter
  let apiKey = null;

  // Check for x-api-key header (case insensitive)
  const headerKeys = Object.keys(req.headers);
  const apiKeyHeader = headerKeys.find(key => key.toLowerCase() === 'x-api-key');
  if (apiKeyHeader) {
    apiKey = req.headers[apiKeyHeader];
  }

  // Check for authorization header with Bearer prefix
  if (!apiKey && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    apiKey = req.headers.authorization.substring(7);
  }

  // Check for query parameter
  if (!apiKey && req.query.api_key) {
    apiKey = req.query.api_key;
  }

  if (!apiKey) {
    return res.status(401).json({
      error: {
        message: 'API key is required',
        type: 'authentication_error',
        param: null,
        code: 'invalid_api_key'
      }
    });
  }

  // Validate API key
  if (!apiKeyManager.validateKey(apiKey)) {
    return res.status(401).json({
      error: {
        message: 'Invalid or rate-limited API key',
        type: 'authentication_error',
        param: null,
        code: 'invalid_api_key'
      }
    });
  }

  // API key is valid, proceed
  next();
};

module.exports = { apiKeyAuth };
