const express = require('express');
const router = express.Router();
const { getStatus } = require('../controllers/statusController');
const { authenticate } = require('../middleware/auth');

// Get API key status
router.get('/status', authenticate, getStatus);

module.exports = router;
