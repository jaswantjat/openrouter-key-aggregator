/**
 * Model validation middleware
 * Validates that the model name in the request body is properly formatted
 */

const modelValidator = (req, res, next) => {
  // Skip validation for non-POST requests or requests without a body
  if (req.method !== 'POST' || !req.body) {
    return next();
  }

  // Log the request for debugging
  console.log(`[DEBUG] Model validation for request body: ${JSON.stringify(req.body)}`);

  // Check if model is specified
  if (!req.body.model) {
    console.log('[DEBUG] No model specified in request');
    // Allow the request to continue - the proxy controller will set a default model
    return next();
  }

  // Validate model format
  // Valid formats:
  // - provider/model-name:variant (e.g., meta-llama/llama-4-scout:free)
  // - provider/model-name (e.g., meta-llama/llama-4-scout)
  // - model-name (e.g., llama-4-scout)
  // - simplified name (e.g., scout)
  const validModelFormat = /^([a-z0-9-]+\/)?[a-z0-9-]+(:[a-z0-9-]+)?$/i;
  
  if (!validModelFormat.test(req.body.model)) {
    console.log(`[DEBUG] Invalid model format: ${req.body.model}`);
    return res.status(404).json({
      error: {
        message: `The model '${req.body.model}' does not exist or you don't have access to it`,
        type: "invalid_request_error",
        param: "model",
        code: "model_not_found"
      },
      object: "error",
      status: 404,
      lc_error_code: "MODEL_NOT_FOUND"
    });
  }

  // Model format is valid, proceed
  console.log(`[DEBUG] Valid model format: ${req.body.model}`);
  next();
};

module.exports = { modelValidator };
