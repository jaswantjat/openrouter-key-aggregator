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
    console.log(`Full request body: ${JSON.stringify(requestData).substring(0, 500)}...`);

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER || 'https://openrouter-key-aggregator.onrender.com',
      'X-Title': process.env.OPENROUTER_X_TITLE || 'OpenRouter Key Aggregator'
    };

    // Handle potential n8n 'chatInput' format
    if (requestData.chatInput !== undefined) {
      console.log(`[DEBUG] Detected n8n LangChain format with chatInput.`);
      if (!requestData.messages || !Array.isArray(requestData.messages) || requestData.messages.length === 0) {
        requestData.messages = [{ role: 'user', content: String(requestData.chatInput) }];
      } else {
        const hasUserMessage = requestData.messages.some(msg => msg.role === 'user');
        if (!hasUserMessage) {
          requestData.messages.push({ role: 'user', content: String(requestData.chatInput) });
        }
      }
      requestData._isChatInputRequest = true; // Flag for potential special response formatting
      console.log(`[DEBUG] Converted chatInput to messages: ${JSON.stringify(requestData.messages)}`);
      delete requestData.chatInput; // Remove after conversion
    }

    const openRouterRequestData = { ...requestData };
    delete openRouterRequestData._isChatInputRequest; // Remove internal flag

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
        method: req.method,
        url: openRouterUrl,
        headers: headers,
        data: openRouterRequestData,
        responseType: 'stream',
        timeout: 120000
      });
      
      keyManager.incrementKeyUsage(apiKey, requestData.model);

      const transformStream = new Transform({
        transform(chunk, encoding, callback) {
          const chunkStr = chunk.toString();
          console.log(`[STREAM] Received chunk: ${chunkStr.substring(0, 100)}...`);
          try {
            const lines = chunkStr.split('
').filter(line => line.trim() !== '');
            let transformedLines = [];
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.substring(6);
                if (data === '[DONE]') {
                  transformedLines.push(line);
                  continue;
                }
                try {
                  const jsonData = JSON.parse(data);
                  // Apply content/tool_call refinement directly to the stream chunk
                  if (jsonData.choices && Array.isArray(jsonData.choices) && jsonData.choices.length > 0) {
                    const choice = jsonData.choices[0];
                    if (choice.delta) {
                       if (!choice.delta.role) choice.delta.role = 'assistant'; 
                       const hasToolCalls = choice.delta.tool_calls && Array.isArray(choice.delta.tool_calls);
                       if (choice.delta.content === undefined || choice.delta.content === null) { 
                           choice.delta.content = hasToolCalls ? null : ''; 
                       }
                       // Log adjusted delta (optional)
                       // console.log(`[STREAM] Adjusted delta: ${JSON.stringify(choice.delta)}`);
                    }
                  } else {
                     // console.log(`[STREAM] Chunk has no choices or delta: ${data}`);
                  }
                  transformedLines.push(`data: ${JSON.stringify(jsonData)}`);
                } catch (error) {
                  console.error(`[ERROR] Failed to parse/process JSON in streaming chunk: ${error.message}. Original line: ${line}`);
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
          } catch (error) {
            console.error(`[ERROR] Failed to process streaming chunk: ${error.message}`);
            this.push(chunk); 
          }
          callback();
        }
      });
      
      axiosResponse.data.pipe(transformStream).pipe(res);

      axiosResponse.data.on('error', (error) => {
        console.error(`[ERROR] Stream error: ${error.message}`);
        try {
          const errorEvent = `data: ${JSON.stringify({ error: { message: error.message, type: 'stream_error' }, choices: [{ index: 0, message: { role: 'assistant', content: `Error: ${error.message}` }, finish_reason: 'error' }] })}

data: [DONE]

`;
          if (!res.headersSent) {
             res.write(errorEvent);
             res.end();
          } else {
             console.error('[ERROR] Headers already sent, cannot write stream error event.');
          }
        } catch (writeError) {
          console.error(`[ERROR] Failed to write error event to stream: ${writeError.message}`);
          if (!res.headersSent) res.end();
        }
      });
      
      axiosResponse.data.on('end', () => {
         console.log('[STREAM] Source stream ended.');
         if (!res.writableEnded) {
            res.end(); 
         }
      });

      return; // Handled by pipe
    }

    // --- Non-Streaming Request Handling --- 
    const response = await axios({
      method: req.method,
      url: `${process.env.OPENROUTER_API_URL}${endpoint}`,
      headers: headers,
      data: openRouterRequestData,
      timeout: 120000
    });

    console.log(`[DEBUG] Non-streaming request sent to OpenRouter with model: ${requestData.model}`);
    keyManager.incrementKeyUsage(apiKey, requestData.model);
    console.log(`Received non-streaming response from OpenRouter status: ${response.status}`);
    console.log(`[DEBUG] Raw response structure: ${JSON.stringify(response.data).substring(0, 200)}...`); // Log raw response

    res.setHeader('X-OpenRouter-Key-Aggregator-Model', requestData.model || 'unknown');
    res.setHeader('X-OpenRouter-Key-Aggregator-Key', apiKey.substring(0, 4) + '...');

    let responseData = response.data;

    // Handle OpenRouter specific error format first
    if (responseData && responseData.error && !responseData.choices) {
      console.log(`[DEBUG] Detected OpenRouter error response: ${JSON.stringify(responseData.error)}`);
      // Use the error formatter directly
      responseData = formatErrorResponseForN8n(responseData.error, requestData);
    }
    // Ensure standard chat completion response structure
    else if (endpoint === '/chat/completions' || requestData._isChatInputRequest) {
      if (!responseData || !responseData.choices || !Array.isArray(responseData.choices) || responseData.choices.length === 0) {
        console.log(`[DEBUG] No valid choices in response, creating default response`);
        responseData = {
          id: `chatcmpl-${Date.now()}`, object: 'chat.completion', created: Math.floor(Date.now() / 1000),
          model: requestData.model || 'unknown',
          choices: [{
            index: 0, message: { role: 'assistant', content: 'No response generated.' }, finish_reason: 'stop'
          }],
          usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
        };
      } else {
        console.log(`[DEBUG] Processing ${responseData.choices.length} choices in non-streaming response`);
        // Apply the necessary structural fixes directly to the received data
        responseData.choices.forEach(choice => {
          if (!choice.message) {
            choice.message = { role: 'assistant', content: '' }; // Default if message completely missing
          } else {
            const hasToolCalls = choice.message.tool_calls && Array.isArray(choice.message.tool_calls);
            if (choice.message.content === undefined || choice.message.content === null) {
              choice.message.content = hasToolCalls ? null : ''; 
            }
            if (!choice.message.role) choice.message.role = 'assistant';
            // Ensure finish_reason is appropriate if tool calls were made
            if (hasToolCalls && choice.finish_reason !== 'tool_calls' && choice.finish_reason !== 'length' && choice.finish_reason !== 'error') {
                choice.finish_reason = 'tool_calls';
            }
          }
        });
        // TEMPORARILY COMMENTED OUT: responseData = formatResponseForN8n(responseData, requestData);
        // console.log(`[DEBUG] Skipped call to formatResponseForN8n for testing.`);
       if (!responseData.usage) {
          responseData.usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
       }
      }
    } // End of chat completion processing

    // Add debug info (optional)
    // responseData._debug = { timestamp: new Date().toISOString(), endpoint: endpoint, requestedModel: requestData.model };
    console.log(`[DEBUG] Final response being sent: ${JSON.stringify(responseData).substring(0, 200)}...`);
    return res.status(response.status).json(responseData);

  } catch (error) {
    console.error('Proxy request error:');
    console.error(`- Status: ${error.response?.status || 'No status'}`);
    console.error(`- Message: ${error.message}`);
    console.error(`- URL: ${error.config?.url || 'Unknown URL'}`);
    if (error.response?.data) console.error('- Response data:', JSON.stringify(error.response.data).substring(0, 500));

    if (error.response && error.response.status === 429) {
      const apiKey = error.config.headers.Authorization.replace('Bearer ', '');
      keyManager.recordKeyError(apiKey);
      console.error(`Recorded rate limit error for API key: ${apiKey.substring(0, 4)}...`);
    }

    let errorObj = { message: error.message || 'Unknown error', status: error.response?.status || 500 };
    if (error.response?.data?.error) { // Handle nested OpenRouter error object
       errorObj = { ...errorObj, ...error.response.data.error }; // Merge OpenRouter error details
       if (!errorObj.status && errorObj.code) errorObj.status = 500; // Use 500 if OR code isn't HTTP status
    }
    
    const errorResponse = formatErrorResponseForN8n(errorObj, req.body || {});
    console.log(`[DEBUG] Created error response for n8n: ${JSON.stringify(errorResponse).substring(0, 200)}...`);
    // Use status from formatted error, which has validation
    return res.status(errorResponse.error.code || 500).json(errorResponse);
  }
};

module.exports = {
  proxyRequest
};