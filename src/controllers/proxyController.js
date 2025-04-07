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

    // Forward the request to OpenRouter with the original request body
    // This preserves the model selection and all other parameters
    const response = await axios({
      method: req.method,
      url: `${process.env.OPENROUTER_API_URL}${endpoint}`,
      headers: headers,
      data: req.body,
      timeout: 120000 // 2 minute timeout
    });

    // Increment key usage
    keyManager.incrementKeyUsage(apiKey);

    // Return the response
    return res.status(response.status).json(response.data);
  } catch (error) {
    // Handle API key errors
    if (error.response && error.response.status === 429) {
      const apiKey = error.config.headers.Authorization.replace('Bearer ', '');
      keyManager.recordKeyError(apiKey);
    }

    next(error);
  }
};

module.exports = {
  proxyRequest
};
