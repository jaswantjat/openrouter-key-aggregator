const NodeCache = require('node-cache');

// Cache to store key usage data (in-memory)
const keyCache = new NodeCache({ stdTTL: 86400 }); // 24 hours TTL

/**
 * Key Manager class to handle API key rotation and usage tracking
 */
class KeyManager {
  constructor() {
    this.initializeKeys();

    // Reset counters at midnight
    this.scheduleCounterReset();
  }

  /**
   * Initialize API keys from environment variables
   */
  initializeKeys() {
    const apiKeys = (process.env.OPENROUTER_API_KEYS || '').split(',').filter(Boolean);

    if (apiKeys.length === 0) {
      console.warn('No API keys found. Please add keys to your .env file.');
    }

    // Initialize key usage data
    apiKeys.forEach(key => {
      if (!keyCache.has(key)) {
        keyCache.set(key, {
          dailyCount: 0,
          minuteCount: 0,
          lastUsed: 0,
          errors: 0,
          disabled: false
        });
      }
    });

    console.log(`Initialized ${apiKeys.length} API keys`);
  }

  /**
   * Schedule daily counter reset at midnight
   */
  scheduleCounterReset() {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);

    const timeUntilMidnight = midnight - now;

    setTimeout(() => {
      this.resetDailyCounters();
      this.scheduleCounterReset(); // Schedule next reset
    }, timeUntilMidnight);

    console.log(`Scheduled counter reset in ${Math.floor(timeUntilMidnight / 1000 / 60)} minutes`);
  }

  /**
   * Reset daily counters for all keys
   */
  resetDailyCounters() {
    const keys = this.getAllKeys();

    keys.forEach(key => {
      const keyData = keyCache.get(key);
      if (keyData) {
        keyData.dailyCount = 0;
        keyData.disabled = false;
        keyCache.set(key, keyData);
      }
    });

    console.log(`Reset daily counters for ${keys.length} keys`);
  }

  /**
   * Reset minute counters for all keys
   */
  resetMinuteCounters() {
    const keys = this.getAllKeys();

    keys.forEach(key => {
      const keyData = keyCache.get(key);
      if (keyData) {
        keyData.minuteCount = 0;
        keyCache.set(key, keyData);
      }
    });
  }

  /**
   * Get all API keys
   */
  getAllKeys() {
    return (process.env.OPENROUTER_API_KEYS || '').split(',').filter(Boolean);
  }

  /**
   * Get the next available API key
   */
  getNextKey() {
    const keys = this.getAllKeys();

    // Find the key with the lowest usage that isn't disabled
    let selectedKey = null;
    let lowestCount = Infinity;
    let backupKey = null;
    let backupCount = Infinity;

    const now = Date.now();

    for (const key of keys) {
      const keyData = keyCache.get(key) || {
        dailyCount: 0,
        minuteCount: 0,
        lastUsed: 0,
        errors: 0,
        disabled: false,
        modelUsage: {}
      };

      if (keyData.disabled) continue;

      // Check if key has reached daily limit (195 requests to be safe)
      if (keyData.dailyCount >= 195) {
        keyData.disabled = true;
        keyCache.set(key, keyData);
        console.log(`Key ${key.substring(0, 4)}... disabled: reached daily limit`);
        continue;
      }

      // Check if key was used in the last 5.5 seconds (OpenRouter rate limit)
      const timeSinceLastUse = now - keyData.lastUsed;

      // If the key was used recently, keep it as a backup option
      if (timeSinceLastUse < 5500) {
        // This key was used recently, but save it as a backup if it's better than current backup
        if (keyData.dailyCount < backupCount) {
          backupCount = keyData.dailyCount;
          backupKey = key;
        }
        continue;
      }

      // Select key with lowest daily count
      if (keyData.dailyCount < lowestCount) {
        lowestCount = keyData.dailyCount;
        selectedKey = key;
      }
    }

    // If no ideal key found, use the backup key
    if (!selectedKey && backupKey) {
      console.log(`Using backup key ${backupKey.substring(0, 4)}... due to rate limiting`);
      selectedKey = backupKey;
    }

    if (!selectedKey) {
      throw new Error('No available API keys. All keys have reached their limits or are disabled.');
    }

    // Log key selection for debugging
    const keyData = keyCache.get(selectedKey);
    console.log(`Selected key ${selectedKey.substring(0, 4)}... with ${keyData.dailyCount} daily uses`);

    return selectedKey;
  }

  /**
   * Increment usage counter for a key
   * @param {string} key - The API key
   * @param {string} model - The model used (optional)
   */
  incrementKeyUsage(key, model = null) {
    const keyData = keyCache.get(key) || {
      dailyCount: 0,
      minuteCount: 0,
      lastUsed: 0,
      errors: 0,
      disabled: false,
      modelUsage: {}
    };

    // Increment general counters
    keyData.dailyCount += 1;
    keyData.minuteCount += 1;
    keyData.lastUsed = Date.now();

    // Track model-specific usage if model is provided
    if (model) {
      if (!keyData.modelUsage) {
        keyData.modelUsage = {};
      }
      keyData.modelUsage[model] = (keyData.modelUsage[model] || 0) + 1;
    }

    keyCache.set(key, keyData);

    // Log usage for monitoring
    console.log(`Key ${key.substring(0, 4)}... used: ${keyData.dailyCount}/200 daily, ${keyData.minuteCount} in last minute${model ? `, model: ${model}` : ''}`);

    // Schedule minute counter reset after 60 seconds
    setTimeout(() => {
      const updatedKeyData = keyCache.get(key);
      if (updatedKeyData) {
        updatedKeyData.minuteCount = Math.max(0, updatedKeyData.minuteCount - 1);
        keyCache.set(key, updatedKeyData);
      }
    }, 60000);
  }

  /**
   * Record an error for a key
   */
  recordKeyError(key) {
    const keyData = keyCache.get(key);

    if (keyData) {
      keyData.errors += 1;

      // Disable key if it has too many errors
      if (keyData.errors >= 5) {
        keyData.disabled = true;
      }

      keyCache.set(key, keyData);
    }
  }

  /**
   * Get usage statistics for all keys
   */
  getKeyStats() {
    const keys = this.getAllKeys();
    const stats = [];

    keys.forEach(key => {
      const keyData = keyCache.get(key) || {
        dailyCount: 0,
        minuteCount: 0,
        lastUsed: 0,
        errors: 0,
        disabled: false,
        modelUsage: {}
      };

      // Mask the actual key for security
      const maskedKey = `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;

      // Calculate time since last use
      const timeSinceLastUse = keyData.lastUsed ? Math.floor((Date.now() - keyData.lastUsed) / 1000) : null;

      stats.push({
        key: maskedKey,
        dailyCount: keyData.dailyCount,
        minuteCount: keyData.minuteCount,
        lastUsed: keyData.lastUsed ? new Date(keyData.lastUsed).toISOString() : null,
        timeSinceLastUse: timeSinceLastUse ? `${timeSinceLastUse}s ago` : 'never',
        errors: keyData.errors,
        disabled: keyData.disabled,
        dailyRemaining: 200 - keyData.dailyCount,
        modelUsage: keyData.modelUsage || {},
        status: this.getKeyStatus(keyData)
      });
    });

    return stats;
  }

  /**
   * Get the status of a key
   */
  getKeyStatus(keyData) {
    if (keyData.disabled) {
      return 'disabled';
    }

    if (keyData.dailyCount >= 195) {
      return 'limit-reached';
    }

    if (Date.now() - keyData.lastUsed < 5500) {
      return 'cooling-down';
    }

    return 'available';
  }
}

// Export singleton instance
module.exports = new KeyManager();
