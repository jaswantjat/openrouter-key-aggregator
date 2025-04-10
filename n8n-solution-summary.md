# Solutions for "Cannot read properties of undefined (reading 'content')" Error in n8n

This document provides a summary of the solutions to fix the "Cannot read properties of undefined (reading 'content')" error when using the OpenRouter Key Aggregator with n8n's AI Agent node.

## Root Cause

The error occurs when the ToolCallingAgentOutputParser in n8n's AI Agent node tries to access a 'content' property that doesn't exist in the response from the OpenRouter Key Aggregator. This happens because:

1. The response format from OpenRouter doesn't match what n8n's AI Agent node expects
2. The message object in the choices array is missing or undefined
3. The content property within the message object is missing or undefined

## Solution 1: Use the Dedicated chatInput Endpoint (Recommended)

This is the most reliable solution as it's specifically designed to handle n8n's format requirements:

1. **Create a Function Node** before your OpenAI Chat Model node with this code:

```javascript
// Input from previous node
const userInput = items[0].json.userInput || "Hello";

// Format for the chatInput endpoint
return [{
  json: {
    model: "deepseek/deepseek-chat-v3-0324:free", // Use one of the supported free models
    chatInput: userInput // Will be automatically converted to messages format
  }
}];
```

2. **Configure your OpenAI credentials** in n8n with these settings:
   - **Base URL**: `https://openrouter-key-aggregator.onrender.com/api`
   - **API Key**: Your OpenRouter Key Aggregator API key
   - **Custom Headers**: `{"X-API-Key": "YOUR_API_KEY_HERE"}`

## Solution 2: Add a Response Formatter Function Node

If Solution 1 doesn't work, add a Function node AFTER the OpenAI Chat Model node to ensure the response is properly formatted:

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

## Solution 3: Complete Workflow with Both Input and Response Formatting

For the most reliable solution, create a complete workflow that includes both input formatting and response formatting:

1. **Manual Input Node** → Provides the initial input
2. **Format Input Function Node** → Formats the input for the OpenAI Chat Model
3. **OpenAI Chat Model Node** → Makes the request to the OpenRouter Key Aggregator
4. **Format Response Function Node** → Ensures the response is properly formatted
5. **AI Agent Node** → Processes the formatted response

See the [Complete Workflow Instructions](n8n-complete-workflow-instructions.md) for detailed steps.

## Additional Tips

1. **Use the correct model ID**: Make sure you're using one of the supported free models:
   - `meta-llama/llama-4-maverick:free`
   - `meta-llama/llama-4-scout:free`
   - `deepseek/deepseek-chat-v3-0324:free`

2. **Check your API key**: Verify that your API key is valid and has sufficient credits

3. **Verify the base URL**: Make sure you're using the correct base URL: `https://openrouter-key-aggregator.onrender.com/api`

4. **Add custom headers**: Make sure you've added the API key in both the credential settings and the custom headers

5. **Try different models**: If one model doesn't work, try another to see if the issue is specific to one model

## Need More Help?

If you're still experiencing issues, see the [Debugging Guide](n8n-debugging-guide.md) for advanced troubleshooting techniques.
