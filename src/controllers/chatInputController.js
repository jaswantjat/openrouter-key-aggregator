/**
 * Controller for handling n8n's chatInput format
 */
const axios = require('axios');
const keyManager = require('../utils/keyManager');
const { formatResponseForN8n, formatErrorResponseForN8n } = require('../utils/n8nResponseFormatter');

/**
 * Handle chatInput requests
 * This is a dedicated endpoint for n8n's chatInput format
 */
const handleChatInput = async (req, res) => {
  console.log(`[DEBUG] chatInput endpoint called with method: ${req.method}`);
  
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
    if (!keyManager.isValidApiKey(apiKey)) {
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
    const requestData = { ...req.body };
    
    // Validate chatInput
    if (!requestData.chatInput) {
      console.log(`[DEBUG] No chatInput provided`);
      return res.status(400).json(formatErrorResponseForN8n({
        message: 'chatInput is required',
        code: 'missing_field'
      }));
    }
    
    // Validate model
    if (!requestData.model) {
      console.log(`[DEBUG] No model provided`);
      return res.status(400).json(formatErrorResponseForN8n({
        message: 'model is required',
        code: 'missing_field'
      }));
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
    
    // Increment key usage with model information
    keyManager.incrementKeyUsage(apiKey, requestData.model);
    
    // Format the response for n8n
    const formattedResponse = formatResponseForN8n(response.data);
    
    // Add debug information
    formattedResponse._debug = {
      timestamp: new Date().toISOString(),
      endpoint: 'chatInput',
      model: requestData.model,
      formatter: 'n8nResponseFormatter'
    };
    
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
    
    // Return the error response
    return res.status(errorStatus).json(errorResponse);
  }
};

module.exports = {
  handleChatInput
};
