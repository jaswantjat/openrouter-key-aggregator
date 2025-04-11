/**
 * Streaming Integration for OpenRouter Key Aggregator
 * 
 * This file integrates the streaming-enabled proxy controller with the main application.
 */

const { proxyRequest } = require('./streaming-proxy-controller');

/**
 * Update the application with streaming support
 * @param {Express} app - The Express application
 */
function updateAppWithStreamingSupport(app) {
  console.log('Updating application with streaming support...');
  
  // Replace existing proxy routes with streaming-enabled versions
  
  // OpenAI SDK compatible routes with /api prefix (for n8n integration)
  app.post('/api/v1/chat/completions', (req, res, next) => {
    console.log('[STREAM] n8n integration route /api/v1/chat/completions hit');
    proxyRequest(req, res, next);
  });
  
  // Additional routes without v1 prefix (for n8n with base URL /api)
  app.post('/api/chat/completions', (req, res, next) => {
    console.log('[STREAM] n8n integration route /api/chat/completions hit');
    proxyRequest(req, res, next);
  });
  
  // Direct v1 routes
  app.post('/v1/chat/completions', (req, res, next) => {
    console.log('[STREAM] Direct /v1/chat/completions route hit');
    proxyRequest(req, res, next);
  });
  
  console.log('Application updated with streaming support');
}

module.exports = updateAppWithStreamingSupport;
