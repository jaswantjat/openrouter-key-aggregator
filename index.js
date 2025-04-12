console.log('>>>> INDEX.JS LOADED - COMMIT bed6a4c (Add /chat/completions Route) <<<<');
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// --- CORRECTED IMPORTS ---
const modelsController = require('./src/controllers/modelsController');
const { apiKeyAuth: importedApiKeyAuth } = require('./src/middleware/apiKeyAuth');
const { modelValidator } = require('./src/middleware/modelValidator');
const { handleChatInput } = require('./src/controllers/chatInputController');
const { proxyRequest } = require('./src/controllers/proxyController'); 

const app = express();
const PORT = process.env.PORT || 3000;

console.log("Key management logic assumed to be handled by ./src/utils/keyManager");

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

// --- Model Routes ---
app.get('/models', importedApiKeyAuth, modelsController.getModels);
app.get('/v1/models', importedApiKeyAuth, modelsController.getModels);
app.get('/api/v1/models', importedApiKeyAuth, modelsController.getModels);
// ... other specific model routes ...

// --- Proxy Routes ---

// ADDED: Handle POST /chat/completions directly
app.post('/chat/completions', importedApiKeyAuth, modelValidator, (req, res, next) => {
  console.log('[DEBUG] Direct /chat/completions route hit');
  if (req.body && req.body.chatInput !== undefined) {
    console.log('[DEBUG] Detected chatInput format in /chat/completions, redirecting');
    return handleChatInput(req, res);
  }
  proxyRequest(req, res, next); // Call IMPORTED proxyRequest
});

// Handle /v1 routes
app.post('/v1/chat/completions', importedApiKeyAuth, modelValidator, (req, res, next) => {
  console.log('[DEBUG] /v1/chat/completions route hit');
  if (req.body && req.body.chatInput !== undefined) {
    console.log('[DEBUG] Detected chatInput format in /v1/chat/completions, redirecting');
    return handleChatInput(req, res);
  }
  proxyRequest(req, res, next); // Call IMPORTED proxyRequest
});
app.post('/v1/completions', importedApiKeyAuth, proxyRequest);
app.post('/v1/embeddings', importedApiKeyAuth, proxyRequest);

// Handle /api/v1 routes
app.post('/api/v1/chat/completions', importedApiKeyAuth, modelValidator, (req, res, next) => {
  console.log('[DEBUG] /api/v1/chat/completions route hit');
  if (req.body && req.body.chatInput !== undefined) {
    console.log('[DEBUG] Detected chatInput format in /api/v1/chat/completions, redirecting');
    return handleChatInput(req, res);
  }
  proxyRequest(req, res, next); // Call IMPORTED proxyRequest
});
app.post('/api/v1/completions', importedApiKeyAuth, proxyRequest);
app.post('/api/v1/embeddings', importedApiKeyAuth, proxyRequest);

// Handle /api routes (without /v1)
app.post('/api/chat/completions', importedApiKeyAuth, modelValidator, (req, res, next) => {
  console.log('[DEBUG] /api/chat/completions route hit');
  if (req.body && req.body.chatInput !== undefined) {
    console.log('[DEBUG] Detected chatInput format in /api/chat/completions, redirecting');
    return handleChatInput(req, res);
  }
  proxyRequest(req, res, next); // Call IMPORTED proxyRequest
});
app.post('/api/completions', importedApiKeyAuth, proxyRequest);
app.post('/api/embeddings', importedApiKeyAuth, proxyRequest);

// Dedicated chatInput route
app.post('/api/chatinput', importedApiKeyAuth, handleChatInput);

// --- Other Routes ---
// ... keep other routes like /api/status, /api/keys, /health, etc. ...

// Home route 
app.get('/', (req, res) => { /* ... */ });

// Catch-all route
app.all('*', (req, res) => { /* ... */ });

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
