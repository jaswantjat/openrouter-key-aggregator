/**
 * Controller for handling n8n's chatInput format
 * 
 * Updated to handle the specific n8n chatInput format with sessionId and action fields.
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
  console.log(`[DEBUG] Request body: ${JSON.stringify(req.body)}`);

  try {
    // Validate API key
    const apiKey = req.headers['x-api-key'] ||
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
    let requestData = { ...req.body };
    
    // Handle array input format
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
          sessionId: firstItem.sessionId // Keep the sessionId for reference
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
      }));
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
    const openRouterKey = keyManager.getNextKey();

    if (!openRouterKey) {
      console.log(`[DEBUG] No OpenRouter API keys available`);
      return res.status(500).json(formatErrorResponseForN8n({
        message: 'No OpenRouter API keys available',
        code: 'server_error'
      }));
    }

    // Create headers for OpenRouter request
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openRouterKey}`,
      'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER || 'https://openrouter-key-aggregator.onrender.com',
      'X-Title': process.env.OPENROUTER_X_TITLE || 'OpenRouter Key Aggregator'
    };

    // Forward the request to OpenRouter
    const response = await axios({
      method: 'POST',
      url: `${process.env.OPENROUTER_API_URL}/chat/completions`,
      headers: headers,
      data: openRouterRequestData,
      timeout: 120000 // 2 minute timeout
    });

    console.log(`[DEBUG] Received response from OpenRouter with status: ${response.status}`);
    
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
          console.log(`[DEBUG] Generation text: ${generation.text}`);
          console.log(`[DEBUG] Generation info: ${JSON.stringify(generation.generationInfo)}`);
        }
      }
    }

    // Increment key usage with model information
    keyManager.incrementKeyUsage(apiKey, requestData.model);

    // Format the response for n8n
    const formattedResponse = formatResponseForN8n(response.data, requestData);

    // Add debug information
    formattedResponse._debug = {
      timestamp: new Date().toISOString(),
      endpoint: 'chatInput',
      model: requestData.model,
      formatter: 'n8nResponseFormatter',
      originalResponseKeys: Object.keys(response.data).join(',')
    };

    // If the original request was in array format, return the response in array format
    if (Array.isArray(req.body)) {
      console.log(`[DEBUG] Returning response in array format`);
      
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
    console.error(`[ERROR] Error in chatInput endpoint: ${error.message}`);

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
    });

    // Add debug information
    errorResponse._debug = {
      timestamp: new Date().toISOString(),
      endpoint: 'chatInput',
      error: {
        message: error.message,
        stack: error.stack?.split('\n')[0] || 'No stack trace',
        code: error.code || 'unknown',
        name: error.name || 'Error'
      }
    };

    // If the original request was in array format, return the error in array format
    if (Array.isArray(req.body)) {
      console.log(`[DEBUG] Returning error in array format`);
      
      // Create an error response that matches the expected format for n8n
      const arrayErrorResponse = [
        {
          sessionId: req.body[0]?.sessionId || 'session-error',
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
