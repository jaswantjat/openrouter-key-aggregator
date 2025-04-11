/**
 * Enhanced Proxy Controller with Streaming Support
 * 
 * This controller handles proxying requests to OpenRouter API with special
 * handling for streaming responses and n8n-specific formats.
 */
const axios = require('axios');
const keyManager = require('../utils/keyManager');
const { ensureValidChatCompletionResponse, createErrorResponse } = require('../utils/responseFormatter');
const { formatResponseForN8n, formatErrorResponseForN8n } = require('../utils/n8nResponseFormatter');
const { Transform } = require('stream');

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
        } else if (requestData.messages.length > 0) {
          // If there's an existing system message but no user message, add the chatInput as a user message
          const hasSystemMessage = requestData.messages.some(msg => msg.role === 'system');
          const hasUserMessage = requestData.messages.some(msg => msg.role === 'user');
          
          if (hasSystemMessage && !hasUserMessage) {
            requestData.messages.push({
              role: 'user',
              content: String(requestData.chatInput)
            });
          }
        }
        
        // Mark this as a chatInput request for special handling later
        requestData._isChatInputRequest = true;
        
        console.log(`[DEBUG] Converted chatInput to messages: ${JSON.stringify(requestData.messages)}`);
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
    
    // Remove internal flags
    if (openRouterRequestData._isChatInputRequest !== undefined) {
      delete openRouterRequestData._isChatInputRequest;
    }

    // Check if streaming is requested
    const isStreamingRequest = openRouterRequestData.stream === true;

    if (isStreamingRequest) {
      console.log(`[DEBUG] Streaming request detected, using direct pipe with transformation`);
      
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
      // This is critical for n8n's LangChain integration which expects a specific format
      const transformStream = new Transform({
        transform(chunk, encoding, callback) {
          // Convert chunk to string
          const chunkStr = chunk.toString();
          
          // Log the chunk for debugging (truncated to avoid huge logs)
          console.log(`[STREAM] Received chunk: ${chunkStr.substring(0, 100)}...`);
          
          // Process the chunk to ensure it has the right format for n8n's LangChain integration
          try {
            // Split the chunk into lines
            const lines = chunkStr.split('\n').filter(line => line.trim() !== '');
            
            // Process each line
            let transformedLines = [];
            
            for (const line of lines) {
              // If it's a data line, process it
              if (line.startsWith('data: ')) {
                const data = line.substring(6);
                
                // If it's the [DONE] marker, pass it through unchanged
                if (data === '[DONE]') {
                  transformedLines.push(line);
                  continue;
                }
                
                try {
                  // Parse the JSON data
                  const jsonData = JSON.parse(data);
                  
                  // Create a new JSON object that we'll modify
                  let newJsonData = { ...jsonData };
                  
                  // Ensure choices array exists
                  if (!newJsonData.choices || !Array.isArray(newJsonData.choices)) {
                    newJsonData.choices = [];
                  }
                  
                  // Process each choice
                  newJsonData.choices = newJsonData.choices.map((choice, index) => {
                    // Create a new choice object
                    const newChoice = { ...choice };
                    
                    // Handle delta format (streaming)
                    if (choice.delta) {
                      // Ensure message exists with content
                      newChoice.message = {
                        role: choice.delta.role || 'assistant',
                        content: choice.delta.content !== undefined ? choice.delta.content : ''
                      };
                      
                      // Copy tool_calls if they exist
                      if (choice.delta.tool_calls) {
                        newChoice.message.tool_calls = choice.delta.tool_calls;
                      }
                    } 
                    // Handle message format (non-streaming or already transformed)
                    else if (choice.message) {
                      // Ensure content exists
                      if (choice.message.content === undefined || choice.message.content === null) {
                        newChoice.message = {
                          ...choice.message,
                          content: '' // Ensure content is at least an empty string
                        };
                      }
                    } 
                    // Handle case where neither delta nor message exists
                    else {
                      newChoice.message = {
                        role: 'assistant',
                        content: '' // Default empty content
                      };
                    }
                    
                    return newChoice;
                  });
                  
                  // If choices array is empty, add a default choice
                  if (newJsonData.choices.length === 0) {
                    newJsonData.choices.push({
                      index: 0,
                      message: {
                        role: 'assistant',
                        content: ''
                      }
                    });
                  }
                  
                  // Add the transformed line
                  transformedLines.push(`data: ${JSON.stringify(newJsonData)}`);
                  
                  // Log the transformation for debugging
                  console.log(`[STREAM] Transformed chunk to ensure message.content exists`);
                } catch (error) {
                  // If there's an error parsing the JSON, pass the line through unchanged
                  console.error(`[ERROR] Failed to parse JSON in streaming response: ${error.message}`);
                  transformedLines.push(line);
                }
              } else {
                // If it's not a data line, pass it through unchanged
                transformedLines.push(line);
              }
            }
            
            // Join the transformed lines and add newlines
            const transformedChunk = transformedLines.join('\n') + '\n\n';
            
            // Push the transformed chunk
            this.push(transformedChunk);
          } catch (error) {
            // If there's an error processing the chunk, pass it through unchanged
            console.error(`[ERROR] Failed to process streaming chunk: ${error.message}`);
            this.push(chunk);
          }
          
          callback();
        }
      });
      
      // Pipe through the transform stream
      axiosResponse.data.pipe(transformStream).pipe(res);
      
      // Handle errors in the stream
      axiosResponse.data.on('error', (error) => {
        console.error(`[ERROR] Stream error: ${error.message}`);
        // We can't send headers at this point, as some data might have been sent already
        
        // Try to send an error event if possible
        try {
          const errorEvent = `data: ${JSON.stringify({
            error: {
              message: error.message,
              type: 'stream_error'
            },
            choices: [{
              index: 0,
              message: {
                role: 'assistant',
                content: `Error: ${error.message}`
              },
              finish_reason: 'error'
            }]
          })}\n\ndata: [DONE]\n\n`;
          
          res.write(errorEvent);
        } catch (writeError) {
          console.error(`[ERROR] Failed to write error event to stream: ${writeError.message}`);
        }
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

    // Log the response structure for debugging (truncated to avoid huge logs)
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
        
        // Ensure each choice has a message with content
        response.data.choices.forEach(choice => {
          if (!choice.message) {
            choice.message = {
              role: 'assistant',
              content: 'No content available'
            };
          } else if (choice.message.content === undefined || choice.message.content === null) {
            // Ensure content is at least an empty string, never undefined or null
            choice.message.content = '';
          }
          
          // Ensure role is set
          if (!choice.message.role) {
            choice.message.role = 'assistant';
          }
        });
        
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
