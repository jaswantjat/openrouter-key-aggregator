# n8n Integration Guide for OpenRouter Key Aggregator

This guide provides detailed instructions for integrating the OpenRouter Key Aggregator with n8n, addressing common authentication issues and providing best practices.

## Authentication Configuration

### Method 1: OpenAI Node with Custom Headers (Recommended)

1. **Create a new OpenAI API credential in n8n**:
   - **Name**: OpenRouter Key Aggregator
   - **Base URL**: `https://openrouter-key-aggregator.onrender.com/api`
   - **API Key**: `51fa83450b6f92dd3606cad17d261d3d`

2. **In the OpenAI node settings**:
   - Under "Additional Fields" or "Options", add a custom header:
   - Name: `x-api-key` (lowercase is important)
   - Value: `51fa83450b6f92dd3606cad17d261d3d`

### Method 2: HTTP Request Node

If the OpenAI node doesn't work, use an HTTP Request node:

1. **Add an HTTP Request node**:
   - Method: POST
   - URL: `https://openrouter-key-aggregator.onrender.com/api/v1/chat/completions`
   - Headers:
     ```
     Content-Type: application/json
     x-api-key: 51fa83450b6f92dd3606cad17d261d3d
     ```
   - Body (JSON):
     ```json
     {
       "model": "deepseek/deepseek-chat-v3-0324:free",
       "messages": [
         {
           "role": "user",
           "content": "{{$json.input}}"
         }
       ]
     }
     ```

## Troubleshooting Authentication Issues

If you encounter authentication errors, try these solutions:

### 1. Check Header Case Sensitivity

The OpenRouter Key Aggregator accepts multiple header formats, but some may work better than others:

- `x-api-key: 51fa83450b6f92dd3606cad17d261d3d` (lowercase, recommended)
- `X-API-Key: 51fa83450b6f92dd3606cad17d261d3d` (mixed case)
- `Authorization: Bearer 51fa83450b6f92dd3606cad17d261d3d` (Bearer token)

### 2. Use the Diagnostic Endpoint

Test your authentication with the diagnostic endpoint:

```bash
curl -X GET https://openrouter-key-aggregator.onrender.com/api/diagnostic
```

This will return information about the server without requiring authentication.

### 3. Test Authentication Directly

Test your authentication directly:

```bash
curl -X POST https://openrouter-key-aggregator.onrender.com/api/auth-test \
  -H "x-api-key: 51fa83450b6f92dd3606cad17d261d3d"
```

If this succeeds but n8n still fails, the issue is likely with how n8n is sending the authentication.

### 4. Check for CORS Issues

If you're using n8n Cloud, you might encounter CORS issues. Try using a self-hosted n8n instance if possible.

### 5. Implement a Function Node for Error Handling

Add a Function node after your HTTP Request or OpenAI node to handle errors:

```javascript
// Input from previous node
const input = items[0].json;

// Check if we got an authentication error
if (input.error && input.error.code === 401) {
  // Log the error for debugging
  console.log('Authentication error:', input.error.message);
  
  // Return a formatted error message
  return [{
    json: {
      error: true,
      message: 'Authentication failed. Please check API key format and headers.',
      details: input.error
    }
  }];
}

// If no error, pass through the response
return items;
```

## Using the chatInput Format

If you need to use the chatInput format:

1. **Add an HTTP Request node**:
   - Method: POST
   - URL: `https://openrouter-key-aggregator.onrender.com/api/chatInput`
   - Headers:
     ```
     Content-Type: application/json
     x-api-key: 51fa83450b6f92dd3606cad17d261d3d
     ```
   - Body (JSON):
     ```json
     [
       {
         "sessionId": "{{$json.sessionId || 'session-' + $now}}",
         "action": "sendMessage",
         "chatInput": "{{$json.input}}"
       }
     ]
     ```

## Best Practices for n8n Integration

1. **Use Consistent Authentication**: Always use the same authentication method across your workflow.

2. **Handle Errors Gracefully**: Add Function nodes to handle errors and provide meaningful feedback.

3. **Monitor API Usage**: Keep track of your API usage to avoid hitting rate limits.

4. **Cache Responses**: For frequently used queries, consider caching responses to reduce API calls.

5. **Use Webhook Nodes for Long-Running Operations**: For operations that might take a long time, use Webhook nodes to avoid timeouts.

## Example Workflow

Here's an example workflow for using the OpenRouter Key Aggregator with n8n:

1. **Manual Trigger Node**: Starts the workflow.

2. **Set Node**: Prepares the input data.
   ```json
   {
     "input": "Hello, how are you?"
   }
   ```

3. **HTTP Request Node**: Calls the OpenRouter Key Aggregator.
   - Method: POST
   - URL: `https://openrouter-key-aggregator.onrender.com/api/v1/chat/completions`
   - Headers:
     ```
     Content-Type: application/json
     x-api-key: 51fa83450b6f92dd3606cad17d261d3d
     ```
   - Body (JSON):
     ```json
     {
       "model": "deepseek/deepseek-chat-v3-0324:free",
       "messages": [
         {
           "role": "user",
           "content": "{{$json.input}}"
         }
       ]
     }
     ```

4. **Function Node**: Extracts the response content.
   ```javascript
   // Input from HTTP Request node
   const input = items[0].json;
   
   // Extract the content from the response
   const content = input.choices?.[0]?.message?.content || 'No response';
   
   // Return the content
   return [{
     json: {
       content: content
     }
   }];
   ```

5. **Set Node**: Formats the final output.
   ```json
   {
     "response": "{{$json.content}}"
   }
   ```

This workflow can be used as a starting point for your own integration.
