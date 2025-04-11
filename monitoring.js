/**
 * Monitoring Module for OpenRouter Key Aggregator
 * 
 * This module provides monitoring and alerting capabilities:
 * - Key pool health monitoring
 * - Usage pattern detection
 * - Alerting for low capacity or unusual usage
 */

const keyManager = require('./utils/keyManager');

// Configuration
const LOW_CAPACITY_THRESHOLD = 0.2; // 20% of keys remaining
const HIGH_USAGE_THRESHOLD = 0.8; // 80% of daily limit
const MONITORING_INTERVAL = 5 * 60 * 1000; // 5 minutes
const UNUSUAL_USAGE_THRESHOLD = 20; // 20 requests in 5 minutes is unusual for a single key

// State
let alertSent = {
  lowCapacity: false,
  unusualUsage: false,
  highUsage: false
};

/**
 * Initialize monitoring
 */
function initializeMonitoring() {
  console.log(`[MONITOR] Initializing monitoring system`);
  
  // Set up regular monitoring checks
  setInterval(checkKeyPoolHealth, MONITORING_INTERVAL);
  
  // Set up daily reset of alert state
  scheduleAlertReset();
}

/**
 * Schedule daily reset of alert state at midnight
 */
function scheduleAlertReset() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);

  const timeUntilMidnight = midnight - now;

  setTimeout(() => {
    resetAlertState();
    scheduleAlertReset(); // Schedule next reset
  }, timeUntilMidnight);

  console.log(`[MONITOR] Scheduled alert state reset in ${Math.floor(timeUntilMidnight / 1000 / 60)} minutes`);
}

/**
 * Reset alert state
 */
function resetAlertState() {
  alertSent = {
    lowCapacity: false,
    unusualUsage: false,
    highUsage: false
  };
  console.log(`[MONITOR] Reset alert state`);
}

/**
 * Check key pool health
 */
function checkKeyPoolHealth() {
  const stats = keyManager.getKeyStats();
  
  // Calculate health metrics
  const totalKeys = stats.length;
  const activeKeys = stats.filter(s => s.status === 'available').length;
  const rateLimitedKeys = stats.filter(s => s.status === 'rate-limited').length;
  const disabledKeys = stats.filter(s => s.status === 'disabled').length;
  const limitReachedKeys = stats.filter(s => s.status === 'limit-reached').length;
  
  const capacityPercentage = totalKeys > 0 ? activeKeys / totalKeys : 0;
  
  console.log(`[MONITOR] Key pool health: ${activeKeys}/${totalKeys} keys available (${(capacityPercentage * 100).toFixed(2)}%)`);
  console.log(`[MONITOR] Rate limited: ${rateLimitedKeys}, Disabled: ${disabledKeys}, Limit reached: ${limitReachedKeys}`);
  
  // Check for low capacity
  if (capacityPercentage < LOW_CAPACITY_THRESHOLD && !alertSent.lowCapacity) {
    alertSent.lowCapacity = true;
    sendAlert(`Low key pool capacity: ${activeKeys}/${totalKeys} keys available (${(capacityPercentage * 100).toFixed(2)}%)`);
  } else if (capacityPercentage >= LOW_CAPACITY_THRESHOLD) {
    alertSent.lowCapacity = false;
  }
  
  // Check for keys approaching daily limits
  const highUsageKeys = stats.filter(s => s.dailyCount > (s.dailyRemaining + s.dailyCount) * HIGH_USAGE_THRESHOLD);
  if (highUsageKeys.length > 0 && !alertSent.highUsage) {
    alertSent.highUsage = true;
    sendAlert(`${highUsageKeys.length} keys approaching daily limit`);
  }
  
  // Check for unusual usage patterns
  checkForUnusualUsage(stats);
}

/**
 * Check for unusual usage patterns
 */
function checkForUnusualUsage(stats) {
  const now = new Date();
  const unusualKeys = stats.filter(s => {
    // Check for keys with unusually high usage in the last 5 minutes
    return s.minuteCount > UNUSUAL_USAGE_THRESHOLD;
  });
  
  if (unusualKeys.length > 0 && !alertSent.unusualUsage) {
    alertSent.unusualUsage = true;
    sendAlert(`Unusual usage detected for ${unusualKeys.length} keys`);
  }
}

/**
 * Send an alert
 */
function sendAlert(message) {
  console.error(`[ALERT] ${message}`);
  
  // In a production system, this would send an email, Slack message, etc.
  // For now, we just log it
  
  // Example of sending an email alert (commented out)
  /*
  const nodemailer = require('nodemailer');
  
  // Create a transporter
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.ALERT_EMAIL,
      pass: process.env.ALERT_EMAIL_PASSWORD
    }
  });
  
  // Send email
  transporter.sendMail({
    from: process.env.ALERT_EMAIL,
    to: process.env.ADMIN_EMAIL,
    subject: 'OpenRouter Key Aggregator Alert',
    text: message
  });
  */
}

module.exports = {
  initializeMonitoring,
  checkKeyPoolHealth,
  sendAlert
};
