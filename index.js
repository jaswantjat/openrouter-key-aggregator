require('dotenv').config();
const express = require('express');
const cors = require('cors');
const proxyRoutes = require('./src/routes/proxy');
const statusRoutes = require('./src/routes/status');
const apiKeyRoutes = require('./src/routes/apiKeys');
const modelsRoutes = require('./src/routes/models');
const { errorHandler } = require('./src/middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

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

// Error handling middleware
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
