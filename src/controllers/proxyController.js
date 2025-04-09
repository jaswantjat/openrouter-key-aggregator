const axios = require('axios');
const keyManager = require('../utils/keyManager');
const { ensureValidChatCompletionResponse, createErrorResponse } = require('../utils/responseFormatter');
const { formatResponseForN8n, formatErrorResponseForN8n } = require('../utils/n8nResponseFormatter');

/**
 * Proxy requests to OpenRouter API
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

    // Pass through all headers from the original request
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': req.headers['referer'] || req.headers['http-referer'] || 'https://api-aggregator.example.com',
      'X-Title': req.headers['x-title'] || 'API Key Aggregator'
    };

    // Log the request for debugging
    console.log(`Proxying request to: ${process.env.OPENROUTER_API_URL}${endpoint}`);
    console.log(`Request model: ${req.body.model || 'Not specified'}`);
    console.log(`Full request body: ${JSON.stringify(req.body)}`);
    console.log(`Request headers: ${JSON.stringify(req.headers)}`);

    // Make a copy of the request body to modify if needed
    const requestData = { ...req.body };

    // Special handling for n8n's chatInput format
    // This is a pre-processing step before any other validation
    if (requestData.chatInput !== undefined && (!requestData.messages || !Array.isArray(requestData.messages) || requestData.messages.length === 0)) {
      console.log(`[DEBUG] Detected n8n chatInput format at the beginning of request processing: ${requestData.chatInput}`);
      try {
        requestData.messages = [
          {
            role: 'user',
            content: String(requestData.chatInput)
          }
        ];
        console.log(`[DEBUG] Pre-processed chatInput into messages: ${JSON.stringify(requestData.messages)}`);
      } catch (error) {
        console.log(`[DEBUG] Error pre-processing chatInput: ${error.message}`);
      }
    }

    // Ensure model name is properly formatted for OpenRouter
    if (requestData.model) {
      console.log(`[DEBUG] Processing model name: ${requestData.model}`);

      // Define all supported models - ONLY the exact free models from OpenRouter
      const supportedModels = [
        "meta-llama/llama-4-maverick:free",
        "meta-llama/llama-4-scout:free",
        "google/gemini-2.5-pro-exp-03-25:free",
        "deepseek/deepseek-chat-v3-0324:free",
        "google/gemini-2.0-flash-exp:free"
      ];

      // Create a comprehensive mapping for all possible model name formats
      // This ensures compatibility with different clients including n8n
      const modelMappings = {};

      // Generate mappings for each supported model
      supportedModels.forEach(fullModelName => {
        // Add the full model name as a key
        modelMappings[fullModelName] = fullModelName;

        // Extract provider and model parts
        const parts = fullModelName.split('/');
        const provider = parts[0];
        let modelName = parts[1] || fullModelName;

        // Remove :free suffix if present
        const modelNameWithoutSuffix = modelName.split(':')[0];

        // Add model name without provider as a key
        modelMappings[modelName] = fullModelName;

        // Add model name without provider and without :free suffix as a key
        modelMappings[modelNameWithoutSuffix] = fullModelName;

        // Add provider/model without :free suffix as a key
        modelMappings[`${provider}/${modelNameWithoutSuffix}`] = fullModelName;

        // Special handling for deepseek models
        if (fullModelName.includes('deepseek')) {
          // Add 'deepseek' as a key
          modelMappings['deepseek'] = fullModelName;
          // Add 'deepseek-chat' as a key
          modelMappings['deepseek-chat'] = fullModelName;
          // Add 'deepseek-chat-v3' as a key
          modelMappings['deepseek-chat-v3'] = fullModelName;
          // Add 'deepseek-chat-v3-0324' as a key
          modelMappings['deepseek-chat-v3-0324'] = fullModelName;
        }
      });

      // Log all available model mappings for debugging
      console.log(`[DEBUG] Available model mappings:`, JSON.stringify(modelMappings));

      // Try exact match first
      if (modelMappings[requestData.model]) {
        console.log(`[DEBUG] Found exact match for ${requestData.model} -> ${modelMappings[requestData.model]}`);
        requestData.model = modelMappings[requestData.model];
      } else {
        // Try case-insensitive match
        const lowerCaseModel = requestData.model.toLowerCase();
        const matchingKey = Object.keys(modelMappings).find(key =>
          key.toLowerCase() === lowerCaseModel ||
          key.toLowerCase().includes(lowerCaseModel));

        if (matchingKey) {
          console.log(`[DEBUG] Found case-insensitive match for ${requestData.model} -> ${modelMappings[matchingKey]}`);
          requestData.model = modelMappings[matchingKey];
        } else {
          // If still no match, check if it's one of our supported models directly
          const directMatch = supportedModels.find(model =>
            model.toLowerCase().includes(lowerCaseModel));

          if (directMatch) {
            console.log(`[DEBUG] Found direct match for ${requestData.model} -> ${directMatch}`);
            requestData.model = directMatch;
          } else {
            console.log(`[DEBUG] No match found for model: ${requestData.model}. Using default model.`);
            // Use a default model if no match is found
            requestData.model = 'meta-llama/llama-4-scout:free';
          }
        }
      }
    } else {
      // If no model is specified, use a default model
      console.log(`[DEBUG] No model specified in request. Using default model.`);
      requestData.model = 'meta-llama/llama-4-scout:free';
      console.log(`[DEBUG] Using default model: ${requestData.model}`);
    }

    // Validate and format messages array for n8n compatibility
    if (endpoint === '/chat/completions') {
      // Log the entire request data for debugging
      console.log(`[DEBUG] Full request data: ${JSON.stringify(requestData)}`);

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
            console.log(`[DEBUG] Created messages array from chatInput: ${JSON.stringify(requestData.messages)}`);
          } else {
            console.log(`[DEBUG] Messages array already exists, not overwriting: ${JSON.stringify(requestData.messages)}`);
          }
        } catch (error) {
          console.log(`[DEBUG] Error converting chatInput to messages: ${error.message}`);
          // Create a default messages array
          requestData.messages = [
            {
              role: 'user',
              content: String(requestData.chatInput || 'Hello')
            }
          ];
          console.log(`[DEBUG] Created default messages array: ${JSON.stringify(requestData.messages)}`);
        }
      } else {
        console.log(`[DEBUG] No chatInput found in request data`);
      }

      // Validate required fields
      if (!requestData.model) {
        const errorResponse = {
          id: `error-${Date.now()}`,
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: 'error',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: 'Error: model is required'
            },
            finish_reason: 'error'
          }],
          usage: {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0
          },
          error: { message: 'model is required', code: 'missing_field' }
        };
        console.log(`[DEBUG] Returning error response for missing model: ${JSON.stringify(errorResponse)}`);
        return res.status(400).json(errorResponse);
      }

      // Validate and format messages array for n8n compatibility
      if (!requestData.messages || !Array.isArray(requestData.messages) || requestData.messages.length === 0) {
        // Create a default messages array if none exists
        console.log(`[DEBUG] No valid messages array, creating default`);
        requestData.messages = [
          {
            role: 'user',
            content: requestData.chatInput || 'Hello'
          }
        ];
        console.log(`[DEBUG] Created default messages array: ${JSON.stringify(requestData.messages)}`);
      }

      // Final validation to ensure we have a valid messages array
      if (!requestData.messages || !Array.isArray(requestData.messages) || requestData.messages.length === 0) {
        console.log(`[DEBUG] Messages array is still invalid after all attempts, returning error`);
        const errorResponse = {
          id: `error-${Date.now()}`,
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: requestData.model || 'error',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: 'Error: Failed to create a valid messages array'
            },
            finish_reason: 'error'
          }],
          usage: {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0
          },
          error: { message: 'Failed to create a valid messages array', code: 'validation_error' }
        };
        console.log(`[DEBUG] Returning error response for invalid messages array: ${JSON.stringify(errorResponse)}`);
        return res.status(400).json(errorResponse);
      }

      // This check is now redundant as we've already handled empty messages arrays above

      // Ensure each message has role and content
      for (let i = 0; i < requestData.messages.length; i++) {
        const message = requestData.messages[i];

        // If message is missing role, set default to 'user'
        if (!message.role) {
          console.log(`[DEBUG] Adding missing role to message at index ${i}`);
          message.role = 'user';
        }

        // If message is missing content, set to empty string
        if (message.content === undefined || message.content === null) {
          console.log(`[DEBUG] Adding missing content to message at index ${i}`);
          message.content = '';
        }

        // Convert content to string if it's not already
        if (typeof message.content !== 'string') {
          console.log(`[DEBUG] Converting non-string content to string for message at index ${i}: ${typeof message.content}`);
          // If it's an array (multimodal content), extract text parts
          if (Array.isArray(message.content)) {
            let textContent = '';
            message.content.forEach(part => {
              if (typeof part === 'string') {
                textContent += part;
              } else if (part && part.type === 'text' && part.text) {
                textContent += part.text;
              }
            });
            message.content = textContent;
          } else {
            // Otherwise convert to string
            message.content = String(message.content);
          }
        }
      }

      console.log(`[DEBUG] Final formatted messages: ${JSON.stringify(requestData.messages)}`);
    }

    // Remove n8n-specific parameters before sending to OpenRouter
    const openRouterRequestData = { ...requestData };

    // Remove chatInput as it's not supported by OpenRouter
    if (openRouterRequestData.chatInput !== undefined) {
      console.log(`[DEBUG] Removing chatInput parameter before sending to OpenRouter`);
      delete openRouterRequestData.chatInput;
    }

    // Forward the request to OpenRouter with the modified request body
    const response = await axios({
      method: req.method,
      url: `${process.env.OPENROUTER_API_URL}${endpoint}`,
      headers: headers,
      data: openRouterRequestData, // Use the cleaned request data
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
      console.log(`[DEBUG] Converted error response: ${JSON.stringify(response.data).substring(0, 200)}...`);
    }
    // Ensure the response has the expected structure for n8n
    // n8n expects a specific format for chat completions
    else if (endpoint === '/chat/completions') {
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

    // Use the n8n error response formatter to ensure the response is compatible with n8n
    const errorObj = {
      message: errorMessage,
      code: errorStatus,
      metadata: errorData
    };

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

    // Send the error response directly instead of using the error handler
    return res.status(error.response?.status || 500).json(errorResponse);
  }
};

module.exports = {
  proxyRequest
};
