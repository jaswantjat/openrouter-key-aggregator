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
  // 4. OpenAI SDK style headers
  let apiKey = null;

  // Log all headers for debugging
  console.log(`[DEBUG] Auth headers: ${JSON.stringify(req.headers)}`);

  // Check for x-api-key header (case insensitive)
  const headerKeys = Object.keys(req.headers);
  const apiKeyHeader = headerKeys.find(key => key.toLowerCase() === 'x-api-key');
  if (apiKeyHeader) {
    apiKey = req.headers[apiKeyHeader];
    console.log(`[DEBUG] Found API key in x-api-key header: ${apiKey.substring(0, 4)}...`);
  }

  // Check for authorization header with Bearer prefix
  if (!apiKey && req.headers.authorization) {
    // Handle both 'Bearer sk-123' and just 'sk-123' formats
    if (req.headers.authorization.startsWith('Bearer ')) {
      apiKey = req.headers.authorization.substring(7);
    } else {
      apiKey = req.headers.authorization;
    }
    console.log(`[DEBUG] Found API key in authorization header: ${apiKey.substring(0, 4)}...`);
  }

  // Check for OpenAI SDK style headers (n8n often uses this)
  if (!apiKey && req.headers['openai-api-key']) {
    apiKey = req.headers['openai-api-key'];
    console.log(`[DEBUG] Found API key in openai-api-key header: ${apiKey.substring(0, 4)}...`);
  }

  // Check for query parameter
  if (!apiKey && req.query.api_key) {
    apiKey = req.query.api_key;
    console.log(`[DEBUG] Found API key in query parameter: ${apiKey.substring(0, 4)}...`);
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
