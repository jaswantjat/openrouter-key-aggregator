/**
 * Enhanced Proxy Controller with Streaming Support
 */
const axios = require('axios');
const keyManager = require('../utils/keyManager');
const { formatResponseForN8n, formatErrorResponseForN8n } = require('../utils/n8nResponseFormatter'); 
const { Transform } = require('stream');

console.log('>>>> PROXYCONTROLLER.JS LOADED - COMMIT 0ced0ad (SyntaxFix Attempt 2) <<<<');

const proxyRequest = async (req, res, next) => {
  console.log('>>>> PROXYREQUEST FUNCTION CALLED - COMMIT 0ced0ad (SyntaxFix Attempt 2) <<<<');
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
      let axiosResponse;
      try {
        console.log(`[DEBUG STREAMING] STEP 1: Attempting axios stream request...`);
        axiosResponse = await axios({ method: req.method, url: openRouterUrl, headers: headers, data: openRouterRequestData, responseType: 'stream', timeout: 120000 });
        console.log(`[DEBUG STREAMING] STEP 2: Axios stream request returned OK (Status: ${axiosResponse.status}).`);
      } catch (axiosStreamError) {
         console.error(`[ERROR STREAMING AXIOS CALL] Failed: ${axiosStreamError.message}`, axiosStreamError.stack);
         const errorObj = { message: `Upstream request failed: ${axiosStreamError.message}`, status: 502 };
         const errorResponse = formatErrorResponseForN8n(errorObj, req.body || {});
         return res.status(502).json(errorResponse);
      }
      try {
          console.log(`[DEBUG STREAMING] STEP 3: Attempting keyManager.incrementKeyUsage...`);
          keyManager.incrementKeyUsage(apiKey, requestData.model);
          console.log(`[DEBUG STREAMING] STEP 4: Completed keyManager.incrementKeyUsage.`);
      } catch (keyManagerError) {
          console.error(`[ERROR STREAMING] CRITICAL FAILURE during keyManager.incrementKeyUsage: ${keyManagerError.message}`, keyManagerError.stack);
          axiosResponse.data.destroy(); 
          if (!res.writableEnded) res.end();
          return; 
      }
      console.log(`[DEBUG STREAMING] STEP 5: Setting up transform stream.`);
      const transformStream = new Transform({ 
           transform(chunk, encoding, callback) {
               const chunkStr = chunk.toString();
               console.log(`[STREAM RAW] Chunk: ${chunkStr.substring(0,100)}`);
               try {
                   // --- CORRECTED LINE AGAIN --- 
                   const lines = chunkStr.split('
').filter(line => line.trim() !== ''); // Use '
' escape sequence
                   // --- END CORRECTION --- 
                   let transformedLines = [];
                   for (const line of lines) {
                       if (line.startsWith('data: ')) {
                           const data = line.substring(6);
                           if (data === '[DONE]') {
                               console.log('[STREAM PROC] DONE');
                               transformedLines.push(line);
                               continue;
                           }
                           try {
                               const jsonData = JSON.parse(data);
                               if (jsonData.choices && Array.isArray(jsonData.choices) && jsonData.choices.length > 0) {
                                   const choice = jsonData.choices[0];
                                   if (choice.delta) {
                                       if (!choice.delta.role) choice.delta.role = 'assistant';
                                       const hasToolCalls = choice.delta.tool_calls && Array.isArray(choice.delta.tool_calls);
                                       if (choice.delta.content === undefined || choice.delta.content === null) {
                                           choice.delta.content = hasToolCalls ? null : '';
                                       }
                                   }
                               }
                               const finalLine = `data: ${JSON.stringify(jsonData)}`;
                               console.log(`[STREAM SENDING] Line: ${finalLine.substring(0,100)}`);
                               transformedLines.push(finalLine);
                           } catch (parseError) {
                               console.error(`[ERROR STREAM PARSE] ${parseError.message}. Line: ${line}`);
                               transformedLines.push(line); 
                           }
                       } else {
                           transformedLines.push(line);
                       }
                   }
                   const transformedChunk = transformedLines.join('
') + '

';
                   this.push(transformedChunk);
               } catch (transformError) {
                   console.error(`[ERROR STREAM TRANSFORM] ${transformError.message}`);
                   this.push(chunk); 
               }
               callback();
           }
       });
      console.log(`[DEBUG STREAMING] STEP 6: Setting up stream error/end handlers.`);
      axiosResponse.data.on('error', (error) => { /* ... */ });
      axiosResponse.data.on('end', () => { /* ... */ });
      transformStream.on('error', (error) => { /* ... */ });
      transformStream.on('finish', () => { /* ... */ });
      console.log(`[DEBUG STREAMING] STEP 7: Piping axiosResponse.data -> transformStream -> res.`);
      axiosResponse.data.pipe(transformStream).pipe(res);
      console.log(`[DEBUG STREAMING] STEP 8: Pipe setup complete. Returning control.`);
      return; 
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