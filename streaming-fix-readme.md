# Streaming Support for OpenRouter Key Aggregator

This update adds proper streaming support to the OpenRouter Key Aggregator, fixing the "Cannot read properties of undefined (reading 'content')" error when using n8n with streaming enabled.

## Problem

When n8n's OpenAI node sends a request with `stream: true`, the OpenRouter Key Aggregator was not properly handling the streaming response from OpenRouter. Instead of piping the streaming response directly to the client, it was trying to process it as a regular JSON response, which caused the error.

## Solution

The solution implements proper streaming support by:

1. Detecting when a request includes `stream: true`
2. Using Axios with `responseType: 'stream'` to get a streaming response from OpenRouter
3. Setting the appropriate headers for a streaming response
4. Piping the streaming response directly to the client without trying to parse it as JSON

## Implementation Details

### New Files

- `streaming-proxy-controller.js`: Enhanced proxy controller with streaming support
- `streaming-integration.js`: Integration file to update the app with streaming support
- `streaming-fix-readme.md`: Documentation of the streaming fix

### Key Code Changes

The main change is in the `proxyRequest` function, which now includes special handling for streaming requests:

```javascript
// Check if streaming is requested
const isStreamingRequest = openRouterRequestData.stream === true;

if (isStreamingRequest) {
  console.log(`[DEBUG] Streaming request detected, using direct pipe`);
  
  // For streaming requests, we need to pipe the response directly
  const openRouterUrl = `${process.env.OPENROUTER_API_URL}${endpoint}`;
  
  // Set headers for streaming response
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-OpenRouter-Key-Aggregator-Model', requestData.model || 'unknown');
  res.setHeader('X-OpenRouter-Key-Aggregator-Key', apiKey.substring(0, 4) + '...');
  
  // Create Axios request with responseType: 'stream'
  const axiosResponse = await axios({
    method: req.method,
    url: openRouterUrl,
    headers: headers,
    data: openRouterRequestData,
    responseType: 'stream',
    timeout: 120000 // 2 minute timeout
  });
  
  // Increment key usage
  keyManager.incrementKeyUsage(apiKey, requestData.model);
  
  // Pipe the stream directly to the response
  axiosResponse.data.pipe(res);
  
  // Handle errors in the stream
  axiosResponse.data.on('error', (error) => {
    console.error(`[ERROR] Stream error: ${error.message}`);
    // We can't send headers at this point, as some data might have been sent already
  });
  
  return; // Return early, as we're handling the response via pipe
}
```

## How to Use

To integrate this streaming support into the OpenRouter Key Aggregator:

1. Add the new files to your project
2. Update your main application file to use the streaming integration:

```javascript
const updateAppWithStreamingSupport = require('./streaming-integration');

// After setting up your Express app
const app = express();

// Add streaming support
updateAppWithStreamingSupport(app);
```

## Testing

To test the streaming support:

1. Configure n8n's OpenAI node with the OpenRouter Key Aggregator
2. Enable streaming in the node configuration
3. Run the workflow and check if the response is properly streamed

## Troubleshooting

If you encounter issues with streaming:

1. Check the logs for any errors related to streaming
2. Verify that the OpenRouter API key is valid
3. Ensure that the model supports streaming
4. Check if the OpenRouter API URL is correctly configured
