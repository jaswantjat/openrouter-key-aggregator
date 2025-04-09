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

      // Define all supported models
      const supportedModels = [
        "meta-llama/llama-4-maverick:free",
        "meta-llama/llama-4-scout:free",
        "google/gemini-2.5-pro-exp-03-25:free",
        "deepseek/deepseek-chat-v3-0324:free",
        "google/gemini-2.0-flash-exp:free",
        "anthropic/claude-3-opus",
        "openai/gpt-4o"
      ];

      // Create a mapping of simplified names to full model names
      const modelMappings = {};

      // Generate various aliases for each model
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

        // For models like gemini-2.0-flash-exp, add simplified names
        if (modelNameWithoutSuffix.includes('-')) {
          const parts = modelNameWithoutSuffix.split('-');

          // Create simplified names by removing version numbers
          // e.g., gemini-2.0-flash-exp -> gemini-flash
          const simplifiedName = parts
            .filter(part => !part.match(/^\d/) && part !== 'exp' && part.length > 2)
            .join('-');

          if (simplifiedName && simplifiedName !== modelNameWithoutSuffix) {
            modelMappings[simplifiedName] = fullModelName;
          }

          // For llama models, add even more simplified names
          if (modelNameWithoutSuffix.includes('llama')) {
            if (modelNameWithoutSuffix.includes('scout')) {
              modelMappings['llama-scout'] = fullModelName;
              modelMappings['scout'] = fullModelName;
            } else if (modelNameWithoutSuffix.includes('maverick')) {
              modelMappings['llama-maverick'] = fullModelName;
              modelMappings['maverick'] = fullModelName;
            }
          }

          // For gemini models
          if (modelNameWithoutSuffix.includes('gemini')) {
            if (modelNameWithoutSuffix.includes('flash')) {
              modelMappings['gemini-flash'] = fullModelName;
              modelMappings['flash'] = fullModelName;
            } else if (modelNameWithoutSuffix.includes('pro')) {
              modelMappings['gemini-pro'] = fullModelName;
              modelMappings['pro'] = fullModelName;
            }
          }

          // For claude models
          if (modelNameWithoutSuffix.includes('claude')) {
            if (modelNameWithoutSuffix.includes('opus')) {
              modelMappings['claude-opus'] = fullModelName;
              modelMappings['opus'] = fullModelName;
            }
          }
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

    // Increment key usage with model information
    keyManager.incrementKeyUsage(apiKey, requestData.model);

    // Add debug headers to response
    res.setHeader('X-OpenRouter-Key-Aggregator-Model', requestData.model);
    res.setHeader('X-OpenRouter-Key-Aggregator-Key', apiKey.substring(0, 4) + '...');

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
