require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { errorHandler } = require('./src/middleware/errorHandler');
const keyManager = require('./src/utils/keyManager');
const apiKeyManager = require('./src/utils/apiKeyManager');
const { authenticate } = require('./src/middleware/auth');
const { apiKeyAuth } = require('./src/middleware/apiKeyAuth');

const app = express();
const PORT = process.env.PORT || 3000;

// Debug middleware to log all requests
app.use((req, res, next) => {
  console.log(`[DEBUG] ${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Auth middleware functions
const getBasicAuthMiddleware = (req, res, next) => {
  if (process.env.AUTH_ENABLED !== 'true') {
    return next();
  }
  return authenticate(req, res, next);
};

const getApiKeyAuthMiddleware = (req, res, next) => {
  if (process.env.API_KEY_AUTH_ENABLED !== 'true') {
    return next();
  }
  return apiKeyAuth(req, res, next);
};

// Explicit route for /models (n8n compatibility)
app.get('/models', (req, res) => {
  console.log('[DEBUG] Direct /models route hit');
  
  // Return a list of models in OpenAI format
  res.json({
    object: "list",
    data: [
      {
        id: "meta-llama/llama-4-maverick:free",
        object: "model",
        created: 1714348800,
        owned_by: "meta-llama"
      },
      {
        id: "meta-llama/llama-4-scout:free",
        object: "model",
        created: 1714348800,
        owned_by: "meta-llama"
      },
      {
        id: "google/gemini-2.5-pro-exp-03-25:free",
        object: "model",
        created: 1714348800,
        owned_by: "google"
      },
      {
        id: "deepseek/deepseek-chat-v3-0324:free",
        object: "model",
        created: 1714348800,
        owned_by: "deepseek"
      },
      {
        id: "google/gemini-2.0-flash-exp:free",
        object: "model",
        created: 1714348800,
        owned_by: "google"
      }
    ]
  });
});

// Explicit route for /v1/models
app.get('/v1/models', (req, res) => {
  console.log('[DEBUG] Direct /v1/models route hit');
  
  // Return a list of models in OpenAI format
  res.json({
    object: "list",
    data: [
      {
        id: "meta-llama/llama-4-maverick:free",
        object: "model",
        created: 1714348800,
        owned_by: "meta-llama"
      },
      {
        id: "meta-llama/llama-4-scout:free",
        object: "model",
        created: 1714348800,
        owned_by: "meta-llama"
      },
      {
        id: "google/gemini-2.5-pro-exp-03-25:free",
        object: "model",
        created: 1714348800,
        owned_by: "google"
      },
      {
        id: "deepseek/deepseek-chat-v3-0324:free",
        object: "model",
        created: 1714348800,
        owned_by: "deepseek"
      },
      {
        id: "google/gemini-2.0-flash-exp:free",
        object: "model",
        created: 1714348800,
        owned_by: "google"
      }
    ]
  });
});

// Explicit route for /api/v1/models
app.get('/api/v1/models', (req, res) => {
  console.log('[DEBUG] Direct /api/v1/models route hit');
  
  // Return a list of models in OpenAI format
  res.json({
    object: "list",
    data: [
      {
        id: "meta-llama/llama-4-maverick:free",
        object: "model",
        created: 1714348800,
        owned_by: "meta-llama"
      },
      {
        id: "meta-llama/llama-4-scout:free",
        object: "model",
        created: 1714348800,
        owned_by: "meta-llama"
      },
      {
        id: "google/gemini-2.5-pro-exp-03-25:free",
        object: "model",
        created: 1714348800,
        owned_by: "google"
      },
      {
        id: "deepseek/deepseek-chat-v3-0324:free",
        object: "model",
        created: 1714348800,
        owned_by: "deepseek"
      },
      {
        id: "google/gemini-2.0-flash-exp:free",
        object: "model",
        created: 1714348800,
        owned_by: "google"
      }
    ]
  });
});

// Proxy function
const proxyRequest = async (req, res) => {
  try {
    // Get the next available API key
    const apiKey = keyManager.getNextKey();

    // Determine the endpoint based on the request path
    let endpoint = '/chat/completions';
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

    // Forward the request to OpenRouter with the original request body
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

// Proxy routes
app.post('/api/proxy/chat/completions', getApiKeyAuthMiddleware, proxyRequest);
app.post('/api/proxy/completions', getApiKeyAuthMiddleware, proxyRequest);
app.post('/api/proxy/embeddings', getApiKeyAuthMiddleware, proxyRequest);

// OpenAI SDK compatible routes
app.post('/api/v1/chat/completions', getApiKeyAuthMiddleware, proxyRequest);
app.post('/api/v1/completions', getApiKeyAuthMiddleware, proxyRequest);
app.post('/api/v1/embeddings', getApiKeyAuthMiddleware, proxyRequest);

app.post('/v1/chat/completions', getApiKeyAuthMiddleware, proxyRequest);
app.post('/v1/completions', getApiKeyAuthMiddleware, proxyRequest);
app.post('/v1/embeddings', getApiKeyAuthMiddleware, proxyRequest);

// API Key management routes
app.post('/api/keys', getBasicAuthMiddleware, (req, res) => {
  const { name, rateLimit } = req.body;
  const key = apiKeyManager.generateApiKey(name, rateLimit);
  res.json({
    success: true,
    key
  });
});

app.get('/api/keys', getBasicAuthMiddleware, (req, res) => {
  const keys = apiKeyManager.getApiKeys();
  res.json({
    success: true,
    keys
  });
});

app.delete('/api/keys/:key', getBasicAuthMiddleware, (req, res) => {
  const key = req.params.key;
  const success = apiKeyManager.revokeApiKey(key);
  if (success) {
    res.json({
      success: true,
      message: `API key ${key} revoked successfully`
    });
  } else {
    res.status(404).json({
      success: false,
      message: `API key ${key} not found`
    });
  }
});

app.get('/api/keys/export', getBasicAuthMiddleware, (req, res) => {
  const exportData = apiKeyManager.exportApiKeys();
  res.json({
    success: true,
    data: {
      environmentVariable: 'CLIENT_API_KEYS',
      value: exportData
    }
  });
});

// Status route
app.get('/api/status', getBasicAuthMiddleware, (req, res) => {
  const keys = keyManager.getKeyStatus();
  res.json({
    keys,
    totalKeys: keys.length,
    activeKeys: keys.filter(k => !k.disabled).length
  });
});

// Home route - JSON info
app.get('/api', (req, res) => {
  res.json({
    message: 'OpenRouter API Key Aggregator',
    status: 'running',
    endpoints: {
      proxy: '/api/proxy',
      status: '/api/status',
      apiKeys: '/api/keys'
    }
  });
});

// Home route - Redirect to admin dashboard
app.get('/', (req, res) => {
  res.redirect('/admin.html');
});

// Catch-all route for debugging n8n requests
app.all('*', (req, res) => {
  console.log(`[DEBUG] Unhandled request: ${req.method} ${req.url}`);
  
  // For n8n compatibility, return a 200 response with empty data
  if (req.url.includes('/models')) {
    return res.json({
      object: "list",
      data: []
    });
  }
  
  res.status(404).json({
    error: true,
    message: `Route not found: ${req.method} ${req.url}`,
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
