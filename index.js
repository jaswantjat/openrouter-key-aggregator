console.log('>>>> INDEX.JS LOADED - COMMIT 051800b (Canary Check) <<<<');
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
// Import the correct proxyRequest function
const { proxyRequest } = require('./src/controllers/proxyController'); 
// Import necessary key management functions directly if needed elsewhere
// const keyManager = require('./src/utils/keyManager'); // Assuming proxyController uses this internally now
// --- END CORRECTED IMPORTS ---

const app = express();
const PORT = process.env.PORT || 3000;

// --- REMOVED In-memory key management logic (should be handled by keyManager util) --- 
// --- REMOVED initializeOpenRouterKeys, resetDailyCounters --- 
// --- REMOVED getNextKey, incrementKeyUsage --- 
// --- REMOVED initializeClientApiKeys, generateApiKey, updateClientApiKeysEnv --- 
// --- REMOVED revokeApiKey, getApiKeys, exportApiKeys, verifyApiKey --- 
// --- REMOVED getKeyStatus --- 
// Key initialization might need adjustment if keyManager doesn't auto-init
// For simplicity, assume keyManager handles initialization based on env vars
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

// --- REMOVED local authenticate and apiKeyAuth middleware (using imported versions) ---

// --- Model Routes (Ensure they use importedApiKeyAuth) ---
// Explicit route for /models (n8n compatibility)
app.get('/models', importedApiKeyAuth, async (req, res) => {
  console.log('[DEBUG] Direct /models route hit');
  await modelsController.getModels(req, res);
});
app.get('/v1/models', importedApiKeyAuth, async (req, res) => {
  console.log('[DEBUG] Direct /v1/models route hit');
  await modelsController.getModels(req, res);
});
app.get('/api/v1/models', importedApiKeyAuth, async (req, res) => {
  console.log('[DEBUG] Direct /api/v1/models route hit');
  await modelsController.getModels(req, res);
});
// ... other specific model routes ...

// --- REMOVED local proxyRequest function definition --- 

// --- Proxy Routes (Ensure they use the IMPORTED proxyRequest) ---

// OpenAI SDK compatible routes with /api prefix (for n8n integration)
app.post('/api/v1/chat/completions', importedApiKeyAuth, modelValidator, (req, res, next) => {
  console.log('[DEBUG] n8n integration route /api/v1/chat/completions hit');
  if (req.body && req.body.chatInput !== undefined) {
    console.log('[DEBUG] Detected chatInput format in /api/v1/chat/completions, redirecting to chatInput handler');
    return handleChatInput(req, res);
  }
  proxyRequest(req, res, next); // Call IMPORTED proxyRequest
});
app.post('/api/v1/completions', importedApiKeyAuth, proxyRequest);
app.post('/api/v1/embeddings', importedApiKeyAuth, proxyRequest);

// Additional routes without v1 prefix (for n8n with base URL /api)
app.post('/api/chat/completions', importedApiKeyAuth, modelValidator, (req, res, next) => {
  console.log('[DEBUG] n8n integration route /api/chat/completions hit');
  if (req.body && req.body.chatInput !== undefined) {
    console.log('[DEBUG] Detected chatInput format in /api/chat/completions, redirecting to chatInput handler');
    return handleChatInput(req, res);
  }
  proxyRequest(req, res, next); // Call IMPORTED proxyRequest
});
app.post('/api/completions', importedApiKeyAuth, proxyRequest);
app.post('/api/embeddings', importedApiKeyAuth, proxyRequest);

// Standard OpenAI path
app.post('/v1/chat/completions', importedApiKeyAuth, modelValidator, (req, res, next) => {
  console.log('[DEBUG] Direct /v1/chat/completions route hit for n8n integration');
  if (req.body && req.body.chatInput !== undefined) {
    console.log('[DEBUG] Detected chatInput format, redirecting to chatInput handler');
    return handleChatInput(req, res);
  }
  proxyRequest(req, res, next); // Call IMPORTED proxyRequest
});
app.post('/v1/completions', importedApiKeyAuth, proxyRequest);
app.post('/v1/embeddings', importedApiKeyAuth, proxyRequest);

// --- Other Routes (Ensure correct middleware/handlers) ---

// Dedicated route for chatInput format (for n8n integration)
app.post('/api/chatinput', importedApiKeyAuth, handleChatInput);

// ... keep other routes like /api/status, /api/keys, /health, etc. ...
// Assuming these are defined elsewhere or need to be added back if they were in the local removed code

// Home route - Redirect to admin dashboard
app.get('/', (req, res) => {
  // Check if admin.html exists before redirecting
  const adminPath = path.join(__dirname, 'public', 'admin.html');
  if (fs.existsSync(adminPath)) {
     res.redirect('/admin.html');
  } else {
     res.json({ message: 'Aggregator running. No admin page found.'});
  }
});

// Catch-all route for debugging
app.all('*', (req, res) => {
  console.log(`[DEBUG] Unhandled request: ${req.method} ${req.url}`);
  // Check if it looks like a request for models that missed specific routes
  if (req.url.includes('/models')) {
     console.log('[WARN] Unhandled request for models, returning empty list.');
     return res.json({ object: "list", data: [] });
  }
  res.status(404).json({
    error: { message: `Route not found: ${req.method} ${req.url}` }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
