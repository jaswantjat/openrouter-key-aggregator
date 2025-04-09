# Fixing "Cannot read properties of undefined (reading 'content')" Error in n8n

This guide provides detailed instructions for resolving the common "Cannot read properties of undefined (reading 'content')" error when using the OpenRouter Key Aggregator with n8n's AI Agent node.

## Understanding the Error

This error occurs when n8n's AI Agent node tries to access the `content` property of a message that doesn't exist or is undefined in the response. This typically happens when:

1. The response from OpenRouter doesn't have the expected structure
2. The message object in the choices array is missing or undefined
3. The content property within the message object is missing or undefined

## Solution 1: Use the Function Node to Format Input

The most reliable way to prevent this error is to use a Function node before your OpenAI Chat Model node to ensure your input is properly formatted:

```javascript
// Input from previous node or manual input
const chatInput = items[0].json.chatInput || "What is the capital of France?";

// Format message properly for AI Agent
// IMPORTANT: Use this exact format to ensure compatibility
return [{
  json: {
    model: "deepseek/deepseek-chat-v3-0324:free", // Use one of the exact free model IDs
    messages: [
      {
        role: "user",
        content: chatInput
      }
    ]
  }
}];
```

## Solution 2: Add a Response Formatter Function Node

If Solution 1 doesn't work, add a second Function node AFTER the OpenAI Chat Model node to ensure the response is properly formatted:

```javascript
// Input from the OpenAI Chat Model node
const input = items[0].json;

// Create a properly formatted response that n8n can process
let formattedResponse = {
  id: input.id || `chatcmpl-${Date.now()}`,
  object: input.object || 'chat.completion',
  created: input.created || Math.floor(Date.now() / 1000),
  model: input.model || 'unknown',
  choices: []
};

// Handle the case where choices might be missing or malformed
if (!input.choices || !Array.isArray(input.choices) || input.choices.length === 0) {
  // Create a default choice with a message and content
  formattedResponse.choices = [
    {
      index: 0,
      message: {
        role: 'assistant',
        content: 'No response generated.'
      },
      finish_reason: 'stop'
    }
  ];
} else {
  // Process each choice to ensure it has a message with content
  formattedResponse.choices = input.choices.map((choice, index) => {
    // Create a new choice object with all required fields
    const formattedChoice = {
      index: choice.index || index,
      finish_reason: choice.finish_reason || 'stop'
    };
    
    // Ensure message exists and has content
    if (!choice.message) {
      formattedChoice.message = {
        role: 'assistant',
        content: 'No message content available.'
      };
    } else {
      formattedChoice.message = {
        role: choice.message.role || 'assistant',
        content: choice.message.content || 'No content available.'
      };
    }
    
    return formattedChoice;
  });
}

// Add usage information if available
formattedResponse.usage = input.usage || {
  prompt_tokens: 0,
  completion_tokens: 0,
  total_tokens: 0
};

// Return the formatted response
return [{
  json: formattedResponse
}];
```

## Complete Workflow Example

For the most reliable solution, use both Function nodes in your workflow:

1. **Manual Input Node** → Provides the initial input
2. **Format Input Function Node** → Formats the input for the OpenAI Chat Model
3. **OpenAI Chat Model Node** → Makes the request to the OpenRouter Key Aggregator
4. **Format Response Function Node** → Ensures the response is properly formatted
5. **AI Agent Node** → Processes the formatted response

## Configuration in n8n

Use the following configuration in n8n:

```
Base URL: https://openrouter-key-aggregator.onrender.com/api
API Key: YOUR_API_KEY_HERE
Custom Headers: {
  "X-API-Key": "YOUR_API_KEY_HERE"
}
```

## Available Free Models

Use one of the following exact free model IDs:

- `meta-llama/llama-4-maverick:free`
- `meta-llama/llama-4-scout:free`
- `google/gemini-2.5-pro-exp-03-25:free`
- `deepseek/deepseek-chat-v3-0324:free`
- `google/gemini-2.0-flash-exp:free`

## Additional Troubleshooting

If you're still encountering issues:

1. Check that your API key is valid and has sufficient credits
2. Verify that you're using the correct base URL
3. Make sure you're using one of the supported model IDs
4. Check the OpenRouter Key Aggregator logs for any errors
5. Try using a different model to see if the issue is specific to one model

## Need More Help?

If you're still experiencing issues, please open an issue on the GitHub repository with the following information:

1. The exact error message you're seeing
2. Your n8n workflow configuration (screenshots or export)
3. The model you're trying to use
4. Any relevant logs from the OpenRouter Key Aggregator
