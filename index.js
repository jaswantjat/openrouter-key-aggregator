require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { proxyRequest } = require('./src/controllers/proxyController');
const { authenticate } = require('./src/middleware/auth');
const { apiKeyAuth } = require('./src/middleware/apiKeyAuth');
const { errorHandler } = require('./src/middleware/errorHandler');
const statusRoutes = require('./src/routes/status');
const apiKeyRoutes = require('./src/routes/apiKeys');

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

// Auth middleware
const getAuthMiddleware = () => {
  if (process.env.API_KEY_AUTH_ENABLED === 'true') {
    return apiKeyAuth;
  }
  if (process.env.AUTH_ENABLED === 'true') {
    return authenticate;
  }
  return (req, res, next) => next(); // No auth if both are disabled
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

// API routes
app.use('/api', statusRoutes);
app.use('/api', apiKeyRoutes);

// Proxy routes
app.post('/api/proxy/chat/completions', getAuthMiddleware(), proxyRequest);
app.post('/api/proxy/completions', getAuthMiddleware(), proxyRequest);
app.post('/api/proxy/embeddings', getAuthMiddleware(), proxyRequest);

// OpenAI SDK compatible routes
app.post('/api/v1/chat/completions', getAuthMiddleware(), proxyRequest);
app.post('/api/v1/completions', getAuthMiddleware(), proxyRequest);
app.post('/api/v1/embeddings', getAuthMiddleware(), proxyRequest);

app.post('/v1/chat/completions', getAuthMiddleware(), proxyRequest);
app.post('/v1/completions', getAuthMiddleware(), proxyRequest);
app.post('/v1/embeddings', getAuthMiddleware(), proxyRequest);

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
