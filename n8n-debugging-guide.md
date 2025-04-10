# Debugging Guide for n8n "Cannot read properties of undefined (reading 'content')" Error

This guide provides advanced debugging techniques to help you diagnose and fix the "Cannot read properties of undefined (reading 'content')" error when using the OpenRouter Key Aggregator with n8n's AI Agent node.

## Understanding the Error Stack Trace

The error occurs in the `ToolCallingAgentOutputParser._baseMessageToString` method in the LangChain Core library. This method attempts to access the `content` property of a message object that is undefined.

## Debugging Steps

### Step 1: Add Debug Logging to Your Function Nodes

Add console.log statements to your Function nodes to see the exact structure of the data:

```javascript
// In your Format Input Function node
const userInput = items[0].json.userInput || "Hello";
console.log("User input:", userInput);

// In your Format Response Function node
const input = items[0].json;
console.log("Response from OpenRouter:", JSON.stringify(input));
```

### Step 2: Inspect the Network Requests

1. Open your browser's Developer Tools (F12)
2. Go to the Network tab
3. Filter for requests to your OpenRouter Key Aggregator
4. Look at the request and response bodies to see what's being sent and received

### Step 3: Check the OpenRouter Key Aggregator Logs

If you have access to the OpenRouter Key Aggregator logs, check them for any errors or warnings related to your requests.

### Step 4: Test with a Simplified Workflow

Create a simplified workflow with just:
1. Manual Input
2. Format Input Function
3. OpenAI Chat Model

This will help you determine if the issue is with the AI Agent node or with the response from the OpenRouter Key Aggregator.

### Step 5: Try Different Models

Test with different models to see if the issue is specific to one model:
- `meta-llama/llama-4-maverick:free`
- `meta-llama/llama-4-scout:free`
- `deepseek/deepseek-chat-v3-0324:free`

### Step 6: Verify the Response Structure

The AI Agent node expects a response with this structure:

```json
{
  "id": "chatcmpl-123",
  "object": "chat.completion",
  "created": 1677858242,
  "model": "deepseek/deepseek-chat-v3-0324:free",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "This is the response content"
      },
      "finish_reason": "stop"
    }
  ]
}
```

Make sure your response matches this structure exactly.

### Step 7: Check for Nested Properties

Sometimes the error occurs because the response has a different nesting structure than expected. For example, the content might be at `response.data.choices[0].message.content` instead of `response.choices[0].message.content`.

Add this code to your Format Response Function node to handle different nesting structures:

```javascript
// Handle different nesting structures
let inputToProcess = input;

// Check if the response is nested under a 'data' property
if (!input.choices && input.data && input.data.choices) {
  inputToProcess = input.data;
  console.log("Found nested data structure, using input.data");
}

// Now process inputToProcess instead of input
```

### Step 8: Add Error Handling to Your Function Nodes

Add try/catch blocks to your Function nodes to catch and log any errors:

```javascript
try {
  // Your existing code
} catch (error) {
  console.error("Error in function node:", error.message);
  // Return a fallback response
  return [{
    json: {
      id: `error-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: 'error',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: `Error: ${error.message}`
          },
          finish_reason: 'error'
        }
      ]
    }
  }];
}
```

## Advanced Debugging Techniques

### Technique 1: Intercept and Modify the Response

Add a Function node between the OpenAI Chat Model and the AI Agent to intercept and modify the response:

```javascript
// Log the entire response
console.log("Full response:", JSON.stringify(items[0].json));

// Return the response as-is for now
return items;
```

This will help you see the exact structure of the response without modifying it.

### Technique 2: Use a Set Node to Ensure Proper Structure

Add a Set node after the OpenAI Chat Model to ensure the response has the correct structure:

```
{
  "id": "{{$json.id || 'chatcmpl-' + Date.now()}}",
  "object": "{{$json.object || 'chat.completion'}}",
  "created": "{{$json.created || Math.floor(Date.now() / 1000)}}",
  "model": "{{$json.model || 'unknown'}}",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "{{$json.choices?.[0]?.message?.content || 'No content available'}}"
      },
      "finish_reason": "{{$json.choices?.[0]?.finish_reason || 'stop'}}"
    }
  ]
}
```

### Technique 3: Use the Native OpenRouter Node

If n8n version 1.77.0 or later is available, try using the native OpenRouter node instead of the OpenAI Chat Model node with custom configuration.

## Need More Help?

If you're still experiencing issues after trying these debugging steps, please provide:

1. The exact error message and stack trace
2. Screenshots of your workflow configuration
3. The logs from each node in your workflow
4. The model you're trying to use

This information will help diagnose and fix the issue more effectively.
