/**
 * Enhanced Proxy Controller with Streaming Support
 * 
 * This controller handles proxying requests to OpenRouter API with special
 * handling for streaming responses and n8n-specific formats.
 */
const axios = require('axios');
const keyManager = require('../utils/keyManager');
const { formatResponseForN8n, formatErrorResponseForN8n } = require('../utils/n8nResponseFormatter'); // Assuming this is fixed now
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

      const transformStream = new Transform({
        transform(chunk, encoding, callback) {
          const chunkStr = chunk.toString();
          // 1. Log raw chunk
          console.log(`[STREAM RAW] Received chunk: ${chunkStr.substring(0, 150)}`); 
          try {
            const lines = chunkStr.split('
').filter(line => line.trim() !== '');
            let transformedLines = [];
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.substring(6);
                if (data === '[DONE]') {
                  console.log('[STREAM PROC] Detected [DONE]');
                  transformedLines.push(line);
                  continue;
                }
                try {
                  // 2. Log parsed JSON data
                  const jsonData = JSON.parse(data);
                  console.log(`[STREAM PARSED] Parsed data: ${JSON.stringify(jsonData).substring(0, 150)}`);

                  let modified = false; // Flag to track if we modify
                  // Apply content/tool_call refinement directly to the stream chunk
                  if (jsonData.choices && Array.isArray(jsonData.choices) && jsonData.choices.length > 0) {
                    const choice = jsonData.choices[0];
                    if (choice.delta) {
                       if (!choice.delta.role) { choice.delta.role = 'assistant'; modified = true; }
                       const hasToolCalls = choice.delta.tool_calls && Array.isArray(choice.delta.tool_calls);
                       if (choice.delta.content === undefined || choice.delta.content === null) { 
                           const newContent = hasToolCalls ? null : '';
                           if(choice.delta.content !== newContent) { // Only log if changed
                               choice.delta.content = newContent; 
                               modified = true;
                           }
                       }
                    }
                  } 
                  
                  // 3. Log modified JSON data (if modified)
                  if(modified) {
                     console.log(`[STREAM MODIFIED] Modified data: ${JSON.stringify(jsonData).substring(0, 150)}`);
                  }

                  // 4. Log final data line being sent
                  const finalLine = `data: ${JSON.stringify(jsonData)}`;
                  console.log(`[STREAM SENDING] Sending line: ${finalLine.substring(0, 150)}`);
                  transformedLines.push(finalLine);

                } catch (error) {
                  console.error(`[ERROR STREAM PARSE/PROC] Failed: ${error.message}. Original line: ${line}`);
                  transformedLines.push(line); // Push original line on error
                }
              } else {
                // Pass non-data lines (e.g., comments, empty lines) through
                 console.log(`[STREAM NON-DATA] Passing through line: ${line}`);
                 transformedLines.push(line); 
              }
            }
            // Ensure double newline termination for SSE
            const transformedChunk = transformedLines.join('
') + '

'; 
            this.push(transformedChunk);
          } catch (error) {
            console.error(`[ERROR STREAM TRANSFORM] Failed: ${error.message}`);
            this.push(chunk); // Push original chunk on error
          }
          callback();
        }
      });
      
      axiosResponse.data.pipe(transformStream).pipe(res);
      // ... (keep stream error/end handlers) ...
      return; 
    }

    // --- Non-Streaming Request Handling --- 
    const response = await axios({
      method: req.method, url: `${process.env.OPENROUTER_API_URL}${endpoint}`,
      headers: headers, data: openRouterRequestData, timeout: 120000
    });

    keyManager.incrementKeyUsage(apiKey, requestData.model);
    console.log(`[DEBUG] Received Non-Streaming Response Status: ${response.status}`);
    // 1. Log raw response from OpenRouter
    console.log(`[DEBUG RAW RESPONSE] OpenRouter Raw: ${JSON.stringify(response.data).substring(0, 500)}...`); 

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
      if (!responseData || !responseData.choices || !Array.isArray(responseData.choices) || responseData.choices.length === 0) {
        console.log(`[DEBUG] No valid choices in raw response, creating default.`);
        // ... (default response creation) ...
      } else {
        console.log(`[DEBUG] Processing choices in non-streaming response.`);
        // Apply the necessary structural fixes directly (TEMPORARILY ACTIVE instead of formatter)
        responseData.choices.forEach((choice, index) => {
          if (!choice.message) {
             console.warn(`[WARN] Choice index ${index} missing message! Setting default.`);
             choice.message = { role: 'assistant', content: '' }; 
          } else {
            const hasToolCalls = choice.message.tool_calls && Array.isArray(choice.message.tool_calls);
            const originalContent = choice.message.content;
            if (choice.message.content === undefined || choice.message.content === null) {
              choice.message.content = hasToolCalls ? null : ''; 
            }
            if (!choice.message.role) choice.message.role = 'assistant';
            const originalFinishReason = choice.finish_reason;
            if (hasToolCalls && choice.finish_reason !== 'tool_calls' && choice.finish_reason !== 'length' && choice.finish_reason !== 'error') {
                choice.finish_reason = 'tool_calls';
            }
            // Log if modifications happened
            if (originalContent !== choice.message.content || originalFinishReason !== choice.finish_reason) {
                console.log(`[DEBUG CHOICE MODIFIED] Index ${index}: content='${choice.message.content}', finish_reason='${choice.finish_reason}'`);
            }
          }
        });
        
        // ** Re-enable the fixed formatter **
        console.log(`[DEBUG] Applying formatResponseForN8n (fixed version).`);
        responseData = formatResponseForN8n(responseData, requestData);
 
        if (!responseData.usage) {
          responseData.usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
        }
      }
    } 

    // 2. Log final response being sent to n8n
    console.log(`[DEBUG FINAL RESPONSE] Sending to n8n: ${JSON.stringify(responseData).substring(0, 500)}...`);
    return res.status(response.status).json(responseData);

  } catch (error) {
    // ... (keep existing error handling, ensure formatErrorResponseForN8n is called)
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