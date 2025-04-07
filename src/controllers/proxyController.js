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
    if (req.path.includes('/completions') && !req.path.includes('/chat/completions')) {
      endpoint = '/completions';
    } else if (req.path.includes('/embeddings')) {
      endpoint = '/embeddings';
    }

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

    // Forward the request to OpenRouter with the original request body
    // This preserves the model selection and all other parameters
    const response = await axios({
      method: req.method,
      url: `${process.env.OPENROUTER_API_URL}${endpoint}`,
      headers: headers,
      data: req.body,
      timeout: 120000 // 2 minute timeout
    });

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
