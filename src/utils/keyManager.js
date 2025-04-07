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
    
    for (const key of keys) {
      const keyData = keyCache.get(key);
      
      if (!keyData) continue;
      if (keyData.disabled) continue;
      
      // Check if key has reached daily limit (200 requests)
      if (keyData.dailyCount >= 200) {
        keyData.disabled = true;
        keyCache.set(key, keyData);
        continue;
      }
      
      // Check if key has reached minute limit (20 requests)
      if (keyData.minuteCount >= 20) {
        continue;
      }
      
      // Check if key was used in the last 5 seconds
      const now = Date.now();
      if (now - keyData.lastUsed < 5000) {
        continue;
      }
      
      // Select key with lowest daily count
      if (keyData.dailyCount < lowestCount) {
        lowestCount = keyData.dailyCount;
        selectedKey = key;
      }
    }
    
    if (!selectedKey) {
      throw new Error('No available API keys. All keys have reached their limits or are disabled.');
    }
    
    return selectedKey;
  }
  
  /**
   * Increment usage counter for a key
   */
  incrementKeyUsage(key) {
    const keyData = keyCache.get(key);
    
    if (keyData) {
      keyData.dailyCount += 1;
      keyData.minuteCount += 1;
      keyData.lastUsed = Date.now();
      
      keyCache.set(key, keyData);
      
      // Schedule minute counter reset after 60 seconds
      setTimeout(() => {
        const updatedKeyData = keyCache.get(key);
        if (updatedKeyData) {
          updatedKeyData.minuteCount = Math.max(0, updatedKeyData.minuteCount - 1);
          keyCache.set(key, updatedKeyData);
        }
      }, 60000);
    }
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
        disabled: false
      };
      
      // Mask the actual key for security
      const maskedKey = `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
      
      stats.push({
        key: maskedKey,
        dailyCount: keyData.dailyCount,
        minuteCount: keyData.minuteCount,
        lastUsed: keyData.lastUsed ? new Date(keyData.lastUsed).toISOString() : null,
        errors: keyData.errors,
        disabled: keyData.disabled,
        dailyRemaining: 200 - keyData.dailyCount
      });
    });
    
    return stats;
  }
}

// Export singleton instance
module.exports = new KeyManager();
