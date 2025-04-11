/**
 * OpenAI-Compatible Path Middleware for OpenRouter Key Aggregator
 * 
 * This middleware ensures compatibility with the OpenAI API path structure
 * and routes requests to the appropriate handlers.
 */

/**
 * Path middleware that handles OpenAI API paths
 */
const openAIPathMiddleware = (req, res, next) => {
  console.log(`[PATH] Processing path: ${req.path}`);
  
  // Map OpenAI API paths to our internal paths
  
  // Handle v1 paths (OpenAI's standard API version)
  if (req.path.startsWith('/v1/')) {
    // Remove /v1 prefix for internal routing
    req.originalPath = req.path;
    req.path = req.path.substring(3);
    console.log(`[PATH] Mapped v1 path ${req.originalPath} to ${req.path}`);
  }
  
  // Handle chat completions endpoint
  if (req.path === '/chat/completions') {
    console.log(`[PATH] Detected chat completions endpoint`);
    // No need to modify, our internal path is the same
  }
  
  // Handle completions endpoint
  else if (req.path === '/completions') {
    console.log(`[PATH] Detected completions endpoint`);
    // No need to modify, our internal path is the same
  }
  
  // Handle embeddings endpoint
  else if (req.path === '/embeddings') {
    console.log(`[PATH] Detected embeddings endpoint`);
    // No need to modify, our internal path is the same
  }
  
  // Handle models endpoint
  else if (req.path === '/models') {
    console.log(`[PATH] Detected models endpoint`);
    // No need to modify, our internal path is the same
  }
  
  // Continue to next middleware
  next();
};

module.exports = openAIPathMiddleware;
