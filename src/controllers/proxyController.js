/**
 * Enhanced Proxy Controller with Streaming Support
 * 
 * This controller handles proxying requests to OpenRouter API with special
 * handling for streaming responses and n8n-specific formats.
 */
const axios = require('axios');
const keyManager = require('../utils/keyManager');
const { formatResponseForN8n, formatErrorResponseForN8n } = require('../utils/n8nResponseFormatter'); 
const { Transform } = require('stream');

console.log('>>>> PROXYCONTROLLER.JS LOADED - COMMIT d3286ee (Canary Check) <<<<');

/**
 * Proxy requests to OpenRouter API with streaming support
 */
const proxyRequest = async (req, res, next) => {
  console.log('>>>> PROXYREQUEST FUNCTION CALLED - COMMIT d3286ee (Canary Check) <<<<');
  // TOP LEVEL TRY-CATCH FOR UNEXPECTED ERRORS
  try {
    console.log('[DEBUG ENTER] Entered proxyRequest function.'); 
    
    const apiKey = keyManager.getNextKey();
    let endpoint = '/chat/completions';
    const path = req.path;

    // ... (rest of proxyRequest function remains the same as commit d3286ee) ...

  } catch (topLevelError) {
    // CATCH UNEXPECTED ERRORS ANYWHERE IN THE FUNCTION
    console.error('[FATAL PROXY ERROR] Uncaught exception in proxyRequest:', topLevelError.message, topLevelError.stack);
    // ... (rest of top level catch block) ...
  }
};

module.exports = {
  proxyRequest
};