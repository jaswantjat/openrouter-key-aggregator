const axios = require('axios');
const keyManager = require('../utils/keyManager');

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

    // Ensure model name is properly formatted for OpenRouter
    if (requestData.model) {
      console.log(`[DEBUG] Processing model name: ${requestData.model}`);

      // Check if the model is one of our free models but missing the provider prefix
      const freeModels = [
        "meta-llama/llama-4-maverick:free",
        "meta-llama/llama-4-scout:free",
        "google/gemini-2.5-pro-exp-03-25:free",
        "deepseek/deepseek-chat-v3-0324:free",
        "google/gemini-2.0-flash-exp:free"
      ];

      // Try to match the model name to one of our free models
      const matchedModel = freeModels.find(model => {
        // Extract model name without provider
        const modelNameWithoutProvider = model.split('/')[1];
        // Extract base model name without :free suffix
        const baseModelName = modelNameWithoutProvider.split(':')[0];

        return (
          model === requestData.model || // Exact match
          modelNameWithoutProvider === requestData.model || // Match without provider
          baseModelName === requestData.model || // Match without provider and :free
          model.includes(requestData.model) // Partial match
        );
      });

      if (matchedModel) {
        console.log(`[DEBUG] Matched model ${requestData.model} to ${matchedModel}`);
        requestData.model = matchedModel;
      } else {
        console.log(`[DEBUG] No match found for model: ${requestData.model}. Using as is.`);
      }
    } else {
      // If no model is specified, use a default model
      console.log(`[DEBUG] No model specified in request. Using default model.`);
      requestData.model = 'meta-llama/llama-4-scout:free';
      console.log(`[DEBUG] Using default model: ${requestData.model}`);
    }

    // Forward the request to OpenRouter with the modified request body
    const response = await axios({
      method: req.method,
      url: `${process.env.OPENROUTER_API_URL}${endpoint}`,
      headers: headers,
      data: requestData, // Use the modified request data
      timeout: 120000 // 2 minute timeout
    });

    console.log(`[DEBUG] Request sent to OpenRouter with model: ${requestData.model}`);

    // Log successful response
    console.log(`Received response from OpenRouter with status: ${response.status}`);

    // Increment key usage
    keyManager.incrementKeyUsage(apiKey);

    // Return the response
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

    // Create a more detailed error response
    const errorResponse = {
      error: true,
      message: error.message,
      status: error.response?.status,
      details: error.response?.data || {},
      timestamp: new Date().toISOString()
    };

    // Send the error response directly instead of using the error handler
    return res.status(error.response?.status || 500).json(errorResponse);
  }
};

module.exports = {
  proxyRequest
};
