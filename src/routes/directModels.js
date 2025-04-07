const express = require('express');
const router = express.Router();
const { getModels, getModel } = require('../controllers/modelsController');
const { authenticate } = require('../middleware/auth');
const { apiKeyAuth } = require('../middleware/apiKeyAuth');

// Determine which auth middleware to use based on environment variables
const getAuthMiddleware = () => {
  if (process.env.API_KEY_AUTH_ENABLED === 'true') {
    return apiKeyAuth;
  }
  if (process.env.AUTH_ENABLED === 'true') {
    return authenticate;
  }
  return (req, res, next) => next(); // No auth if both are disabled
};

// Direct models routes (OpenAI API compatible) without any prefix
router.get('/models', getAuthMiddleware(), getModels);
router.get('/models/:model', getAuthMiddleware(), getModel);

module.exports = router;
