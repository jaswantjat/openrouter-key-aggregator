const keyManager = require('../utils/keyManager');

/**
 * Get status of all API keys
 */
const getStatus = (req, res) => {
  const stats = keyManager.getKeyStats();
  
  // Calculate aggregate statistics
  const totalKeys = stats.length;
  const activeKeys = stats.filter(s => !s.disabled).length;
  const totalRequests = stats.reduce((sum, s) => sum + s.dailyCount, 0);
  const totalRemaining = stats.reduce((sum, s) => sum + (s.disabled ? 0 : s.dailyRemaining), 0);
  
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    summary: {
      totalKeys,
      activeKeys,
      totalRequests,
      totalRemaining,
      averageUsagePerKey: totalKeys > 0 ? Math.round(totalRequests / totalKeys) : 0
    },
    keys: stats
  });
};

module.exports = {
  getStatus
};
