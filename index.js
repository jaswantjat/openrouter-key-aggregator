require('dotenv').config();
const express = require('express');
const cors = require('cors');
const proxyRoutes = require('./src/routes/proxy');
const statusRoutes = require('./src/routes/status');
const apiKeyRoutes = require('./src/routes/apiKeys');
const { errorHandler } = require('./src/middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', proxyRoutes);
app.use('/api', statusRoutes);
app.use('/api', apiKeyRoutes);

// Home route
app.get('/', (req, res) => {
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

// Error handling middleware
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
