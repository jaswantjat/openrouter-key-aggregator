require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

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
