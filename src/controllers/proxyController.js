/**
 * Enhanced Proxy Controller with Streaming Support
 * 
 * This controller handles proxying requests to OpenRouter API with special
 * handling for streaming responses.
 */
const axios = require('axios');
const keyManager = require('../utils/keyManager');
const { ensureValidChatCompletionResponse, createErrorResponse } = require('../utils/responseFormatter');
const { formatResponseForN8n, formatErrorResponseForN8n } = require('../utils/n8nResponseFormatter');

/**
 * Proxy requests to OpenRouter API with streaming support
 */
const proxyRequest = async (req, res, next) => {
  try {
    // Get the next available API key
    const apiKey = keyManager.getNextKey();

    // Determine the endpoint based on the request path
    let endpoint = '/chat/completions';

    // Handle both OpenRouter style paths (/proxy/...) and OpenAI SDK style paths (/v1/...)
    const path = req.path;

    if (path.includes('/completions') && !path.includes('/chat/completions')) {
      endpoint = '/completions';
    } else if (path.includes('/embeddings')) {
      endpoint = '/embeddings';
    } else if (path.includes('/chat/completions')) {
      endpoint = '/chat/completions';
    }

    // Log the request path and endpoint for debugging
    console.log(`Request path: ${path}`);
    console.log(`Determined endpoint: ${endpoint}`);

    // Get the request body
    const requestData = { ...req.body };

    // Log the request details
    console.log(`Full request body: ${JSON.stringify(requestData)}`);
    console.log(`Request headers: ${JSON.stringify(req.headers)}`);
    console.log(`Request query params: ${JSON.stringify(req.query)}`);

    // Create headers for OpenRouter request
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER || 'https://openrouter-key-aggregator.onrender.com',
      'X-Title': process.env.OPENROUTER_X_TITLE || 'OpenRouter Key Aggregator'
    };

    // Special handling for n8n LangChain format
    // n8n might send a single string in chatInput instead of a properly formatted messages array
    if (requestData.chatInput !== undefined) {
      console.log(`[DEBUG] Detected n8n LangChain format with chatInput: ${requestData.chatInput}`);
      // Convert chatInput to proper messages format
      try {
        // If messages array already exists, don't overwrite it
        if (!requestData.messages || !Array.isArray(requestData.messages) || requestData.messages.length === 0) {
          requestData.messages = [
            {
              role: 'user',
              content: String(requestData.chatInput)
            }
          ];
        }
        // Mark this as a chatInput request for special handling later
        requestData._isChatInputRequest = true;
      } catch (error) {
        console.error(`[ERROR] Failed to convert chatInput to messages: ${error.message}`);
      }
    }

    // Remove n8n-specific parameters before sending to OpenRouter
    const openRouterRequestData = { ...requestData };

    // Remove chatInput as it's not supported by OpenRouter
    if (openRouterRequestData.chatInput !== undefined) {
      console.log(`[DEBUG] Removing chatInput parameter before sending to OpenRouter`);
      delete openRouterRequestData.chatInput;
    }

    // Check if streaming is requested
    const isStreamingRequest = openRouterRequestData.stream === true;

    if (isStreamingRequest) {
      console.log(`[DEBUG] Streaming request detected, using direct pipe`);
      
      // For streaming requests, we need to pipe the response directly
      const openRouterUrl = `${process.env.OPENROUTER_API_URL}${endpoint}`;
      
      // Set headers for streaming response
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-OpenRouter-Key-Aggregator-Model', requestData.model || 'unknown');
      res.setHeader('X-OpenRouter-Key-Aggregator-Key', apiKey.substring(0, 4) + '...');
      
      // Create Axios request with responseType: 'stream'
      const axiosResponse = await axios({
        method: req.method,
        url: openRouterUrl,
        headers: headers,
        data: openRouterRequestData,
        responseType: 'stream',
        timeout: 120000 // 2 minute timeout
      });
      
      // Increment key usage
      keyManager.incrementKeyUsage(apiKey, requestData.model);
      
      // Create a transform stream to handle the SSE format properly
      const { Transform } = require('stream');
      const transformStream = new Transform({
        transform(chunk, encoding, callback) {
          // Convert chunk to string
          const chunkStr = chunk.toString();
          
          // Log the chunk for debugging
          console.log(`[STREAM] Received chunk: ${chunkStr.substring(0, 100)}...`);
          
          // Pass through the chunk unchanged
          this.push(chunk);
          callback();
        }
      });
      
      // Pipe through the transform stream
      axiosResponse.data.pipe(transformStream).pipe(res);
      
      // Handle errors in the stream
      axiosResponse.data.on('error', (error) => {
        console.error(`[ERROR] Stream error: ${error.message}`);
        // We can't send headers at this point, as some data might have been sent already
      });
      
      return; // Return early, as we're handling the response via pipe
    }

    // For non-streaming requests, continue with the existing code
    const response = await axios({
      method: req.method,
      url: `${process.env.OPENROUTER_API_URL}${endpoint}`,
      headers: headers,
      data: openRouterRequestData,
      timeout: 120000 // 2 minute timeout
    });

    console.log(`[DEBUG] Request sent to OpenRouter with model: ${requestData.model}`);

    // Log successful response
    console.log(`Received response from OpenRouter with status: ${response.status}`);

    // Increment key usage with model information
    keyManager.incrementKeyUsage(apiKey, requestData.model);

    // Add debug headers to response
    res.setHeader('X-OpenRouter-Key-Aggregator-Model', requestData.model);
    res.setHeader('X-OpenRouter-Key-Aggregator-Key', apiKey.substring(0, 4) + '...');

    // Log the response structure for debugging
    console.log(`[DEBUG] Response structure: ${JSON.stringify(response.data).substring(0, 200)}...`);

    // Special handling for OpenRouter error responses
    if (response.data && response.data.error && !response.data.choices) {
      console.log(`[DEBUG] Detected OpenRouter error response: ${JSON.stringify(response.data.error)}`);
      // Convert OpenRouter error format to a format compatible with n8n
      response.data = {
        id: `error-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: requestData.model || 'error',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: `Error: ${response.data.error.message || 'Unknown error'}`
            },
            finish_reason: 'error'
          }
        ],
        usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0
        },
        error: response.data.error
      };
    }
    // Ensure the response has the expected structure for n8n
    // n8n expects a specific format for chat completions
    else if (endpoint === '/chat/completions' || requestData._isChatInputRequest) {
      // If there's no data or no choices, create a default response
      if (!response.data || !response.data.choices || !Array.isArray(response.data.choices) || response.data.choices.length === 0) {
        console.log(`[DEBUG] No valid choices in response, creating default response`);
        response.data = {
          id: `chatcmpl-${Date.now()}`,
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: requestData.model || 'unknown',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: 'No response generated.'
              },
              finish_reason: 'stop'
            }
          ],
          usage: {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0
          }
        };
      } else {
        console.log(`[DEBUG] Processing ${response.data.choices.length} choices in response`);
        // Use the n8n response formatter to ensure the response is compatible with n8n
        console.log(`[DEBUG] Using n8n response formatter to ensure compatibility`);
        response.data = formatResponseForN8n(response.data, requestData);

        // Add debug information
        response.data._debug = {
          timestamp: new Date().toISOString(),
          formatter: 'n8nResponseFormatter',
          requestPath: req.path,
          requestModel: requestData.model || 'unknown'
        };

        if (!response.data.usage) {
          response.data.usage = {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0
          };
        }
      }

      console.log(`[DEBUG] Final formatted response: ${JSON.stringify(response.data).substring(0, 200)}...`);
    }

    // Add debug information
    if (response.data) {
      response.data._debug = {
        timestamp: new Date().toISOString(),
        endpoint: endpoint,
        requestedModel: requestData.model,
        formatter: 'applied'
      };
    }

    // Format the response for n8n compatibility if this is a chatInput request
    if (requestData._isChatInputRequest) {
      console.log(`[DEBUG] Formatting response for chatInput request`);
      const formattedResponse = formatResponseForN8n(response.data, requestData);
      return res.status(response.status).json(formattedResponse);
    }

    // Return the modified response
    return res.status(response.status).json(response.data);
  } catch (error) {
    // Log detailed error information
    console.error('Proxy request error:');
    console.error(`- Status: ${error.response?.status || 'No status'}`);
    console.error(`- Message: ${error.message}`);
    console.error(`- URL: ${error.config?.url || 'Unknown URL'}`);

    if (error.response?.data) {
      console.error('- Response data:', error.response.data);
    }

    // Handle API key errors
    if (error.response && error.response.status === 429) {
      const apiKey = error.config.headers.Authorization.replace('Bearer ', '');
      keyManager.recordKeyError(apiKey);
      console.error(`Recorded rate limit error for API key: ${apiKey.substring(0, 4)}...`);
    }

    // Extract the error message with special handling for OpenRouter errors
    let errorMessage = error.message || 'Unknown error';
    let errorStatus = error.response?.status || 500;
    let errorData = null;

    // Special handling for OpenRouter error format
    if (error.response?.data?.error) {
      const openRouterError = error.response.data.error;
      errorMessage = openRouterError.message || errorMessage;
      errorStatus = openRouterError.code || errorStatus;
      errorData = openRouterError;

      // Add metadata if available
      if (openRouterError.metadata) {
        errorMessage += ` (${JSON.stringify(openRouterError.metadata)})`;
      }
    }

    // Create a standardized error object
    const errorObj = {
      message: errorMessage,
      status: errorStatus,
      data: errorData
    };

    // Format the error response for n8n
    const errorResponse = formatErrorResponseForN8n(errorObj, req.body || {});

    console.log(`[DEBUG] Created error response for n8n using formatter: ${JSON.stringify(errorResponse).substring(0, 200)}...`);

    // Add detailed debug information
    errorResponse._debug = {
      timestamp: new Date().toISOString(),
      originalError: {
        message: error.message,
        stack: error.stack?.split('\n')[0] || 'No stack trace',
        code: error.code || 'unknown',
        name: error.name || 'Error'
      },
      responseData: error.response?.data ? JSON.stringify(error.response.data).substring(0, 500) : null,
      requestPath: req.path,
      requestModel: req.body?.model || 'unknown',
      formatter: 'n8nResponseFormatter'
    };

    // Return the error response
    return res.status(errorStatus).json(errorResponse);
  }
};

module.exports = {
  proxyRequest
};
