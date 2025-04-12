/**
 * Enhanced Proxy Controller with Streaming Support
 */
const axios = require('axios');
const keyManager = require('../utils/keyManager');
const { formatResponseForN8n, formatErrorResponseForN8n } = require('../utils/n8nResponseFormatter'); 
const { Transform } = require('stream');

console.log('>>>> PROXYCONTROLLER.JS LOADED - SIMPLIFIED (Attempt 4) <<<<');

const proxyRequest = async (req, res, next) => {
  console.log('>>>> PROXYREQUEST FUNCTION CALLED - SIMPLIFIED (Attempt 4) <<<<');
  try {
    console.log('[DEBUG ENTER] Entered proxyRequest function.'); 
    const apiKey = keyManager.getNextKey();
    console.log(`[DEBUG KEY] Selected OpenRouter Key: ${apiKey ? apiKey.substring(0, 6) : 'ERROR'}...`);
    let endpoint = '/chat/completions';
    const path = req.path;
    if (path.includes('/completions') && !path.includes('/chat/completions')) endpoint = '/completions';
    else if (path.includes('/embeddings')) endpoint = '/embeddings';
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
    if (requestData.chatInput !== undefined) { /* ... */ }
    const openRouterRequestData = { ...requestData };
    delete openRouterRequestData._isChatInputRequest; 
    console.log(`[DEBUG PRE-STREAM] Prepared openRouterRequestData.`);
    console.log('[DEBUG MARKER] About to check isStreamingRequest flag.');
    const isStreamingRequest = openRouterRequestData.stream === true;
    console.log(`[DEBUG MARKER] isStreamingRequest = ${isStreamingRequest}`);

    if (isStreamingRequest) {
      console.log('[DEBUG ENTER STREAMING BLOCK] Entered streaming logic.'); 
      const openRouterUrl = `${process.env.OPENROUTER_API_URL}${endpoint}`;
      console.log(`[DEBUG STREAMING] Target URL: ${openRouterUrl}`);
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      console.log(`[DEBUG STREAMING] Headers set for SSE.`);
      
      // --- SIMPLIFICATION START ---
      console.log('[DEBUG STREAMING - SIMPLIFIED] Skipping actual stream request and processing for diagnostics.');
      // Send a simple SSE message and end the response
      const simplifiedMessage = `data: ${JSON.stringify({ choices: [{ delta: { role: 'assistant', content: 'Stream processing bypassed for debugging.' } }] })}

`;
      res.write(simplifiedMessage);
      res.write('data: [DONE]

');
      res.end();
      console.log('[DEBUG STREAMING - SIMPLIFIED] Sent placeholder SSE response and ended.');
      return;
      // --- SIMPLIFICATION END ---

      /* --- Original Streaming Logic Commented Out ---
      let axiosResponse;
      try {
        console.log(`[DEBUG STREAMING] STEP 1: Attempting axios stream request...`);
        axiosResponse = await axios({ method: req.method, url: openRouterUrl, headers: headers, data: openRouterRequestData, responseType: 'stream', timeout: 120000 });
        console.log(`[DEBUG STREAMING] STEP 2: Axios stream request returned OK (Status: ${axiosResponse.status}).`);
      } catch (axiosStreamError) {
         // ... error handling ...
      }
      try {
          console.log(`[DEBUG STREAMING] STEP 3: Attempting keyManager.incrementKeyUsage...`);
          keyManager.incrementKeyUsage(apiKey, requestData.model);
          console.log(`[DEBUG STREAMING] STEP 4: Completed keyManager.incrementKeyUsage.`);
      } catch (keyManagerError) {
          // ... error handling ...
      }
      console.log(`[DEBUG STREAMING] STEP 5: Setting up transform stream.`);
      const transformStream = new Transform({ 
           transform(chunk, encoding, callback) {
               const chunkStr = chunk.toString();
               console.log(`[STREAM RAW] Chunk: ${chunkStr.substring(0,100)}`);
               try {
                   const lines = chunkStr.split('
').filter(line => line.trim() !== ''); 
                   // ... rest of transform logic ...
               } catch (transformError) {
                   console.error(`[ERROR STREAM TRANSFORM] ${transformError.message}`);
                   this.push(chunk); 
               }
               callback();
           }
       });
      console.log(`[DEBUG STREAMING] STEP 6: Setting up stream error/end handlers.`);
      // ... event handlers ... 
      console.log(`[DEBUG STREAMING] STEP 7: Piping axiosResponse.data -> transformStream -> res.`);
      axiosResponse.data.pipe(transformStream).pipe(res);
      console.log(`[DEBUG STREAMING] STEP 8: Pipe setup complete. Returning control.`);
      return; 
      --- End Commented Out Logic --- */
    } else {
       console.log('[DEBUG ENTER NON-STREAMING BLOCK] Entered non-streaming logic.');
       const response = await axios({/* ... */});
       // ... non-streaming logic ...
       let responseData = response.data;
       // ... processing ...
       console.log(`[DEBUG NON-STREAM] Sending to n8n...`);
       return res.status(response.status).json(responseData);
    }
  } catch (topLevelError) {
    console.error('[FATAL PROXY ERROR] Uncaught exception in proxyRequest:', topLevelError.message, topLevelError.stack);
    if (!res.headersSent) {
      res.status(500).json({ error: { message: 'Internal Server Error' } });
    } else {
      console.error('[FATAL PROXY ERROR] Headers already sent.');
    }
  }
};

module.exports = {
  proxyRequest
};