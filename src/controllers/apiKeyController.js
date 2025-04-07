const apiKeyManager = require('../utils/apiKeyManager');

/**
 * Generate a new API key
 */
const generateApiKey = (req, res) => {
  const { name, rateLimit } = req.body;
  
  if (!name) {
    return res.status(400).json({
      error: true,
      message: 'Name is required'
    });
  }
  
  const apiKey = apiKeyManager.generateKey(name, rateLimit);
  
  res.json({
    success: true,
    message: 'API key generated successfully',
    data: apiKey
  });
};

/**
 * Get all API keys
 */
const getApiKeys = (req, res) => {
  const keys = apiKeyManager.getAllKeys();
  
  res.json({
    success: true,
    count: keys.length,
    data: keys
  });
};

/**
 * Revoke an API key
 */
const revokeApiKey = (req, res) => {
  const { key } = req.params;
  
  if (!key) {
    return res.status(400).json({
      error: true,
      message: 'Key is required'
    });
  }
  
  const success = apiKeyManager.revokeKey(key);
  
  if (success) {
    res.json({
      success: true,
      message: 'API key revoked successfully'
    });
  } else {
    res.status(404).json({
      error: true,
      message: 'API key not found'
    });
  }
};

/**
 * Export API keys as environment variable string
 */
const exportApiKeys = (req, res) => {
  const keysString = apiKeyManager.exportKeys();
  
  res.json({
    success: true,
    message: 'API keys exported successfully',
    data: {
      environmentVariable: 'CLIENT_API_KEYS',
      value: keysString
    }
  });
};

module.exports = {
  generateApiKey,
  getApiKeys,
  revokeApiKey,
  exportApiKeys
};
