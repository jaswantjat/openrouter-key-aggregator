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

/**
 * Proxy requests to OpenRouter API with streaming support
 */
const proxyRequest = async (req, res, next) => {
  // TOP LEVEL TRY-CATCH FOR UNEXPECTED ERRORS
  try {
    console.warn('[DEBUG ENTER] Entered proxyRequest function.'); // Use warn for visibility
    
    const apiKey = keyManager.getNextKey();
    let endpoint = '/chat/completions';
    const path = req.path;

    // Determine endpoint based on path
    if (path.includes('/completions') && !path.includes('/chat/completions')) endpoint = '/completions';
    else if (path.includes('/embeddings')) endpoint = '/embeddings';
    else if (path.includes('/chat/completions')) endpoint = '/chat/completions';

    console.warn(`[DEBUG PRE-STREAM] Request path: ${path}, Endpoint: ${endpoint}`);
    const requestData = { ...req.body };
    console.warn(`[DEBUG PRE-STREAM] Incoming Request Body Parsed.`);

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER || 'https://openrouter-key-aggregator.onrender.com',
      'X-Title': process.env.OPENROUTER_X_TITLE || 'OpenRouter Key Aggregator'
    };
    console.warn(`[DEBUG PRE-STREAM] Headers prepared.`);

    // Handle potential n8n 'chatInput' format (if still needed)
    if (requestData.chatInput !== undefined) {
      console.warn(`[DEBUG PRE-STREAM] Handling chatInput.`);
      // ... (chatInput handling) ...
      delete requestData.chatInput; 
    }

    const openRouterRequestData = { ...requestData };
    delete openRouterRequestData._isChatInputRequest; 
    console.warn(`[DEBUG PRE-STREAM] Prepared openRouterRequestData.`);

    // --- Explicitly log the stream value and type ---
    const streamValue = openRouterRequestData.stream;
    const streamType = typeof streamValue;
    console.warn(`[DEBUG STREAM CHECK] Value of openRouterRequestData.stream: ${streamValue}`);
    console.warn(`[DEBUG STREAM CHECK] Type of openRouterRequestData.stream: ${streamType}`);

    // --- Use truthiness check for stream --- 
    const isStreamingRequest = !!openRouterRequestData.stream; // Check for truthiness
    console.warn(`[DEBUG STREAM CHECK] Evaluated isStreamingRequest: ${isStreamingRequest}`);

    // --- Streaming Request Handling --- 
    if (isStreamingRequest) {
      // Marker inside streaming block
      console.warn('[DEBUG ENTER STREAMING BLOCK] Entered streaming logic.'); 
      
      const openRouterUrl = `${process.env.OPENROUTER_API_URL}${endpoint}`;
      console.warn(`[DEBUG STREAMING] Target URL: ${openRouterUrl}`);
      
      res.setHeader('Content-Type', 'text/event-stream');
      // ... other headers ...
      console.warn(`[DEBUG STREAMING] Headers set for SSE.`);

      // Wrap the streaming axios call specifically
      let axiosResponse;
      try {
        console.warn(`[DEBUG STREAMING] Attempting axios stream request...`);
        axiosResponse = await axios({
          method: req.method, url: openRouterUrl, headers: headers,
          data: openRouterRequestData, responseType: 'stream', timeout: 120000
        });
        console.warn(`[DEBUG STREAMING] Axios stream request returned (Status: ${axiosResponse.status}).`);
      } catch (axiosStreamError) {
        console.error(`[ERROR STREAMING AXIOS CALL] Failed: ${axiosStreamError.message}`, axiosStreamError.stack);
        const errorObj = { message: `Upstream request failed: ${axiosStreamError.message}`, status: 502 }; 
        const errorResponse = formatErrorResponseForN8n(errorObj, req.body || {});
        return res.status(502).json(errorResponse);
      }
      
      console.warn(`[DEBUG STREAMING] Incrementing key usage.`);
      keyManager.incrementKeyUsage(apiKey, requestData.model);
      
      console.warn(`[DEBUG STREAMING] Setting up transform stream.`);
      // ... (transform stream logic) ...
      const transformStream = new Transform({ /* ... */ });
      
      console.warn(`[DEBUG STREAMING] Piping stream...`);
      axiosResponse.data.pipe(transformStream).pipe(res);
      console.warn(`[DEBUG STREAMING] Pipe setup complete. Returning.`);
      return; 
    }
    
    // --- Non-Streaming Request Handling --- 
    else {
       console.warn('[DEBUG ENTER NON-STREAMING BLOCK] Entered non-streaming logic.');
       // ... (non-streaming logic remains the same, using console.warn for logs) ...
       const response = await axios({ /* ... */ });
       console.warn(`[DEBUG NON-STREAM] Received Non-Streaming Status: ${response.status}`);
       // ... safe logging ...
       console.warn(`[DEBUG NON-STREAM] Type of response.data: ${typeof response.data}`);
       // ... stringify ...
       let responseData = response.data;
       // ... processing ...
       console.warn(`[DEBUG NON-STREAM] Sending to n8n...`);
       return res.status(response.status).json(responseData);
    }

  } catch (topLevelError) {
    console.error('[FATAL PROXY ERROR] Uncaught exception in proxyRequest:', topLevelError.message, topLevelError.stack);
    if (!res.headersSent) {
      res.status(500).json({ error: { /* ... */ } });
    }
  }
};

module.exports = {
  proxyRequest
};