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
    console.log('[DEBUG ENTER] Entered proxyRequest function.'); 
    
    const apiKey = keyManager.getNextKey();
    let endpoint = '/chat/completions';
    const path = req.path;

    // Determine endpoint based on path
    if (path.includes('/completions') && !path.includes('/chat/completions')) endpoint = '/completions';
    else if (path.includes('/embeddings')) endpoint = '/embeddings';
    else if (path.includes('/chat/completions')) endpoint = '/chat/completions';

    console.log(`[DEBUG PRE-STREAM] Request path: ${path}, Endpoint: ${endpoint}`);
    const requestData = { ...req.body };
    console.log(`[DEBUG PRE-STREAM] Incoming Request Body Parsed.`);

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER || 'https://openrouter-key-aggregator.onrender.com',
      'X-Title': process.env.OPENROUTER_X_TITLE || 'OpenRouter Key Aggregator'
    };
    console.log(`[DEBUG PRE-STREAM] Headers prepared.`);

    // Handle potential n8n 'chatInput' format (if still needed)
    if (requestData.chatInput !== undefined) {
      console.log(`[DEBUG PRE-STREAM] Handling chatInput.`);
      // ... (chatInput handling) ...
      delete requestData.chatInput; 
    }

    const openRouterRequestData = { ...requestData };
    delete openRouterRequestData._isChatInputRequest; 
    console.log(`[DEBUG PRE-STREAM] Prepared openRouterRequestData.`);

    // Marker before checking stream flag
    console.log('[DEBUG MARKER] About to check isStreamingRequest flag.');
    const isStreamingRequest = openRouterRequestData.stream === true;
    console.log(`[DEBUG MARKER] isStreamingRequest = ${isStreamingRequest}`);

    // --- Streaming Request Handling --- 
    if (isStreamingRequest) {
      // Marker inside streaming block
      console.log('[DEBUG ENTER STREAMING BLOCK] Entered streaming logic.'); 
      
      const openRouterUrl = `${process.env.OPENROUTER_API_URL}${endpoint}`;
      console.log(`[DEBUG STREAMING] Target URL: ${openRouterUrl}`);
      
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      // ... other headers ...
      console.log(`[DEBUG STREAMING] Headers set for SSE.`);

      // Wrap the streaming axios call specifically
      let axiosResponse;
      try {
        console.log(`[DEBUG STREAMING] Attempting axios stream request...`);
        axiosResponse = await axios({
          method: req.method, url: openRouterUrl, headers: headers,
          data: openRouterRequestData, responseType: 'stream', timeout: 120000
        });
        console.log(`[DEBUG STREAMING] Axios stream request returned (Status: ${axiosResponse.status}).`);
      } catch (axiosStreamError) {
        console.error(`[ERROR STREAMING AXIOS CALL] Failed: ${axiosStreamError.message}`, axiosStreamError.stack);
        // Return an error response immediately if the call itself fails
        const errorObj = { message: `Upstream request failed: ${axiosStreamError.message}`, status: 502 }; // 502 Bad Gateway
        const errorResponse = formatErrorResponseForN8n(errorObj, req.body || {});
        return res.status(502).json(errorResponse);
      }
      
      // Proceed only if axios call succeeded
      console.log(`[DEBUG STREAMING] Incrementing key usage.`);
      keyManager.incrementKeyUsage(apiKey, requestData.model);
      
      console.log(`[DEBUG STREAMING] Setting up transform stream.`);
      const transformStream = new Transform({ /* ... stream transform logic ... */ });
      
      console.log(`[DEBUG STREAMING] Piping stream...`);
      axiosResponse.data.pipe(transformStream).pipe(res);
      // ... (stream error/end handlers) ...
      console.log(`[DEBUG STREAMING] Pipe setup complete. Returning.`);
      return; 
    }
    
    // --- Non-Streaming Request Handling --- 
    else {
       console.log('[DEBUG ENTER NON-STREAMING BLOCK] Entered non-streaming logic.');
       // ... (non-streaming logic remains the same as previous commit, including safe logging) ...
       const response = await axios(/* ... */);
       console.log(`[DEBUG NON-STREAM] Received Non-Streaming Status: ${response.status}`);
       // ... safe logging for response.data ...
       let responseData = response.data;
       // ... response processing ...
       console.log(`[DEBUG NON-STREAM] Sending to n8n...`);
       return res.status(response.status).json(responseData);
    }

  } catch (topLevelError) {
    // CATCH UNEXPECTED ERRORS ANYWHERE IN THE FUNCTION
    console.error('[FATAL PROXY ERROR] Uncaught exception in proxyRequest:', topLevelError.message, topLevelError.stack);
    // Attempt to send a generic error response if possible
    if (!res.headersSent) {
      res.status(500).json({ 
        error: { 
          message: 'Internal Server Error: Unhandled exception occurred.', 
          type: 'internal_server_error',
          details: topLevelError.message // Include message for debugging
        } 
      });
    } else {
      console.error('[FATAL PROXY ERROR] Headers already sent, cannot send error response.');
    }
    // Optionally call next(topLevelError) if you have a global Express error handler
  }
};

module.exports = {
  proxyRequest
};