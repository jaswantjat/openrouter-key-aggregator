/**
 * OpenAI-Compatible Authentication Middleware for OpenRouter Key Aggregator
 * 
 * This middleware ensures compatibility with the OpenAI API specification
 * and handles authentication according to OpenAI's documentation.
 */
const apiKeyManager = require('../utils/apiKeyManager');

/**
 * Authentication middleware that follows OpenAI's authentication patterns
 */
const authenticateOpenAI = (req, res, next) => {
  console.log(`[AUTH] Authenticating OpenAI-compatible request to ${req.path}`);
  
  // Extract API key following OpenAI's authentication patterns
  // OpenAI primarily uses Bearer token authentication
  let apiKey = null;
  
  // 1. Check Authorization header with Bearer prefix (OpenAI's primary method)
  if (req.headers['authorization'] && req.headers['authorization'].startsWith('Bearer ')) {
    apiKey = req.headers['authorization'].substring(7); // Remove 'Bearer ' prefix
    console.log(`[AUTH] Found API key in Authorization header with Bearer prefix`);
  } 
  // 2. Check for OpenAI-API-Key header (alternative method)
  else if (req.headers['openai-api-key']) {
    apiKey = req.headers['openai-api-key'];
    console.log(`[AUTH] Found API key in openai-api-key header`);
  }
  // 3. Check for api-key header (alternative method)
  else if (req.headers['api-key']) {
    apiKey = req.headers['api-key'];
    console.log(`[AUTH] Found API key in api-key header`);
  }
  // 4. Check for x-api-key header (our custom method)
  else if (req.headers['x-api-key']) {
    apiKey = req.headers['x-api-key'];
    console.log(`[AUTH] Found API key in x-api-key header`);
  }
  
  // Log authentication attempt (masking the key for security)
  if (apiKey) {
    const maskedKey = `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`;
    console.log(`[AUTH] Using API key: ${maskedKey}`);
  } else {
    console.log(`[AUTH] No API key found in headers`);
    // Log all headers for debugging (excluding sensitive values)
    const safeHeaders = {};
    Object.keys(req.headers).forEach(key => {
      if (!['authorization', 'x-api-key', 'openai-api-key', 'api-key'].includes(key.toLowerCase())) {
        safeHeaders[key] = req.headers[key];
      } else {
        safeHeaders[key] = '[REDACTED]';
      }
    });
    console.log(`[AUTH] Available headers: ${JSON.stringify(safeHeaders)}`);
  }

  // Check if API key is provided
  if (!apiKey) {
    console.log(`[AUTH] Authentication failed: No API key provided`);
    return res.status(401).json({
      error: {
        message: 'No auth credentials found',
        code: 401,
        type: 'authentication_error',
        param: null
      }
    });
  }

  // Validate API key format
  if (!apiKeyManager.validateKey(apiKey)) {
    console.log(`[AUTH] Authentication failed: Invalid API key format`);
    return res.status(401).json({
      error: {
        message: 'Invalid API key format',
        code: 401,
        type: 'authentication_error',
        param: null
      }
    });
  }

  // Check if API key is valid
  if (!apiKeyManager.isValidKey(apiKey)) {
    console.log(`[AUTH] Authentication failed: Invalid API key`);
    return res.status(401).json({
      error: {
        message: 'Invalid API key',
        code: 401,
        type: 'authentication_error',
        param: null
      }
    });
  }

  // Authentication successful
  console.log(`[AUTH] Authentication successful`);
  
  // Add API key to request for use in downstream handlers
  req.apiKey = apiKey;
  
  // Continue to next middleware
  next();
};

module.exports = authenticateOpenAI;
