/**
 * OpenAI-Compatible Application Update for OpenRouter Key Aggregator
 * 
 * This file contains the code to update the main application
 * to be fully compatible with the OpenAI API specification.
 */

// Import the OpenAI-compatible middleware
const authenticateOpenAI = require('./openai-compatible-middleware');
const openAIPathMiddleware = require('./openai-path-middleware');
const corsMiddleware = require('./enhanced-corsMiddleware');
const { handleDiagnostic, handleAuthTest } = require('./diagnosticController');

/**
 * Update the main application for OpenAI compatibility
 * @param {Express} app - The Express application
 */
function updateAppForOpenAICompatibility(app) {
  console.log('Updating application for OpenAI API compatibility...');
  
  // Add CORS middleware
  app.use(corsMiddleware);
  
  // Add diagnostic endpoints
  app.get('/api/diagnostic', handleDiagnostic);
  app.post('/api/auth-test', authenticateOpenAI, handleAuthTest);
  
  // Add OpenAI-compatible path handling
  app.use('/api', openAIPathMiddleware);
  
  // Add OpenAI-compatible authentication
  app.use('/api', authenticateOpenAI);
  
  // Add specific OpenAI API endpoints
  
  // Models endpoint
  app.get('/api/models', (req, res) => {
    // Return a list of available models
    res.json({
      object: 'list',
      data: [
        {
          id: 'deepseek/deepseek-chat-v3-0324:free',
          object: 'model',
          created: 1677610602,
          owned_by: 'openrouter'
        },
        {
          id: 'meta-llama/llama-4-maverick:free',
          object: 'model',
          created: 1677610602,
          owned_by: 'openrouter'
        },
        {
          id: 'meta-llama/llama-4-scout:free',
          object: 'model',
          created: 1677610602,
          owned_by: 'openrouter'
        },
        {
          id: 'deepseek',
          object: 'model',
          created: 1677610602,
          owned_by: 'openrouter'
        },
        {
          id: 'llama-4-maverick',
          object: 'model',
          created: 1677610602,
          owned_by: 'openrouter'
        },
        {
          id: 'llama-4-scout',
          object: 'model',
          created: 1677610602,
          owned_by: 'openrouter'
        }
      ]
    });
  });
  
  console.log('Application updated for OpenAI API compatibility');
}

module.exports = updateAppForOpenAICompatibility;
