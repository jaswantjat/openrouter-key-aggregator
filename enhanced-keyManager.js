/**
 * Enhanced Key Manager for OpenRouter Key Aggregator
 * 
 * This module provides advanced key management capabilities:
 * - Detailed tracking of key metadata including credits and rate limits
 * - Sophisticated key selection algorithm based on multiple factors
 * - Automatic key rotation and failover
 * - Thread-safe operations for concurrent requests
 */

const NodeCache = require('node-cache');
const axios = require('axios');
const { Mutex } = require('async-mutex');

// Cache to store key usage data (in-memory)
const keyCache = new NodeCache({ stdTTL: 86400 }); // 24 hours TTL

// Mutex for thread-safe operations
const keyMutex = new Mutex();

/**
 * Key Manager class to handle API key rotation and usage tracking
 */
class KeyManager {
  constructor() {
    this.initializeKeys();

    // Reset counters at midnight
    this.scheduleCounterReset();
    
    // Schedule regular credit checks
    this.scheduleCreditChecks();
    
    // Set up monitoring
    this.setupMonitoring();
  }

  /**
   * Initialize API keys from environment variables
   */
  async initializeKeys() {
    const apiKeys = (process.env.OPENROUTER_API_KEYS || '').split(',').filter(Boolean);

    if (apiKeys.length === 0) {
      console.warn('No API keys found. Please add keys to your .env file.');
    }

    // Initialize key usage data
    for (const key of apiKeys) {
      if (!keyCache.has(key)) {
        // Initialize with default values
        keyCache.set(key, {
          // Usage tracking
          dailyCount: 0,
          minuteCount: 0,
          lastUsed: 0,
          errors: 0,
          
          // Status flags
          disabled: false,
          rateLimited: false,
          
          // Credit information
          credits: {
            available: null,
            total: null,
            lastChecked: null
          },
          
          // Rate limit information
          rateLimit: {
            remaining: null,
            resetAt: null,
            limit: null
          },
          
          // Model usage tracking
          modelUsage: {},
          
          // Performance metrics
          successCount: 0,
          failureCount: 0,
          averageResponseTime: 0,
          
          // Additional metadata
          tier: null, // 'free', 'paid', etc.
          lastCreditCheck: 0
        });
        
        // Try to fetch credit information
        try {
          await this.checkKeyCredits(key);
        } catch (error) {
          console.error(`Error checking credits for key ${key.substring(0, 4)}...: ${error.message}`);
        }
      }
    }

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
   * Schedule regular credit checks for all keys
   */
  scheduleCreditChecks() {
    // Check credits every hour
    setInterval(async () => {
      const keys = this.getAllKeys();
      console.log(`Checking credits for ${keys.length} keys`);
      
      for (const key of keys) {
        try {
          await this.checkKeyCredits(key);
        } catch (error) {
          console.error(`Error checking credits for key ${key.substring(0, 4)}...: ${error.message}`);
        }
      }
    }, 60 * 60 * 1000); // Every hour
  }
  
  /**
   * Set up monitoring for key pool health
   */
  setupMonitoring() {
    // Check key pool health every 5 minutes
    setInterval(() => {
      this.checkKeyPoolHealth();
    }, 5 * 60 * 1000);
  }
  
  /**
   * Check key pool health and send alerts if needed
   */
  checkKeyPoolHealth() {
    const keys = this.getAllKeys();
    const keyData = keys.map(key => keyCache.get(key)).filter(Boolean);
    
    // Calculate health metrics
    const totalKeys = keyData.length;
    const activeKeys = keyData.filter(k => !k.disabled && !k.rateLimited).length;
    const rateLimitedKeys = keyData.filter(k => k.rateLimited).length;
    const disabledKeys = keyData.filter(k => k.disabled).length;
    
    const healthPercentage = totalKeys > 0 ? (activeKeys / totalKeys) * 100 : 0;
    
    console.log(`[MONITOR] Key pool health: ${activeKeys}/${totalKeys} keys available (${healthPercentage.toFixed(1)}%)`);
    console.log(`[MONITOR] Rate limited: ${rateLimitedKeys}, Disabled: ${disabledKeys}`);
    
    // Send alerts if health is poor
    if (healthPercentage < 20) {
      this.sendAlert(`Low key pool health: ${activeKeys}/${totalKeys} keys available (${healthPercentage.toFixed(1)}%)`);
    }
    
    // Check for keys approaching daily limits
    const approachingLimitKeys = keyData.filter(k => !k.disabled && k.dailyCount > 180).length;
    if (approachingLimitKeys > 0) {
      console.log(`[MONITOR] ${approachingLimitKeys} keys approaching daily limit`);
    }
  }
  
  /**
   * Send an alert about key pool health
   */
  sendAlert(message) {
    console.error(`[ALERT] ${message}`);
    
    // In a production system, this would send an email, Slack message, etc.
    // For now, we just log it
  }

  /**
   * Reset daily counters for all keys
   */
  async resetDailyCounters() {
    // Acquire lock for thread safety
    const release = await keyMutex.acquire();
    
    try {
      const keys = this.getAllKeys();

      keys.forEach(key => {
        const keyData = keyCache.get(key);
        if (keyData) {
          keyData.dailyCount = 0;
          keyData.disabled = false;
          keyData.rateLimited = false;
          
          // Reset rate limit information
          keyData.rateLimit.remaining = keyData.credits.total >= 10 ? 1000 : 50;
          keyData.rateLimit.resetAt = new Date(Date.now() + 86400000); // 24 hours from now
          
          keyCache.set(key, keyData);
        }
      });

      console.log(`Reset daily counters for ${keys.length} keys`);
    } finally {
      // Always release the lock
      release();
    }
  }

  /**
   * Reset minute counters for all keys
   */
  async resetMinuteCounters() {
    // Acquire lock for thread safety
    const release = await keyMutex.acquire();
    
    try {
      const keys = this.getAllKeys();

      keys.forEach(key => {
        const keyData = keyCache.get(key);
        if (keyData) {
          keyData.minuteCount = 0;
          keyCache.set(key, keyData);
        }
      });
    } finally {
      // Always release the lock
      release();
    }
  }

  /**
   * Get all API keys
   */
  getAllKeys() {
    return (process.env.OPENROUTER_API_KEYS || '').split(',').filter(Boolean);
  }
  
  /**
   * Check credits for a specific key
   */
  async checkKeyCredits(key) {
    try {
      // Call OpenRouter API to get key info
      const response = await axios({
        method: 'GET',
        url: `${process.env.OPENROUTER_API_URL || 'https://openrouter.ai/api'}/v1/auth/key`,
        headers: {
          'Authorization': `Bearer ${key}`
        },
        timeout: 10000 // 10 second timeout
      });
      
      // Get existing key data
      const keyData = keyCache.get(key);
      if (!keyData) return;
      
      // Update credit information
      if (response.data && response.data.data) {
        const data = response.data.data;
        
        // Update credit information
        keyData.credits.total = data.limit || 0;
        keyData.credits.available = data.limit - data.usage || 0;
        keyData.credits.lastChecked = Date.now();
        
        // Determine tier based on credits
        keyData.tier = data.limit >= 10 ? 'paid' : 'free';
        
        // Update rate limit information
        keyData.rateLimit.limit = keyData.tier === 'paid' ? 1000 : 50;
        keyData.rateLimit.remaining = keyData.rateLimit.limit - keyData.dailyCount;
        
        // Update disabled status based on credits
        if (keyData.credits.available <= 0) {
          keyData.disabled = true;
          console.log(`Key ${key.substring(0, 4)}... disabled: no credits available`);
        }
        
        keyData.lastCreditCheck = Date.now();
        keyCache.set(key, keyData);
        
        console.log(`Updated credits for key ${key.substring(0, 4)}...: ${keyData.credits.available}/${keyData.credits.total} available`);
      }
    } catch (error) {
      console.error(`Error checking credits for key ${key.substring(0, 4)}...: ${error.message}`);
      
      // Record error but don't disable the key just for a credit check failure
      const keyData = keyCache.get(key);
      if (keyData) {
        keyData.lastCreditCheck = Date.now();
        keyCache.set(key, keyData);
      }
    }
  }

  /**
   * Get the next available API key with thread safety
   * @param {string} model - Optional model name to track usage
   */
  async getNextKey(model = null) {
    // Acquire lock for thread safety
    const release = await keyMutex.acquire();
    
    try {
      return this._getNextKeyInternal(model);
    } finally {
      // Always release the lock
      release();
    }
  }
  
  /**
   * Internal implementation of getNextKey (without thread safety)
   */
  _getNextKeyInternal(model = null) {
    const keys = this.getAllKeys();

    // Find the key with the lowest usage that isn't disabled or rate limited
    let selectedKey = null;
    let backupKey = null;
    
    // Scoring system for key selection
    const scoreKey = (keyData) => {
      if (!keyData) return -Infinity;
      
      // Base score starts with remaining daily requests
      let score = keyData.rateLimit.remaining || (keyData.tier === 'paid' ? 1000 : 50) - keyData.dailyCount;
      
      // Penalize keys that were used recently (for rate limit spacing)
      const timeSinceLastUse = Date.now() - (keyData.lastUsed || 0);
      if (timeSinceLastUse < 5500) {
        score -= 100; // Heavy penalty for keys used in the last 5.5 seconds
      }
      
      // Prefer keys with more available credits
      if (keyData.credits.available !== null) {
        score += keyData.credits.available * 0.1;
      }
      
      // Prefer keys with fewer errors
      score -= keyData.errors * 5;
      
      // Prefer keys with better performance
      if (keyData.averageResponseTime > 0) {
        score -= keyData.averageResponseTime / 100; // Small penalty for slower keys
      }
      
      // Prefer keys that have been successful with this model before
      if (model && keyData.modelUsage && keyData.modelUsage[model] && keyData.modelUsage[model].successCount > 0) {
        score += 10; // Bonus for keys that worked with this model
      }
      
      return score;
    };

    // Score and sort all keys
    const scoredKeys = keys
      .map(key => {
        const keyData = keyCache.get(key) || {
          dailyCount: 0,
          minuteCount: 0,
          lastUsed: 0,
          errors: 0,
          disabled: false,
          rateLimited: false,
          credits: { available: null, total: null },
          rateLimit: { remaining: null },
          modelUsage: {},
          tier: 'free'
        };
        
        return {
          key,
          data: keyData,
          score: scoreKey(keyData)
        };
      })
      .filter(item => !item.data.disabled) // Filter out disabled keys
      .sort((a, b) => b.score - a.score); // Sort by score (highest first)

    // Select the best key
    if (scoredKeys.length > 0) {
      const bestKey = scoredKeys[0];
      
      // If the best key was used recently, check if we should use it or wait
      const timeSinceLastUse = Date.now() - (bestKey.data.lastUsed || 0);
      
      if (timeSinceLastUse < 5500) {
        // This key was used recently, check if we have a backup
        if (scoredKeys.length > 1) {
          const secondBestKey = scoredKeys[1];
          const secondBestTimeSinceLastUse = Date.now() - (secondBestKey.data.lastUsed || 0);
          
          if (secondBestTimeSinceLastUse >= 5500) {
            // Second best key is available now, use it
            selectedKey = secondBestKey.key;
            console.log(`Using second best key ${selectedKey.substring(0, 4)}... (score: ${secondBestKey.score.toFixed(1)}) to avoid rate limiting`);
          } else {
            // Both best keys were used recently, use the best one anyway
            selectedKey = bestKey.key;
            console.log(`Using best key ${selectedKey.substring(0, 4)}... (score: ${bestKey.score.toFixed(1)}) despite recent use`);
          }
        } else {
          // Only one key available, use it despite recent use
          selectedKey = bestKey.key;
          console.log(`Using only available key ${selectedKey.substring(0, 4)}... (score: ${bestKey.score.toFixed(1)}) despite recent use`);
        }
      } else {
        // Best key is available now, use it
        selectedKey = bestKey.key;
        console.log(`Using best key ${selectedKey.substring(0, 4)}... (score: ${bestKey.score.toFixed(1)})`);
      }
    }

    if (!selectedKey) {
      // Check if we have any rate-limited keys that will reset soon
      const rateLimitedKeys = keys
        .map(key => {
          const keyData = keyCache.get(key);
          if (!keyData || keyData.disabled || !keyData.rateLimited) return null;
          
          return {
            key,
            resetAt: keyData.rateLimit.resetAt
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.resetAt - b.resetAt);
      
      if (rateLimitedKeys.length > 0) {
        const soonestReset = rateLimitedKeys[0];
        const timeUntilReset = soonestReset.resetAt - Date.now();
        
        if (timeUntilReset <= 0) {
          // This key should be reset now
          const keyData = keyCache.get(soonestReset.key);
          if (keyData) {
            keyData.rateLimited = false;
            keyCache.set(soonestReset.key, keyData);
            
            selectedKey = soonestReset.key;
            console.log(`Using previously rate-limited key ${selectedKey.substring(0, 4)}... that has reset`);
          }
        } else if (timeUntilReset < 10000) {
          // Key will reset in less than 10 seconds, wait for it
          console.log(`All keys rate limited, but one will reset in ${Math.ceil(timeUntilReset / 1000)} seconds`);
          
          // In a real implementation, we might wait or use a queue system
          // For now, we'll use the key anyway and let OpenRouter handle the rate limit
          selectedKey = soonestReset.key;
        }
      }
    }

    if (!selectedKey) {
      throw new Error('No available API keys. All keys have reached their limits or are disabled.');
    }

    // Update key metadata
    const keyData = keyCache.get(selectedKey);
    if (keyData) {
      keyData.lastUsed = Date.now();
      keyData.dailyCount += 1;
      keyData.minuteCount += 1;
      
      // Update rate limit information
      if (keyData.rateLimit.remaining !== null) {
        keyData.rateLimit.remaining -= 1;
      }
      
      // Initialize model usage if not exists
      if (!keyData.modelUsage[model]) {
        keyData.modelUsage[model] = {
          count: 0,
          successCount: 0,
          failureCount: 0,
          lastUsed: null
        };
      }
      
      // Update model usage
      if (model) {
        keyData.modelUsage[model].count += 1;
        keyData.modelUsage[model].lastUsed = Date.now();
      }
      
      keyCache.set(selectedKey, keyData);
      
      // Schedule minute counter reset after 60 seconds
      setTimeout(() => {
        const updatedKeyData = keyCache.get(selectedKey);
        if (updatedKeyData) {
          updatedKeyData.minuteCount = Math.max(0, updatedKeyData.minuteCount - 1);
          keyCache.set(selectedKey, updatedKeyData);
        }
      }, 60000);
    }

    return selectedKey;
  }

  /**
   * Increment usage counter for a key with thread safety
   * @param {string} key - The API key
   * @param {string} model - The model used (optional)
   * @param {object} metrics - Optional performance metrics
   */
  async incrementKeyUsage(key, model = null, metrics = null) {
    // Acquire lock for thread safety
    const release = await keyMutex.acquire();
    
    try {
      const keyData = keyCache.get(key) || {
        dailyCount: 0,
        minuteCount: 0,
        lastUsed: 0,
        errors: 0,
        disabled: false,
        rateLimited: false,
        credits: { available: null, total: null },
        rateLimit: { remaining: null },
        modelUsage: {},
        successCount: 0,
        failureCount: 0,
        averageResponseTime: 0,
        tier: 'free'
      };

      // Update success metrics
      keyData.successCount += 1;
      
      // Update response time metrics if provided
      if (metrics && metrics.responseTime) {
        if (keyData.averageResponseTime === 0) {
          keyData.averageResponseTime = metrics.responseTime;
        } else {
          // Weighted average (90% old, 10% new)
          keyData.averageResponseTime = (keyData.averageResponseTime * 0.9) + (metrics.responseTime * 0.1);
        }
      }
      
      // Update token usage if provided
      if (metrics && metrics.tokenUsage) {
        // Deduct from available credits (approximate)
        if (keyData.credits.available !== null) {
          const tokenCost = metrics.tokenUsage / 1000000; // Convert to millions
          keyData.credits.available = Math.max(0, keyData.credits.available - tokenCost);
        }
      }

      // Track model-specific usage if model is provided
      if (model) {
        if (!keyData.modelUsage[model]) {
          keyData.modelUsage[model] = {
            count: 0,
            successCount: 0,
            failureCount: 0,
            lastUsed: null
          };
        }
        
        keyData.modelUsage[model].successCount += 1;
      }

      keyCache.set(key, keyData);

      // Log usage for monitoring
      console.log(`Key ${key.substring(0, 4)}... used successfully: ${keyData.dailyCount}/200 daily, ${keyData.minuteCount} in last minute${model ? `, model: ${model}` : ''}`);
    } finally {
      // Always release the lock
      release();
    }
  }

  /**
   * Record an error for a key with thread safety
   * @param {string} key - The API key
   * @param {string} errorType - Type of error (e.g., 'rate_limit', 'authentication', 'server')
   * @param {string} model - The model used (optional)
   */
  async recordKeyError(key, errorType = 'unknown', model = null) {
    // Acquire lock for thread safety
    const release = await keyMutex.acquire();
    
    try {
      const keyData = keyCache.get(key);

      if (keyData) {
        keyData.errors += 1;
        keyData.failureCount += 1;

        // Handle specific error types
        if (errorType === 'rate_limit') {
          keyData.rateLimited = true;
          
          // Set reset time based on tier
          const resetTime = keyData.tier === 'paid' ? 60000 : 300000; // 1 minute for paid, 5 minutes for free
          keyData.rateLimit.resetAt = new Date(Date.now() + resetTime);
          
          console.log(`Key ${key.substring(0, 4)}... rate limited, will reset at ${keyData.rateLimit.resetAt.toISOString()}`);
        } else if (errorType === 'authentication') {
          // Disable key on authentication errors
          keyData.disabled = true;
          console.log(`Key ${key.substring(0, 4)}... disabled due to authentication error`);
        } else if (errorType === 'server') {
          // Don't disable for server errors, but record them
          console.log(`Key ${key.substring(0, 4)}... encountered server error`);
        }

        // Disable key if it has too many errors
        if (keyData.errors >= 5) {
          keyData.disabled = true;
          console.log(`Key ${key.substring(0, 4)}... disabled due to too many errors (${keyData.errors})`);
        }
        
        // Track model-specific failures
        if (model && keyData.modelUsage[model]) {
          keyData.modelUsage[model].failureCount += 1;
        }

        keyCache.set(key, keyData);
      }
    } finally {
      // Always release the lock
      release();
    }
  }
  
  /**
   * Mark a key as rate limited with thread safety
   * @param {string} key - The API key
   * @param {number} resetTimeMs - Time until reset in milliseconds (default: 60000)
   */
  async markKeyRateLimited(key, resetTimeMs = 60000) {
    // Acquire lock for thread safety
    const release = await keyMutex.acquire();
    
    try {
      const keyData = keyCache.get(key);

      if (keyData) {
        keyData.rateLimited = true;
        keyData.rateLimit.resetAt = new Date(Date.now() + resetTimeMs);
        
        keyCache.set(key, keyData);
        
        console.log(`Key ${key.substring(0, 4)}... marked as rate limited, will reset at ${keyData.rateLimit.resetAt.toISOString()}`);
      }
    } finally {
      // Always release the lock
      release();
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
        rateLimited: false,
        credits: { available: null, total: null },
        rateLimit: { remaining: null, resetAt: null },
        modelUsage: {},
        successCount: 0,
        failureCount: 0,
        averageResponseTime: 0,
        tier: 'free'
      };

      // Mask the actual key for security
      const maskedKey = `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;

      // Calculate time since last use
      const timeSinceLastUse = keyData.lastUsed ? Math.floor((Date.now() - keyData.lastUsed) / 1000) : null;
      
      // Calculate time until rate limit reset
      let timeUntilReset = null;
      if (keyData.rateLimited && keyData.rateLimit.resetAt) {
        timeUntilReset = Math.max(0, Math.floor((keyData.rateLimit.resetAt - Date.now()) / 1000));
      }

      stats.push({
        key: maskedKey,
        dailyCount: keyData.dailyCount,
        minuteCount: keyData.minuteCount,
        lastUsed: keyData.lastUsed ? new Date(keyData.lastUsed).toISOString() : null,
        timeSinceLastUse: timeSinceLastUse ? `${timeSinceLastUse}s ago` : 'never',
        errors: keyData.errors,
        disabled: keyData.disabled,
        rateLimited: keyData.rateLimited,
        timeUntilReset: timeUntilReset ? `${timeUntilReset}s` : null,
        dailyRemaining: keyData.rateLimit.remaining !== null ? keyData.rateLimit.remaining : (keyData.tier === 'paid' ? 1000 : 50) - keyData.dailyCount,
        credits: {
          available: keyData.credits.available,
          total: keyData.credits.total,
          lastChecked: keyData.credits.lastChecked ? new Date(keyData.credits.lastChecked).toISOString() : null
        },
        tier: keyData.tier,
        performance: {
          successRate: keyData.successCount + keyData.failureCount > 0 
            ? (keyData.successCount / (keyData.successCount + keyData.failureCount) * 100).toFixed(1) + '%' 
            : 'N/A',
          averageResponseTime: keyData.averageResponseTime > 0 
            ? `${keyData.averageResponseTime.toFixed(0)}ms` 
            : 'N/A'
        },
        modelUsage: Object.entries(keyData.modelUsage).map(([model, usage]) => ({
          model,
          count: usage.count,
          successRate: usage.count > 0 
            ? (usage.successCount / usage.count * 100).toFixed(1) + '%' 
            : 'N/A',
          lastUsed: usage.lastUsed ? new Date(usage.lastUsed).toISOString() : null
        })),
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

    if (keyData.rateLimited) {
      return 'rate-limited';
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
