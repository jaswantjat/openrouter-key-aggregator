/**
 * Basic authentication middleware
 */
const authenticate = (req, res, next) => {
  // Skip authentication if disabled
  if (process.env.AUTH_ENABLED !== 'true') {
    return next();
  }

  // Get authorization header
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return res.status(401).json({
      error: true,
      message: 'Authentication required'
    });
  }
  
  // Decode base64 credentials
  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('utf8');
  const [username, password] = credentials.split(':');
  
  // Validate credentials
  if (
    username === process.env.AUTH_USERNAME &&
    password === process.env.AUTH_PASSWORD
  ) {
    return next();
  }
  
  return res.status(401).json({
    error: true,
    message: 'Invalid credentials'
  });
};

module.exports = { authenticate };
