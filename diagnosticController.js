/**
 * Diagnostic Controller for OpenRouter Key Aggregator
 * 
 * This controller provides endpoints for diagnosing authentication
 * and connection issues.
 */

/**
 * Handle diagnostic requests
 */
const handleDiagnostic = (req, res) => {
  console.log(`[DIAGNOSTIC] Diagnostic endpoint called with method: ${req.method}`);
  
  // Create a safe version of headers (redacting sensitive information)
  const safeHeaders = {};
  Object.keys(req.headers).forEach(key => {
    if (!['authorization', 'x-api-key', 'openai-api-key'].includes(key.toLowerCase())) {
      safeHeaders[key] = req.headers[key];
    } else {
      const value = req.headers[key];
      if (typeof value === 'string' && value.length > 8) {
        safeHeaders[key] = `${value.substring(0, 4)}...${value.substring(value.length - 4)}`;
      } else {
        safeHeaders[key] = '[REDACTED]';
      }
    }
  });
  
  // Create diagnostic information
  const diagnosticInfo = {
    timestamp: new Date().toISOString(),
    request: {
      method: req.method,
      path: req.path,
      headers: safeHeaders,
      query: req.query,
      body: req.method === 'POST' ? '[REDACTED]' : undefined
    },
    server: {
      version: process.env.npm_package_version || 'unknown',
      node: process.version,
      environment: process.env.NODE_ENV || 'development'
    },
    authentication: {
      status: req.apiKey ? 'authenticated' : 'unauthenticated',
      method: getAuthMethod(req)
    }
  };
  
  // Return diagnostic information
  return res.json({
    status: 'success',
    message: 'Diagnostic information',
    data: diagnosticInfo
  });
};

/**
 * Determine the authentication method used
 */
const getAuthMethod = (req) => {
  if (req.headers['x-api-key'] || req.headers['X-API-Key'] || req.headers['x-api-key']) {
    return 'x-api-key header';
  } else if (req.headers['openai-api-key']) {
    return 'openai-api-key header';
  } else if (req.headers['authorization-header']) {
    return 'authorization-header header';
  } else if (req.headers['authorization']) {
    return req.headers['authorization'].startsWith('Bearer ') ? 
      'authorization header with Bearer prefix' : 
      'authorization header without Bearer prefix';
  } else {
    return 'none';
  }
};

/**
 * Handle authentication test requests
 */
const handleAuthTest = (req, res) => {
  console.log(`[DIAGNOSTIC] Auth test endpoint called with method: ${req.method}`);
  
  // This endpoint is protected by the authentication middleware,
  // so if we get here, authentication was successful
  return res.json({
    status: 'success',
    message: 'Authentication successful',
    data: {
      authenticated: true,
      apiKey: req.apiKey ? `${req.apiKey.substring(0, 4)}...${req.apiKey.substring(req.apiKey.length - 4)}` : null,
      authMethod: getAuthMethod(req),
      timestamp: new Date().toISOString()
    }
  });
};

module.exports = {
  handleDiagnostic,
  handleAuthTest
};
