/**
 * Model validation middleware
 * Validates that the model name in the request body is properly formatted
 */

const modelValidator = (req, res, next) => {
  if (req.method !== 'POST' || !req.body) {
    return next();
  }

  console.log(`[DEBUG] Model validation for request body: ${JSON.stringify(req.body)}`);

  if (!req.body.model) {
    console.log('[DEBUG] No model specified in request, using default');
    return next();
  }

  // --- CORRECTED REGEX TO ALLOW DOTS --- 
  // Valid formats allow dots in the model name part
  const validModelFormat = /^([a-z0-9-]+\/)?[a-z0-9.-]+(:[a-z0-9-]+)?$/i;
  // --- END CORRECTION ---
  
  if (!validModelFormat.test(req.body.model)) {
    console.log(`[DEBUG] Invalid model format detected by regex: ${req.body.model}`);
    // Return 404 for consistency with OpenAI behavior for non-existent models
    return res.status(404).json({
      error: {
        message: `The model '${req.body.model}' does not exist or you don't have access to it.`,
        type: "invalid_request_error",
        param: "model",
        code: "model_not_found"
      },
      object: "error",
      status: 404,
      lc_error_code: "MODEL_NOT_FOUND"
    });
  }

  console.log(`[DEBUG] Valid model format passed regex check: ${req.body.model}`);
  next(); // Proceed to the next middleware or route handler
};

module.exports = { modelValidator };
