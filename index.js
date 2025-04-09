require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Import controllers and middleware
const modelsController = require('./src/controllers/modelsController');
const { apiKeyAuth: importedApiKeyAuth } = require('./src/middleware/apiKeyAuth');
const { modelValidator } = require('./src/middleware/modelValidator');

const app = express();
const PORT = process.env.PORT || 3000;

// In-memory storage for API keys and OpenRouter keys
let openRouterKeys = [];
let clientApiKeys = [];

// Initialize OpenRouter API keys
function initializeOpenRouterKeys() {
  const keysString = process.env.OPENROUTER_API_KEYS || '';
  openRouterKeys = keysString.split(',').filter(key => key.trim()).map(key => ({
    key: key.trim(),
    dailyCount: 0,
    minuteCount: 0,
    lastUsed: 0,
    disabled: false
  }));

  console.log(`Initialized ${openRouterKeys.length} API keys`);

  // Schedule daily counter reset
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const timeUntilReset = tomorrow - now;
  const minutesUntilReset = Math.floor(timeUntilReset / (1000 * 60));

  console.log(`Scheduled counter reset in ${minutesUntilReset} minutes`);

  setTimeout(() => {
    resetDailyCounters();
  }, timeUntilReset);
}

// Reset daily counters
function resetDailyCounters() {
  openRouterKeys.forEach(keyData => {
    keyData.dailyCount = 0;
  });

  console.log('Daily counters reset');

  // Schedule next reset
  setTimeout(() => {
    resetDailyCounters();
  }, 24 * 60 * 60 * 1000);
}

// Get next available API key
function getNextKey() {
  // Check if we have any OpenRouter API keys configured
  if (openRouterKeys.length === 0) {
    throw new Error('No OpenRouter API keys configured. Please add valid API keys to the OPENROUTER_API_KEYS environment variable.');
  }

  // Filter out disabled keys and keys that have reached the daily limit
  const availableKeys = openRouterKeys.filter(keyData =>
    !keyData.disabled && keyData.dailyCount < 200
  );

  if (availableKeys.length === 0) {
    throw new Error('No available API keys. All keys are either disabled or have reached their daily limit.');
  }

  // Sort by last used timestamp (oldest first)
  availableKeys.sort((a, b) => a.lastUsed - b.lastUsed);

  return availableKeys[0].key;
}

// Increment key usage
function incrementKeyUsage(key) {
  const keyData = openRouterKeys.find(k => k.key === key);
  if (keyData) {
    keyData.dailyCount++;
    keyData.minuteCount++;
    keyData.lastUsed = Date.now();

    // Reset minute counter after 1 minute
    setTimeout(() => {
      keyData.minuteCount--;
    }, 60 * 1000);
  }
}

// Initialize client API keys
function initializeClientApiKeys() {
  const keysString = process.env.CLIENT_API_KEYS || '';
  if (!keysString) {
    console.log('Initialized 0 client API keys');
    return;
  }

  clientApiKeys = keysString.split(',').filter(keyString => keyString.trim()).map(keyString => {
    // Format should be "name:key:rateLimit"
    const [name, key, rateLimit] = keyString.split(':');
    return {
      name,
      key,
      rateLimit: parseInt(rateLimit) || 0, // 0 means unlimited
      requests: 0,
      lastUsed: null,
    };
  });

  console.log(`Initialized ${clientApiKeys.length} client API keys`);
}

// Generate a new client API key
function generateApiKey(name, rateLimit) {
  const key = crypto.randomBytes(16).toString('hex');
  const parsedRateLimit = parseInt(rateLimit) || 0;

  clientApiKeys.push({
    name,
    key,
    rateLimit: parsedRateLimit,
    requests: 0,
    lastUsed: null,
  });

  // Update environment variable
  updateClientApiKeysEnv();

  return key;
}

// Update CLIENT_API_KEYS environment variable
function updateClientApiKeysEnv() {
  const keysString = clientApiKeys.map(keyInfo => {
    return `${keyInfo.name}:${keyInfo.key}:${keyInfo.rateLimit}`;
  }).join(',');

  process.env.CLIENT_API_KEYS = keysString;

  // If running locally, update .env file
  if (process.env.NODE_ENV !== 'production') {
    try {
      const envPath = path.join(__dirname, '.env');
      let envContent = fs.readFileSync(envPath, 'utf8');

      // Replace or add CLIENT_API_KEYS
      if (envContent.includes('CLIENT_API_KEYS=')) {
        envContent = envContent.replace(/CLIENT_API_KEYS=.*/, `CLIENT_API_KEYS=${keysString}`);
      } else {
        envContent += `\nCLIENT_API_KEYS=${keysString}`;
      }

      fs.writeFileSync(envPath, envContent);
    } catch (error) {
      console.error('Error updating .env file:', error);
    }
  }
}

// Revoke a client API key
function revokeApiKey(key) {
  const initialLength = clientApiKeys.length;
  clientApiKeys = clientApiKeys.filter(keyInfo => keyInfo.key !== key);

  if (clientApiKeys.length < initialLength) {
    updateClientApiKeysEnv();
    return true;
  }

  return false;
}

// Get all client API keys (masked)
function getApiKeys() {
  return clientApiKeys.map(keyInfo => {
    const maskedKey = keyInfo.key.substring(0, 4) + '...' + keyInfo.key.substring(keyInfo.key.length - 4);
    return {
      name: keyInfo.name,
      key: maskedKey,
      rateLimit: keyInfo.rateLimit,
      requests: keyInfo.requests,
      lastUsed: keyInfo.lastUsed ? new Date(keyInfo.lastUsed).toISOString() : null,
    };
  });
}

// Export client API keys
function exportApiKeys() {
  return clientApiKeys.map(keyInfo => {
    return `${keyInfo.name}:${keyInfo.key}:${keyInfo.rateLimit}`;
  }).join(',');
}

// Verify client API key
function verifyApiKey(key) {
  const keyInfo = clientApiKeys.find(k => k.key === key);
  if (!keyInfo) {
    return false;
  }

  // Check rate limit
  if (keyInfo.rateLimit > 0 && keyInfo.requests >= keyInfo.rateLimit) {
    return false;
  }

  // Update usage
  keyInfo.requests++;
  keyInfo.lastUsed = Date.now();

  // Reset requests counter after 1 minute
  setTimeout(() => {
    keyInfo.requests--;
  }, 60 * 1000);

  return true;
}

// Get OpenRouter key status
function getKeyStatus() {
  return openRouterKeys.map(keyData => {
    const maskedKey = keyData.key.substring(0, 4) + '...' + keyData.key.substring(keyData.key.length - 4);
    return {
      key: maskedKey,
      dailyCount: keyData.dailyCount,
      minuteCount: keyData.minuteCount,
      lastUsed: keyData.lastUsed ? new Date(keyData.lastUsed).toISOString() : null,
      disabled: keyData.disabled,
      dailyRemaining: 200 - keyData.dailyCount
    };
  });
}

// Initialize keys
initializeOpenRouterKeys();
initializeClientApiKeys();

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'x-api-key', 'OpenAI-Organization']
}));
app.use(express.json());
app.use(express.static('public'));

// Handle OPTIONS requests for CORS preflight
app.options('*', cors());

// Authentication middleware
function authenticate(req, res, next) {
  if (process.env.AUTH_ENABLED !== 'true') {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return res.status(401).json({
      error: true,
      message: 'Authentication required'
    });
  }

  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('utf8');
  const [username, password] = credentials.split(':');

  if (username !== process.env.AUTH_USERNAME || password !== process.env.AUTH_PASSWORD) {
    return res.status(401).json({
      error: true,
      message: 'Invalid credentials'
    });
  }

  next();
}

// API Key authentication middleware
function apiKeyAuth(req, res, next) {
  if (process.env.API_KEY_AUTH_ENABLED !== 'true') {
    return next();
  }

  // Check for API key in header or query parameter
  const apiKey = req.headers['x-api-key'] || req.query.api_key;

  if (!apiKey) {
    return res.status(401).json({
      error: true,
      message: 'Authentication required'
    });
  }

  if (!verifyApiKey(apiKey)) {
    return res.status(401).json({
      error: true,
      message: 'Invalid API key or rate limit exceeded'
    });
  }

  next();
}

// Explicit route for /models (n8n compatibility)
app.get('/models', importedApiKeyAuth, async (req, res) => {
  console.log('[DEBUG] Direct /models route hit');
  await modelsController.getModels(req, res);
});

// Special routes for when base URL includes /v1/chat/completions
app.get('/v1/chat/completions/v1/models', importedApiKeyAuth, async (req, res) => {
  console.log('[DEBUG] Special route /v1/chat/completions/v1/models hit');
  await modelsController.getModels(req, res);
});

// Special route for n8n integration when base URL is /v1/chat/completions
app.get('/v1/models', importedApiKeyAuth, async (req, res) => {
  console.log('[DEBUG] Direct /v1/models route hit for n8n integration');
  await modelsController.getModels(req, res);
});

// Special route for when base URL includes just /chat/completions
app.get('/chat/completions/v1/models', importedApiKeyAuth, async (req, res) => {
  console.log('[DEBUG] Special route /chat/completions/v1/models hit');
  await modelsController.getModels(req, res);
});

// Special route for when base URL includes /api/v1/chat/completions
app.get('/api/v1/chat/completions/v1/models', importedApiKeyAuth, async (req, res) => {
  console.log('[DEBUG] Special route /api/v1/chat/completions/v1/models hit');
  await modelsController.getModels(req, res);
});

// Special route for when base URL includes just /api/chat/completions
app.get('/api/chat/completions/v1/models', importedApiKeyAuth, async (req, res) => {
  console.log('[DEBUG] Special route /api/chat/completions/v1/models hit');
  await modelsController.getModels(req, res);
});

// Special route for when base URL includes just /completions
app.get('/completions/v1/models', importedApiKeyAuth, async (req, res) => {
  console.log('[DEBUG] Special route /completions/v1/models hit');
  await modelsController.getModels(req, res);
});

// Explicit route for /v1/models
app.get('/v1/models', importedApiKeyAuth, async (req, res) => {
  console.log('[DEBUG] Direct /v1/models route hit');
  await modelsController.getModels(req, res);
});

// Explicit route for /v1/models/:model
app.get('/v1/models/:model*', importedApiKeyAuth, async (req, res) => {
  // Extract the full model name from the URL
  const fullPath = req.path;
  const modelName = fullPath.replace('/v1/models/', '');
  console.log(`[DEBUG] Direct /v1/models/${modelName} route hit`);

  // Override the params.model with the full model name
  req.params.model = modelName;
  await modelsController.getModel(req, res);
});

// Special route for when base URL includes /v1/chat/completions
app.get('/v1/chat/completions/v1/models/:model*', importedApiKeyAuth, async (req, res) => {
  // Extract the full model name from the URL
  const fullPath = req.path;
  const modelName = fullPath.replace('/v1/chat/completions/v1/models/', '');
  console.log(`[DEBUG] Special route /v1/chat/completions/v1/models/${modelName} hit`);

  // Override the params.model with the full model name
  req.params.model = modelName;
  await modelsController.getModel(req, res);
});

// Special route for when base URL includes /api/v1/chat/completions
app.get('/api/v1/chat/completions/v1/models/:model*', importedApiKeyAuth, async (req, res) => {
  // Extract the full model name from the URL
  const fullPath = req.path;
  const modelName = fullPath.replace('/api/v1/chat/completions/v1/models/', '');
  console.log(`[DEBUG] Special route /api/v1/chat/completions/v1/models/${modelName} hit`);

  // Override the params.model with the full model name
  req.params.model = modelName;
  await modelsController.getModel(req, res);
});

// Explicit route for /api/v1/models
app.get('/api/v1/models', importedApiKeyAuth, async (req, res) => {
  console.log('[DEBUG] Direct /api/v1/models route hit');
  await modelsController.getModels(req, res);
});

// Explicit route for /api/v1/models/:model
app.get('/api/v1/models/:model*', importedApiKeyAuth, async (req, res) => {
  // Extract the full model name from the URL
  const fullPath = req.path;
  const modelName = fullPath.replace('/api/v1/models/', '');
  console.log(`[DEBUG] Direct /api/v1/models/${modelName} route hit`);

  // Override the params.model with the full model name
  req.params.model = modelName;
  await modelsController.getModel(req, res);
});

// Explicit route for /models/:model
app.get('/models/:model*', importedApiKeyAuth, async (req, res) => {
  // Extract the full model name from the URL
  const fullPath = req.path;
  const modelName = fullPath.replace('/models/', '');
  console.log(`[DEBUG] Direct /models/${modelName} route hit`);

  // Override the params.model with the full model name
  req.params.model = modelName;
  await modelsController.getModel(req, res);
});

// Proxy function
async function proxyRequest(req, res) {
  try {
    // Get the next available API key
    const apiKey = getNextKey();

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
    console.log(`Full request body: ${JSON.stringify(req.body)}`);
    console.log(`Request headers: ${JSON.stringify(req.headers)}`);
    console.log(`Request query params: ${JSON.stringify(req.query)}`);

    // Make a copy of the request body to modify if needed
    const requestData = { ...req.body };

    // If a model is specified, ensure it's in the correct format
    if (requestData.model) {
      console.log(`[DEBUG] Original model requested: ${requestData.model}`);

      // Get the list of available models
      const models = await modelsController.getModelsData();
      console.log(`[DEBUG] Available models: ${models.map(m => m.id).join(', ')}`);

      // Try exact match first
      let matchedModel = models.find(m => m.id === requestData.model);
      console.log(`[DEBUG] Exact match result: ${matchedModel ? matchedModel.id : 'No match'}`);

      // If not found, try more flexible matching
      if (!matchedModel) {
        // Try finding a model where the requested model is the root
        matchedModel = models.find(m => m.root === requestData.model);
        console.log(`[DEBUG] Root match result: ${matchedModel ? matchedModel.id : 'No match'}`);

        // Try without the :free suffix
        if (!matchedModel && requestData.model.includes(':free')) {
          const baseModelId = requestData.model.split(':')[0];
          matchedModel = models.find(m => m.id.startsWith(baseModelId));
          console.log(`[DEBUG] Without :free suffix match result: ${matchedModel ? matchedModel.id : 'No match'}`);
        }
        // Try with the :free suffix
        else if (!matchedModel) {
          // First try exact match with :free suffix
          matchedModel = models.find(m => m.id === `${requestData.model}:free`);
          console.log(`[DEBUG] Exact match with :free suffix result: ${matchedModel ? matchedModel.id : 'No match'}`);

          // Then try starts with
          if (!matchedModel) {
            matchedModel = models.find(m => m.id.startsWith(`${requestData.model}:`));
            console.log(`[DEBUG] Starts with :free suffix match result: ${matchedModel ? matchedModel.id : 'No match'}`);
          }

          // Also try with just the model name (without provider)
          if (!matchedModel && !requestData.model.includes('/')) {
            // Try to match any model that ends with the requested model name
            const modelMatches = models.filter(m => {
              const parts = m.id.split('/');
              if (parts.length > 1) {
                const modelPart = parts[1].split(':')[0]; // Remove :free suffix if present
                return modelPart === requestData.model;
              }
              return false;
            });

            console.log(`[DEBUG] Model name only matches: ${modelMatches.map(m => m.id).join(', ')}`);

            if (modelMatches.length > 0) {
              // Prefer free models
              const freeModel = modelMatches.find(m => m.id.includes(':free'));
              matchedModel = freeModel || modelMatches[0];
              console.log(`[DEBUG] Selected model from name-only matches: ${matchedModel.id}`);
            }
          }
        }

        // Try case-insensitive match
        if (!matchedModel) {
          const lowerModelId = requestData.model.toLowerCase();
          matchedModel = models.find(m => m.id.toLowerCase().includes(lowerModelId));
          console.log(`[DEBUG] Case-insensitive match result: ${matchedModel ? matchedModel.id : 'No match'}`);
        }

        // Try matching just the model name without provider
        if (!matchedModel && requestData.model.includes('/')) {
          const modelName = requestData.model.split('/')[1];
          matchedModel = models.find(m => m.id.includes(modelName));
          console.log(`[DEBUG] Model name match result: ${matchedModel ? matchedModel.id : 'No match'}`);
        }

        // Special case for gemini models
        if (!matchedModel && requestData.model.toLowerCase().includes('gemini')) {
          // Find any gemini model
          matchedModel = models.find(m => m.id.toLowerCase().includes('gemini'));
          console.log(`[DEBUG] Gemini special case match result: ${matchedModel ? matchedModel.id : 'No match'}`);
        }

        // Special case for google/gemini-2.0-flash-exp:free
        if (!matchedModel &&
            (requestData.model === 'gemini-2.0-flash-exp' ||
             requestData.model === 'gemini-2.0-flash-exp:free' ||
             requestData.model === 'google/gemini-2.0-flash-exp' ||
             requestData.model === 'google/gemini-2.0-flash-exp:free')) {
          // Hardcode the model ID
          matchedModel = { id: 'google/gemini-2.0-flash-exp:free' };
          console.log(`[DEBUG] Special case for gemini-2.0-flash-exp matched to: ${matchedModel.id}`);
        }

        // Special case for n8n format (model name with provider prefix)
        if (!matchedModel && requestData.model) {
          // n8n sometimes uses format like 'openai/gpt-4' or 'anthropic/claude-3-opus'
          const modelParts = requestData.model.split('/');
          if (modelParts.length === 2) {
            const provider = modelParts[0];
            const modelName = modelParts[1];

            // Try to find a model with the same model name (ignoring provider)
            const possibleMatches = models.filter(m => {
              const mParts = m.id.split('/');
              return mParts.length === 2 && mParts[1].split(':')[0] === modelName;
            });

            if (possibleMatches.length > 0) {
              // Prefer free models
              matchedModel = possibleMatches.find(m => m.id.includes(':free')) || possibleMatches[0];
              console.log(`[DEBUG] n8n format special case matched ${requestData.model} to: ${matchedModel.id}`);
            }
          } else {
            // n8n might also use just the model name without provider (e.g., 'gpt-4' or 'claude-3-opus')
            // Try to find any model that contains this model name
            const modelName = requestData.model;
            const possibleMatches = models.filter(m => {
              const mParts = m.id.split('/');
              if (mParts.length === 2) {
                const mModelName = mParts[1].split(':')[0];
                return mModelName === modelName || mModelName.includes(modelName) || modelName.includes(mModelName);
              }
              return false;
            });

            if (possibleMatches.length > 0) {
              // Prefer free models
              matchedModel = possibleMatches.find(m => m.id.includes(':free')) || possibleMatches[0];
              console.log(`[DEBUG] n8n simple format special case matched ${requestData.model} to: ${matchedModel.id}`);
            }
          }
        }
      }

      // If we found a match, use the exact model ID
      if (matchedModel) {
        console.log(`[DEBUG] Final matched model: ${matchedModel.id}`);
        // Always use the full model ID (with provider and :free suffix)
        // This ensures that OpenRouter accepts the model ID
        if (matchedModel.root && matchedModel.root !== matchedModel.id) {
          console.log(`[DEBUG] Using root model ID: ${matchedModel.root}`);
          requestData.model = matchedModel.root;
        } else {
          requestData.model = matchedModel.id;
        }
      } else {
        console.log(`[DEBUG] No match found for model: ${requestData.model}. Using as is.`);

        // Special case for gemini-2.0-flash-exp
        if (requestData.model === 'gemini-2.0-flash-exp' ||
            requestData.model === 'gemini-2.0-flash-exp:free') {
          console.log(`[DEBUG] Special case for gemini-2.0-flash-exp, using google/gemini-2.0-flash-exp:free`);
          requestData.model = 'google/gemini-2.0-flash-exp:free';
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
      data: requestData,
      timeout: 120000 // 2 minute timeout
    });

    // Log successful response
    console.log(`Received response from OpenRouter with status: ${response.status}`);

    // Increment key usage
    incrementKeyUsage(apiKey);

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

    // Format error in OpenAI-compatible format
    let errorResponse;

    if (error.response?.data?.error) {
      // If OpenRouter already returned an error in OpenAI format, use it
      errorResponse = error.response.data;
    } else {
      // Otherwise, create an OpenAI-compatible error format
      errorResponse = {
        error: {
          message: error.message,
          type: "server_error",
          param: null,
          code: error.response?.status ? `http_${error.response.status}` : "unknown_error"
        }
      };
    }

    // Send the error response directly instead of using the error handler
    return res.status(error.response?.status || 500).json(errorResponse);
  }
}

// Proxy routes
app.post('/api/proxy/chat/completions', importedApiKeyAuth, proxyRequest);
app.post('/api/proxy/completions', importedApiKeyAuth, proxyRequest);
app.post('/api/proxy/embeddings', importedApiKeyAuth, proxyRequest);

// OpenAI SDK compatible routes with /api prefix (for n8n integration)
app.post('/api/v1/chat/completions', importedApiKeyAuth, modelValidator, (req, res) => {
  console.log('[DEBUG] n8n integration route /api/v1/chat/completions hit');
  proxyRequest(req, res);
});
app.post('/api/v1/completions', importedApiKeyAuth, proxyRequest);
app.post('/api/v1/embeddings', importedApiKeyAuth, proxyRequest);

// Special model routes with /api prefix (for n8n integration)
app.get('/api/v1/models', importedApiKeyAuth, async (req, res) => {
  console.log('[DEBUG] n8n integration route /api/v1/models hit');
  await modelsController.getModels(req, res);
});
app.get('/api/v1/models/:model', importedApiKeyAuth, async (req, res) => {
  console.log(`[DEBUG] n8n integration route /api/v1/models/${req.params.model} hit`);
  await modelsController.getModel(req, res);
});

// These routes are defined again below with more detailed logging for n8n integration
// app.post('/v1/chat/completions', importedApiKeyAuth, proxyRequest);
app.post('/v1/completions', importedApiKeyAuth, proxyRequest);
app.post('/v1/embeddings', importedApiKeyAuth, proxyRequest);

// Special routes for when base URL already includes chat completions path
app.post('/v1/chat/completions/v1/chat/completions', importedApiKeyAuth, (req, res) => {
  console.log('[DEBUG] Special route /v1/chat/completions/v1/chat/completions hit');
  // Modify the path to remove the duplicate
  req.path = '/v1/chat/completions';
  proxyRequest(req, res);
});

// Special route for n8n integration when base URL is /v1/chat/completions
app.post('/v1/chat/completions', importedApiKeyAuth, modelValidator, (req, res) => {
  console.log('[DEBUG] Direct /v1/chat/completions route hit for n8n integration');
  proxyRequest(req, res);
});

app.post('/api/v1/chat/completions/v1/chat/completions', importedApiKeyAuth, (req, res) => {
  console.log('[DEBUG] Special route /api/v1/chat/completions/v1/chat/completions hit');
  // Modify the path to remove the duplicate
  req.path = '/api/v1/chat/completions';
  proxyRequest(req, res);
});

// Additional special routes for chat completions
app.post('/chat/completions/v1/chat/completions', importedApiKeyAuth, (req, res) => {
  console.log('[DEBUG] Special route /chat/completions/v1/chat/completions hit');
  // Modify the path to remove the duplicate
  req.path = '/v1/chat/completions';
  proxyRequest(req, res);
});

app.post('/api/chat/completions/v1/chat/completions', importedApiKeyAuth, (req, res) => {
  console.log('[DEBUG] Special route /api/chat/completions/v1/chat/completions hit');
  // Modify the path to remove the duplicate
  req.path = '/api/v1/chat/completions';
  proxyRequest(req, res);
});

app.post('/completions/v1/chat/completions', importedApiKeyAuth, (req, res) => {
  console.log('[DEBUG] Special route /completions/v1/chat/completions hit');
  // Modify the path to remove the duplicate
  req.path = '/v1/chat/completions';
  proxyRequest(req, res);
});

// Special routes for when the base URL is the full path
app.post('/https://openrouter-key-aggregator.onrender.com/v1/chat/completions', importedApiKeyAuth, (req, res) => {
  console.log('[DEBUG] Special route with full URL in path hit');
  // Modify the path to the correct endpoint
  req.path = '/v1/chat/completions';
  proxyRequest(req, res);
});

// API Key management routes
app.post('/api/keys', authenticate, (req, res) => {
  const { name, rateLimit } = req.body;

  if (!name) {
    return res.status(400).json({
      error: true,
      message: 'Name is required'
    });
  }

  const parsedRateLimit = parseInt(rateLimit) || 0;
  const key = generateApiKey(name, parsedRateLimit);

  console.log(`Generated API key for ${name} with rate limit ${parsedRateLimit}`);

  res.json({
    success: true,
    message: 'API key generated successfully',
    data: {
      name,
      key,
      rateLimit: parsedRateLimit
    }
  });
});

app.get('/api/keys', authenticate, (req, res) => {
  const keys = getApiKeys();
  res.json({
    success: true,
    data: keys
  });
});

app.delete('/api/keys/:key', authenticate, (req, res) => {
  const key = req.params.key;
  const success = revokeApiKey(key);
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

app.get('/api/keys/export', authenticate, (req, res) => {
  const exportData = exportApiKeys();
  res.json({
    success: true,
    data: {
      environmentVariable: 'CLIENT_API_KEYS',
      value: exportData
    }
  });
});

// Status route
app.get('/api/status', authenticate, (req, res) => {
  const keys = getKeyStatus();
  const totalRequests = keys.reduce((sum, key) => sum + key.dailyCount, 0);
  const totalRemaining = keys.reduce((sum, key) => sum + key.dailyRemaining, 0);

  res.json({
    keys,
    summary: {
      totalKeys: keys.length,
      activeKeys: keys.filter(k => !k.disabled).length,
      totalRequests,
      totalRemaining
    }
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
      apiKeys: '/api/keys',
      health: '/health'
    }
  });
});

// Health check endpoint for load balancers
app.get('/health', (req, res) => {
  try {
    // Get key stats
    const keys = getKeyStatus();

    // Check if we have any keys with remaining capacity
    const availableKeys = keys.filter(k => !k.disabled && k.dailyRemaining > 5);
    const healthy = availableKeys.length > 0;

    // Return appropriate status code
    res.status(healthy ? 200 : 503).json({
      healthy,
      availableKeys: availableKeys.length,
      totalKeys: keys.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ healthy: false, error: error.message });
  }
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

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
