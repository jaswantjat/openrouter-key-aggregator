/**
 * Enhanced CORS Middleware for OpenRouter Key Aggregator
 * 
 * This middleware ensures proper CORS headers are set to allow
 * requests from n8n Cloud and other clients.
 */

/**
 * CORS middleware that sets appropriate headers
 */
const corsMiddleware = (req, res, next) => {
  // Allow requests from any origin
  res.header('Access-Control-Allow-Origin', '*');
  
  // Allow specific headers
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key, x-api-key, X-Api-Key, openai-api-key, OpenAI-API-Key'
  );
  
  // Allow specific methods
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    console.log(`[CORS] Handling preflight request from ${req.headers.origin || 'unknown origin'}`);
    return res.status(200).end();
  }
  
  // Continue to next middleware
  next();
};

module.exports = corsMiddleware;
