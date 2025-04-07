const crypto = require('crypto');
const NodeCache = require('node-cache');

// Cache to store API keys (in-memory)
const apiKeyCache = new NodeCache({ stdTTL: 0 }); // No expiration by default

/**
 * API Key Manager class to handle client API key generation and validation
 */
class ApiKeyManager {
  constructor() {
    this.initializeKeys();
  }

  /**
   * Initialize API keys from environment variables
   */
  initializeKeys() {
    // Load existing API keys from environment variable if available
    const existingKeys = (process.env.CLIENT_API_KEYS || '').split(',').filter(Boolean);

    existingKeys.forEach(keyString => {
      try {
        // Format should be "name:key:rateLimit"
        const [name, key, rateLimit] = keyString.split(':');
        if (name && key) {
          apiKeyCache.set(key, {
            name,
            rateLimit: parseInt(rateLimit) || 0, // 0 means unlimited
            requests: 0,
            lastUsed: null,
            created: new Date().toISOString()
          });
        }
      } catch (error) {
        console.error(`Error parsing API key: ${error.message}`);
      }
    });

    // Add test key for development
    const testKey = '076b883862ef9163161e6ec19a376e68';
    apiKeyCache.set(testKey, {
      name: 'Test Key',
      rateLimit: 0,
      requests: 0,
      lastUsed: null,
      created: new Date().toISOString()
    });

    console.log(`Initialized ${apiKeyCache.keys().length} client API keys`);
  }

  /**
   * Generate a new API key
   * @param {string} name - Name or description of the key
   * @param {number} rateLimit - Optional rate limit (requests per minute, 0 for unlimited)
   * @returns {Object} - The generated API key info
   */
  generateKey(name, rateLimit = 0) {
    // Generate a random API key
    const key = crypto.randomBytes(24).toString('hex');

    // Store key info
    apiKeyCache.set(key, {
      name,
      rateLimit: parseInt(rateLimit) || 0,
      requests: 0,
      lastUsed: null,
      created: new Date().toISOString()
    });

    return {
      name,
      key,
      rateLimit,
      created: new Date().toISOString()
    };
  }

  /**
   * Validate an API key
   * @param {string} key - The API key to validate
   * @returns {boolean} - Whether the key is valid
   */
  validateKey(key) {
    const keyInfo = apiKeyCache.get(key);

    if (!keyInfo) {
      return false;
    }

    // Check rate limit if applicable
    if (keyInfo.rateLimit > 0) {
      const now = Date.now();

      // If the key was used in the last minute, check the rate limit
      if (keyInfo.lastUsed && now - keyInfo.lastUsed < 60000) {
        if (keyInfo.requests >= keyInfo.rateLimit) {
          return false;
        }
      } else {
        // Reset counter if it's been more than a minute
        keyInfo.requests = 0;
      }
    }

    // Update usage stats
    keyInfo.requests += 1;
    keyInfo.lastUsed = Date.now();
    apiKeyCache.set(key, keyInfo);

    return true;
  }

  /**
   * Revoke an API key
   * @param {string} key - The API key to revoke
   * @returns {boolean} - Whether the key was successfully revoked
   */
  revokeKey(key) {
    if (apiKeyCache.has(key)) {
      apiKeyCache.del(key);
      return true;
    }
    return false;
  }

  /**
   * Get all API keys (with masked key values for security)
   * @returns {Array} - List of API keys with their info
   */
  getAllKeys() {
    const keys = apiKeyCache.keys();

    return keys.map(key => {
      const keyInfo = apiKeyCache.get(key);
      // Mask the key for security
      const maskedKey = `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;

      return {
        name: keyInfo.name,
        key: maskedKey,
        rateLimit: keyInfo.rateLimit,
        requests: keyInfo.requests,
        lastUsed: keyInfo.lastUsed ? new Date(keyInfo.lastUsed).toISOString() : null,
        created: keyInfo.created
      };
    });
  }

  /**
   * Export keys as a string for environment variable
   * @returns {string} - Comma-separated string of keys
   */
  exportKeys() {
    const keys = apiKeyCache.keys();

    return keys.map(key => {
      const keyInfo = apiKeyCache.get(key);
      return `${keyInfo.name}:${key}:${keyInfo.rateLimit}`;
    }).join(',');
  }
}

// Export singleton instance
module.exports = new ApiKeyManager();
