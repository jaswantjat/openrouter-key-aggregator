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
  try {
    const apiKey = keyManager.getNextKey();
    let endpoint = '/chat/completions';
    const path = req.path;

    // Determine endpoint based on path
    if (path.includes('/completions') && !path.includes('/chat/completions')) endpoint = '/completions';
    else if (path.includes('/embeddings')) endpoint = '/embeddings';
    else if (path.includes('/chat/completions')) endpoint = '/chat/completions';

    console.log(`Request path: ${path}, Determined endpoint: ${endpoint}`);
    const requestData = { ...req.body };
    console.log(`[DEBUG] Incoming Request Body: ${JSON.stringify(requestData).substring(0, 500)}...`);

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER || 'https://openrouter-key-aggregator.onrender.com',
      'X-Title': process.env.OPENROUTER_X_TITLE || 'OpenRouter Key Aggregator'
    };

    // Handle potential n8n 'chatInput' format (if still needed)
    if (requestData.chatInput !== undefined) {
      // ... (keep chatInput handling if necessary) ...
      delete requestData.chatInput; 
    }

    const openRouterRequestData = { ...requestData };
    delete openRouterRequestData._isChatInputRequest; 
    console.log(`[DEBUG] Sending Request to OpenRouter: ${JSON.stringify(openRouterRequestData).substring(0, 500)}...`);

    const isStreamingRequest = openRouterRequestData.stream === true;

    // --- Streaming Request Handling --- 
    if (isStreamingRequest) {
      // ... (streaming logic remains the same as previous commit) ...
      console.log(`[DEBUG] Streaming request detected.`);
      const openRouterUrl = `${process.env.OPENROUTER_API_URL}${endpoint}`;
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-OpenRouter-Key-Aggregator-Model', requestData.model || 'unknown');
      res.setHeader('X-OpenRouter-Key-Aggregator-Key', apiKey.substring(0, 4) + '...');
      const axiosResponse = await axios({
        method: req.method, url: openRouterUrl, headers: headers,
        data: openRouterRequestData, responseType: 'stream', timeout: 120000
      });
      keyManager.incrementKeyUsage(apiKey, requestData.model);
      const transformStream = new Transform({ /* ... stream transform logic ... */ });
      axiosResponse.data.pipe(transformStream).pipe(res);
      // ... (stream error/end handlers) ...
      return; 
    }

    // --- Non-Streaming Request Handling --- 
    const response = await axios({
      method: req.method, url: `${process.env.OPENROUTER_API_URL}${endpoint}`,
      headers: headers, data: openRouterRequestData, timeout: 120000
    });

    console.log(`[DEBUG] Received Non-Streaming Response Status: ${response.status}`);
    
    // --- Refined Logging & Error Handling START ---
    try {
        console.log(`[DEBUG] Attempting keyManager.incrementKeyUsage for model: ${requestData.model}`);
        keyManager.incrementKeyUsage(apiKey, requestData.model);
        console.log(`[DEBUG] Completed keyManager.incrementKeyUsage`);
    } catch (keyManagerError) {
        console.error(`[ERROR] CRITICAL FAILURE during keyManager.incrementKeyUsage: ${keyManagerError.message}`, keyManagerError.stack);
        // Decide how to handle - maybe just log and continue, or return an error?
        // For now, log and try to continue, but this indicates a problem in keyManager.
    }

    console.log(`[DEBUG] Type of response.data: ${typeof response.data}`);
    let rawResponseLog = 'Error logging raw response';
    try {
        // Attempt to stringify safely
        rawResponseLog = JSON.stringify(response.data);
        console.log(`[DEBUG RAW RESPONSE] OpenRouter Raw Data (Type: ${typeof response.data}): ${rawResponseLog.substring(0, 500)}...`); 
    } catch(stringifyError) {
        console.error(`[ERROR] FAILED TO JSON.stringify(response.data): ${stringifyError.message}`);
        // Log the raw data directly if possible (might be huge or non-string)
        console.error('[DEBUG RAW RESPONSE (Fallback)]:', response.data);
        // Consider returning an error immediately as response is likely unusable
        return res.status(500).json(formatErrorResponseForN8n({message: `Failed to process upstream response: ${stringifyError.message}`, code: 502 }, requestData));
    }
    // --- Refined Logging & Error Handling END ---

    res.setHeader('X-OpenRouter-Key-Aggregator-Model', requestData.model || 'unknown');
    res.setHeader('X-OpenRouter-Key-Aggregator-Key', apiKey.substring(0, 4) + '...');

    let responseData = response.data;

    // Handle OpenRouter specific error format first
    if (responseData && responseData.error && !responseData.choices) {
      console.log(`[DEBUG] Detected OpenRouter error structure.`);
      responseData = formatErrorResponseForN8n(responseData.error, requestData);
    }
    // Ensure standard chat completion response structure
    else if (endpoint === '/chat/completions' || requestData._isChatInputRequest) {
       // ... (rest of the non-streaming processing logic using fixed formatter) ...
       console.log(`[DEBUG] Applying formatResponseForN8n (fixed version).`);
       responseData = formatResponseForN8n(responseData, requestData);
       if (!responseData.usage) {
         responseData.usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
       }
    } 

    console.log(`[DEBUG FINAL RESPONSE] Sending to n8n: ${JSON.stringify(responseData).substring(0, 500)}...`);
    return res.status(response.status).json(responseData);

  } catch (error) {
    // ... (keep existing main catch block) ...
    console.error('Proxy request error:', error.message);
    let errorObj = { message: error.message || 'Unknown error', status: error.response?.status || 500 };
    // ... (rest of error handling) ...
    const errorResponse = formatErrorResponseForN8n(errorObj, req.body || {});
    console.log(`[DEBUG ERROR RESPONSE] Sending error to n8n: ${JSON.stringify(errorResponse).substring(0, 500)}...`);
    return res.status(errorResponse.error.code || 500).json(errorResponse);
  }
};

module.exports = {
  proxyRequest
};