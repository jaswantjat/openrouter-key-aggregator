/**
 * Enhanced Authentication Middleware for OpenRouter Key Aggregator
 * 
 * This middleware handles multiple authentication header formats to ensure
 * compatibility with various clients, including n8n.
 */
const apiKeyManager = require('../utils/apiKeyManager');

/**
 * Authentication middleware that checks for API keys in various header formats
 */
const authenticate = (req, res, next) => {
  console.log(`[AUTH] Authenticating request to ${req.path}`);
  console.log(`[AUTH] Headers: ${JSON.stringify(Object.keys(req.headers))}`);
  
  // Extract API key from various possible header formats
  const apiKey = 
    // Standard header (case insensitive)
    req.headers['x-api-key'] || 
    req.headers['X-API-Key'] || 
    req.headers['x-api-key'] ||
    
    // OpenAI-style headers
    req.headers['openai-api-key'] ||
    req.headers['authorization-header'] ||
    
    // Authorization header (with or without Bearer prefix)
    (req.headers['authorization'] ? req.headers['authorization'].replace('Bearer ', '') : null);
  
  // Log authentication attempt (masking the key for security)
  if (apiKey) {
    const maskedKey = `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`;
    console.log(`[AUTH] Found API key: ${maskedKey}`);
  } else {
    console.log(`[AUTH] No API key found in headers`);
    // Log all headers for debugging (excluding sensitive values)
    const safeHeaders = {};
    Object.keys(req.headers).forEach(key => {
      if (!['authorization', 'x-api-key', 'openai-api-key'].includes(key.toLowerCase())) {
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
        code: 401
      }
    });
  }

  // Validate API key format
  if (!apiKeyManager.validateKey(apiKey)) {
    console.log(`[AUTH] Authentication failed: Invalid API key format`);
    return res.status(401).json({
      error: {
        message: 'Invalid API key format',
        code: 401
      }
    });
  }

  // Check if API key is valid
  if (!apiKeyManager.isValidKey(apiKey)) {
    console.log(`[AUTH] Authentication failed: Invalid API key`);
    return res.status(401).json({
      error: {
        message: 'Invalid API key',
        code: 401
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

module.exports = authenticate;
