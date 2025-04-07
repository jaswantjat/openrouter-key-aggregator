/**
 * Global error handling middleware
 */
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err.message);
  
  // Check if the error is from OpenRouter API
  if (err.response && err.response.data) {
    return res.status(err.response.status || 500).json({
      error: true,
      message: err.response.data.error || err.message,
      details: err.response.data
    });
  }
  
  // Default error response
  res.status(err.status || 500).json({
    error: true,
    message: err.message || 'Internal Server Error'
  });
};

module.exports = { errorHandler };
