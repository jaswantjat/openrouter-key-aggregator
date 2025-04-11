/**
 * Enhanced ChatInput Controller for OpenRouter Key Aggregator
 * 
 * This controller handles the chatInput endpoint with improved:
 * - Error handling with automatic retries
 * - Performance metrics tracking
 * - Support for n8n's specific array format
 * - Detailed logging for debugging
 */
const axios = require('axios');
const keyManager = require('../utils/keyManager');
const apiKeyManager = require('../utils/apiKeyManager');
const { formatResponseForN8n, formatErrorResponseForN8n } = require('../utils/n8nResponseFormatter');

/**
 * Handle chatInput requests
 * This is a dedicated endpoint for n8n's chatInput format
 */
const handleChatInput = async (req, res) => {
  console.log(`[DEBUG] chatInput endpoint called with method: ${req.method}`);
  console.log(`[DEBUG] Request body type: ${typeof req.body}, isArray: ${Array.isArray(req.body)}`);
  
  // For array inputs, log the first item structure
  if (Array.isArray(req.body) && req.body.length > 0) {
    console.log(`[DEBUG] First array item keys: ${Object.keys(req.body[0]).join(', ')}`);
  }

  const startTime = Date.now();
  let apiKey, requestData, openRouterKey;

  try {
    // Validate API key
    apiKey = req.headers['x-api-key'] ||
             req.headers['openai-api-key'] ||
             req.headers['authorization-header'] ||
             req.headers['authorization']?.replace('Bearer ', '');

    if (!apiKey) {
      console.log(`[DEBUG] No API key provided`);
      return res.status(401).json({
        error: {
          message: 'Authentication required',
          type: 'authentication_error',
          code: 'missing_api_key'
        }
      });
    }

    // Validate API key format
    if (!apiKeyManager.validateKey(apiKey)) {
      console.log(`[DEBUG] Invalid API key format: ${apiKey.substring(0, 4)}...`);
      return res.status(401).json({
        error: {
          message: 'Invalid API key format',
          type: 'authentication_error',
          code: 'invalid_api_key'
        }
      });
    }

    // Extract request data
    requestData = { ...req.body };
    
    // Handle array input format (n8n specific format)
    if (Array.isArray(requestData) && requestData.length > 0) {
      console.log(`[DEBUG] Detected array input format`);
      
      // Use the first item in the array
      const firstItem = requestData[0];
      
      // Check if it has the expected structure with sessionId, action, and chatInput
      if (firstItem.sessionId && firstItem.action === 'sendMessage' && firstItem.chatInput) {
        console.log(`[DEBUG] Detected n8n specific format with sessionId and action`);
        
        // Extract the chatInput
        requestData = {
          chatInput: firstItem.chatInput,
          model: req.query.model || 'deepseek/deepseek-chat-v3-0324:free', // Default model if not specified
          sessionId: firstItem.sessionId, // Keep the sessionId for reference
          _originalFormat: 'n8n-array' // Mark the original format for response formatting
        };
        
        console.log(`[DEBUG] Extracted chatInput: ${requestData.chatInput}`);
      } else {
        console.log(`[DEBUG] Array input doesn't have expected structure`);
      }
    }

    // Validate chatInput
    if (!requestData.chatInput) {
      console.log(`[DEBUG] No chatInput provided`);
      return res.status(400).json(formatErrorResponseForN8n({
        message: 'chatInput is required',
        code: 'missing_field'
      }, requestData));
    }

    // Set default model if not provided
    if (!requestData.model) {
      requestData.model = 'deepseek/deepseek-chat-v3-0324:free';
      console.log(`[DEBUG] No model provided, using default: ${requestData.model}`);
    }

    // Create messages array from chatInput
    const messages = [
      {
        role: 'user',
        content: String(requestData.chatInput)
      }
    ];

    console.log(`[DEBUG] Created messages array from chatInput: ${JSON.stringify(messages)}`);

    // Create OpenRouter request
    const openRouterRequestData = {
      model: requestData.model,
      messages: messages
    };

    // Handle simplified model names
    if (requestData.model === 'deepseek') {
      openRouterRequestData.model = 'deepseek/deepseek-chat-v3-0324:free';
      console.log(`[DEBUG] Converted simplified model name 'deepseek' to '${openRouterRequestData.model}'`);
    } else if (requestData.model === 'llama-4-maverick') {
      openRouterRequestData.model = 'meta-llama/llama-4-maverick:free';
      console.log(`[DEBUG] Converted simplified model name 'llama-4-maverick' to '${openRouterRequestData.model}'`);
    } else if (requestData.model === 'llama-4-scout') {
      openRouterRequestData.model = 'meta-llama/llama-4-scout:free';
      console.log(`[DEBUG] Converted simplified model name 'llama-4-scout' to '${openRouterRequestData.model}'`);
    }

    // Add any other parameters from the original request
    if (requestData.temperature) openRouterRequestData.temperature = requestData.temperature;
    if (requestData.max_tokens) openRouterRequestData.max_tokens = requestData.max_tokens;
    if (requestData.top_p) openRouterRequestData.top_p = requestData.top_p;
    if (requestData.frequency_penalty) openRouterRequestData.frequency_penalty = requestData.frequency_penalty;
    if (requestData.presence_penalty) openRouterRequestData.presence_penalty = requestData.presence_penalty;
    if (requestData.stop) openRouterRequestData.stop = requestData.stop;

    console.log(`[DEBUG] Created OpenRouter request: ${JSON.stringify(openRouterRequestData)}`);

    // Get an OpenRouter API key
    openRouterKey = await keyManager.getNextKey(openRouterRequestData.model);

    if (!openRouterKey) {
      console.log(`[DEBUG] No OpenRouter API keys available`);
      return res.status(500).json(formatErrorResponseForN8n({
        message: 'No OpenRouter API keys available',
        code: 'server_error'
      }, requestData));
    }

    // Create headers for OpenRouter request
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openRouterKey}`,
      'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER || 'https://openrouter-key-aggregator.onrender.com',
      'X-Title': process.env.OPENROUTER_X_TITLE || 'OpenRouter Key Aggregator'
    };

    // Make the request to OpenRouter with retry logic
    let response;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        const requestStartTime = Date.now();
        
        // Forward the request to OpenRouter
        response = await axios({
          method: 'POST',
          url: `${process.env.OPENROUTER_API_URL || 'https://openrouter.ai/api'}/v1/chat/completions`,
          headers: headers,
          data: openRouterRequestData,
          timeout: 120000 // 2 minute timeout
        });
        
        const requestDuration = Date.now() - requestStartTime;
        console.log(`[DEBUG] Received response from OpenRouter with status: ${response.status} in ${requestDuration}ms`);
        
        // Log the response data structure for debugging
        console.log(`[DEBUG] Response data structure: ${JSON.stringify(Object.keys(response.data))}`);
        
        // Check if the response has the specific OpenRouter format with generations
        if (response.data.response && response.data.response.generations) {
          console.log(`[DEBUG] Detected OpenRouter specific format with generations array`);
          
          // Log the generations structure
          if (Array.isArray(response.data.response.generations) && response.data.response.generations.length > 0) {
            console.log(`[DEBUG] First generation array length: ${response.data.response.generations[0].length}`);
            
            if (Array.isArray(response.data.response.generations[0]) && response.data.response.generations[0].length > 0) {
              const generation = response.data.response.generations[0][0];
              console.log(`[DEBUG] Generation text: ${generation.text.substring(0, 50)}...`);
              console.log(`[DEBUG] Generation info: ${JSON.stringify(generation.generationInfo)}`);
            }
          }
        }
        
        // Record successful request
        await keyManager.incrementKeyUsage(openRouterKey, openRouterRequestData.model, {
          responseTime: requestDuration,
          tokenUsage: response.data.tokenUsage?.totalTokens || 0
        });
        
        // Success, break out of retry loop
        break;
      } catch (error) {
        console.error(`[ERROR] Error in OpenRouter request (attempt ${retryCount + 1}): ${error.message}`);
        
        // Extract error details
        const errorStatus = error.response?.status || 500;
        const errorData = error.response?.data || null;
        
        // Determine error type
        let errorType = 'unknown';
        if (errorStatus === 429 || errorStatus === 402) {
          errorType = 'rate_limit';
        } else if (errorStatus === 401 || errorStatus === 403) {
          errorType = 'authentication';
        } else if (errorStatus >= 500) {
          errorType = 'server';
        }
        
        // Record error for this key
        await keyManager.recordKeyError(openRouterKey, errorType, openRouterRequestData.model);
        
        // Handle rate limit errors with retry
        if (errorType === 'rate_limit') {
          console.log(`[DEBUG] Rate limit hit for key ${openRouterKey.substring(0, 4)}..., marking as rate limited`);
          
          // Mark the key as rate limited
          await keyManager.markKeyRateLimited(openRouterKey);
          
          // Try with another key
          try {
            openRouterKey = await keyManager.getNextKey(openRouterRequestData.model);
            console.log(`[DEBUG] Retrying with new key ${openRouterKey.substring(0, 4)}...`);
            
            // Update headers with new key
            headers.Authorization = `Bearer ${openRouterKey}`;
            
            // Implement exponential backoff
            const backoffTime = Math.min(1000 * Math.pow(2, retryCount), 10000);
            console.log(`[DEBUG] Backing off for ${backoffTime}ms before retry`);
            await new Promise(resolve => setTimeout(resolve, backoffTime));
            
            retryCount++;
            continue; // Try again with new key
          } catch (keyError) {
            console.error(`[ERROR] Failed to get a new key: ${keyError.message}`);
            
            // No more keys available, return error
            return res.status(429).json(formatErrorResponseForN8n({
              message: 'All API keys are rate limited. Please try again later.',
              code: 'rate_limit_exceeded'
            }, requestData));
          }
        } else if (errorType === 'server' && retryCount < maxRetries - 1) {
          // For server errors, retry with the same key after a delay
          const backoffTime = Math.min(1000 * Math.pow(2, retryCount), 10000);
          console.log(`[DEBUG] Server error, backing off for ${backoffTime}ms before retry`);
          await new Promise(resolve => setTimeout(resolve, backoffTime));
          
          retryCount++;
          continue; // Try again with same key
        } else if (errorType === 'authentication') {
          // Authentication errors are fatal, don't retry
          return res.status(errorStatus).json(formatErrorResponseForN8n({
            message: `Authentication error: ${error.message}`,
            code: 'authentication_error'
          }, requestData));
        } else {
          // For other errors, try a new key if we have retries left
          if (retryCount < maxRetries - 1) {
            try {
              openRouterKey = await keyManager.getNextKey(openRouterRequestData.model);
              console.log(`[DEBUG] Retrying with new key ${openRouterKey.substring(0, 4)}... after error`);
              
              // Update headers with new key
              headers.Authorization = `Bearer ${openRouterKey}`;
              
              const backoffTime = Math.min(1000 * Math.pow(2, retryCount), 10000);
              await new Promise(resolve => setTimeout(resolve, backoffTime));
              
              retryCount++;
              continue; // Try again with new key
            } catch (keyError) {
              console.error(`[ERROR] Failed to get a new key: ${keyError.message}`);
            }
          }
          
          // No more retries or keys, return error
          return res.status(errorStatus).json(formatErrorResponseForN8n({
            message: `Error from OpenRouter: ${error.message}`,
            code: errorStatus,
            data: errorData
          }, requestData));
        }
      }
    }
    
    // If we exhausted all retries without success
    if (retryCount >= maxRetries && !response) {
      return res.status(500).json(formatErrorResponseForN8n({
        message: `Failed after ${maxRetries} retries`,
        code: 'max_retries_exceeded'
      }, requestData));
    }

    // Format the response for n8n
    const formattedResponse = formatResponseForN8n(response.data, requestData);

    // Add debug information
    formattedResponse._debug = {
      timestamp: new Date().toISOString(),
      endpoint: 'chatInput',
      model: requestData.model,
      formatter: 'n8nResponseFormatter',
      originalResponseKeys: Object.keys(response.data).join(','),
      processingTime: Date.now() - startTime
    };

    // If the original request was in array format, return the response in array format
    if (requestData._originalFormat === 'n8n-array') {
      console.log(`[DEBUG] Returning response in n8n array format`);
      
      // Create a response that matches the expected format for n8n
      const arrayResponse = [
        {
          sessionId: requestData.sessionId || 'session-123',
          response: {
            generations: [
              [
                {
                  text: formattedResponse.choices[0].message.content,
                  generationInfo: {
                    finish_reason: formattedResponse.choices[0].finish_reason,
                    model_name: formattedResponse.model
                  }
                }
              ]
            ]
          },
          tokenUsage: {
            promptTokens: formattedResponse.usage.prompt_tokens,
            completionTokens: formattedResponse.usage.completion_tokens,
            totalTokens: formattedResponse.usage.total_tokens
          }
        }
      ];
      
      console.log(`[DEBUG] Array response: ${JSON.stringify(arrayResponse).substring(0, 200)}...`);
      return res.json(arrayResponse);
    }

    // Return the formatted response
    return res.json(formattedResponse);
  } catch (error) {
    console.error(`[ERROR] Unhandled error in chatInput endpoint: ${error.message}`);
    console.error(error.stack);

    // Extract error details
    let errorMessage = error.message || 'Unknown error';
    let errorStatus = error.response?.status || 500;
    let errorData = error.response?.data || null;

    console.log(`[DEBUG] Error details: ${errorMessage}, status: ${errorStatus}, data: ${JSON.stringify(errorData)}`);

    // Format the error response for n8n
    const errorResponse = formatErrorResponseForN8n({
      message: errorMessage,
      code: errorStatus,
      metadata: errorData
    }, requestData);

    // Add debug information
    errorResponse._debug = {
      timestamp: new Date().toISOString(),
      endpoint: 'chatInput',
      error: {
        message: error.message,
        stack: error.stack?.split('\n')[0] || 'No stack trace',
        code: error.code || 'unknown',
        name: error.name || 'Error'
      },
      processingTime: Date.now() - startTime
    };

    // If the original request was in array format, return the error in array format
    if (requestData && requestData._originalFormat === 'n8n-array') {
      console.log(`[DEBUG] Returning error in n8n array format`);
      
      // Create an error response that matches the expected format for n8n
      const arrayErrorResponse = [
        {
          sessionId: requestData.sessionId || 'session-error',
          error: {
            message: errorMessage,
            code: errorStatus
          }
        }
      ];
      
      console.log(`[DEBUG] Array error response: ${JSON.stringify(arrayErrorResponse)}`);
      return res.status(errorStatus).json(arrayErrorResponse);
    }

    // Return the error response
    return res.status(errorStatus).json(errorResponse);
  }
};

module.exports = {
  handleChatInput
};
