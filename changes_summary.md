# OpenAI API Compatibility Changes for n8n Integration

This document summarizes the changes made to fix the "No auth credentials found" error when using n8n with the OpenRouter Key Aggregator.

## Root Cause Analysis

The authentication issue with n8n's OpenAI node was caused by several factors:

1. **Case-Sensitive Header Checking**: The original code was checking for headers with exact case matching, but n8n may send headers with different casing.

2. **Authentication Method Handling**: n8n's OpenAI node can use different authentication methods depending on configuration, and not all were properly supported.

3. **Path Handling**: The base URL configuration in n8n can include or exclude the `/v1` suffix, which needed special handling.

4. **Error Response Format**: Error responses needed to match OpenAI's format exactly for proper error handling in n8n.

## Changes Made

### 1. Enhanced Authentication Middleware

Updated the authentication middleware to handle headers in a case-insensitive manner:

```javascript
// Before
if (req.headers['authorization'] && req.headers['authorization'].startsWith('Bearer ')) {
  apiKey = req.headers['authorization'].substring(7);
}

// After
const headerKeys = Object.keys(req.headers);
const authHeader = headerKeys.find(key => key.toLowerCase() === 'authorization');
if (authHeader && req.headers[authHeader].startsWith('Bearer ')) {
  apiKey = req.headers[authHeader].substring(7);
}
```

This change ensures that authentication headers are recognized regardless of case, addressing a common issue with n8n's OpenAI node.

### 2. Improved Path Handling

Enhanced the path middleware to better handle different base URL configurations:

```javascript
// Special handling for n8n when base URL includes /v1
// This handles the case where n8n sets the base URL to https://example.com/api/v1
// In this case, the actual path will be /chat/completions instead of /v1/chat/completions
```

### 3. Comprehensive Documentation

Created a detailed guide for n8n integration that includes:
- Step-by-step configuration instructions
- Troubleshooting steps for common issues
- Example workflow configuration
- Technical details about the authentication mechanisms

### 4. Fixed Request Data Handling

Updated the axios call to use the modified request data:

```javascript
// Forward the request to OpenRouter with the modified request body
const response = await axios({
  method: req.method,
  url: `${process.env.OPENROUTER_API_URL}${endpoint}`,
  headers: headers,
  data: requestData, // Use the modified request data instead of req.body
  timeout: 120000 // 2 minute timeout
});
```

## Testing

The changes have been tested with:
- n8n Cloud instance
- Self-hosted n8n instance
- Different base URL configurations
- Various authentication methods

## Next Steps

1. Deploy these changes to the production OpenRouter Key Aggregator
2. Monitor for any additional authentication issues
3. Consider adding more detailed logging for troubleshooting
4. Update the documentation as needed based on user feedback
