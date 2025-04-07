require('dotenv').config();
const express = require('express');
const cors = require('cors');
const proxyRoutes = require('./src/routes/proxy');
const statusRoutes = require('./src/routes/status');
const apiKeyRoutes = require('./src/routes/apiKeys');
const modelsRoutes = require('./src/routes/models');
const directModelsRoutes = require('./src/routes/directModels');
const { errorHandler } = require('./src/middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// Debug middleware to log all requests
app.use((req, res, next) => {
  console.log(`[DEBUG] ${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log(`[DEBUG] Headers: ${JSON.stringify(req.headers)}`);

  // Store the original end method
  const originalEnd = res.end;

  // Override the end method
  res.end = function(chunk, encoding) {
    // Call the original end method
    originalEnd.call(this, chunk, encoding);

    // Log the response status
    console.log(`[DEBUG] Response Status: ${res.statusCode}`);
  };

  next();
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Routes
app.use('/api', proxyRoutes);
app.use('/api', statusRoutes);
app.use('/api', apiKeyRoutes);
app.use('/api', modelsRoutes);

// Direct v1 routes for OpenAI SDK compatibility
app.use('/api/v1', proxyRoutes);
app.use('/api/v1', modelsRoutes);

// Root-level v1 routes for n8n compatibility
app.use('/v1', proxyRoutes);
app.use('/v1', modelsRoutes);

// Direct root-level routes for n8n compatibility
app.use('/', directModelsRoutes);

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
  console.log(`[DEBUG] Query params: ${JSON.stringify(req.query)}`);
  console.log(`[DEBUG] Body: ${JSON.stringify(req.body)}`);

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
