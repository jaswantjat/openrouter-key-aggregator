# n8n Integration Guide for OpenRouter Key Aggregator

This guide provides detailed instructions for integrating the OpenRouter Key Aggregator with n8n, focusing specifically on resolving the "Cannot read properties of undefined (reading 'content')" error and ensuring proper model discovery.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Configuration in n8n](#configuration-in-n8n)
3. [Using the OpenAI Chat Model Node](#using-the-openai-chat-model-node)
4. [Troubleshooting](#troubleshooting)
5. [Advanced Configuration](#advanced-configuration)

## Prerequisites

- A running instance of the OpenRouter Key Aggregator
- An API key for the OpenRouter Key Aggregator
- n8n installed and running

## Configuration in n8n

### Step 1: Add OpenAI API Credentials

1. In n8n, go to **Settings** > **Credentials**
2. Click on **New Credential**
3. Select **OpenAI API**
4. Configure the credentials with the following settings:
   - **Name**: OpenRouter Key Aggregator (or any name you prefer)
   - **API Key**: Your OpenRouter Key Aggregator API key (e.g., `51fa83450b6f92dd3606cad17d261d3d`)
   - **Base URL**: `https://openrouter-key-aggregator.onrender.com/api`
   - **Organization ID**: Leave empty
   - **Custom Headers**:
     ```json
     {
       "X-API-Key": "YOUR_API_KEY_HERE"
     }
     ```
   - Replace `YOUR_API_KEY_HERE` with your actual API key
5. Click **Save**

### Step 2: Test the Credentials

1. After saving the credentials, click on **Test** to verify the connection
2. If the test is successful, you should see a green checkmark
3. If the test fails, check the error message and refer to the [Troubleshooting](#troubleshooting) section

## Using the OpenAI Chat Model Node

### Step 1: Using the chatInput Format (Simplified Approach)

The OpenRouter Key Aggregator now supports the n8n-specific `chatInput` format directly, which simplifies integration:

1. Add a **Function** node to your workflow
2. Configure it with the following code:

```javascript
// Input from previous node
const chatInput = items[0].json.userInput || "Hi";

// Use the simplified chatInput format
return [{
  json: {
    model: "deepseek/deepseek-chat-v3-0324:free", // Use one of the exact free model IDs
    chatInput: chatInput // The OpenRouter Key Aggregator will convert this to messages format automatically
  }
}];
```

3. Connect this Function node to your OpenAI Chat Model node

### Step 2: Using the Messages Format (Traditional Approach)

Alternatively, you can use the standard OpenAI messages format:

1. Add a **Function** node to your workflow
2. Configure it with the following code:

```javascript
// Input from previous node: items[0].json.chatInput
const chatInput = items[0].json.chatInput || "Hi";

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

3. Connect this Function node to your OpenAI Chat Model node

### Step 2: Configure the OpenAI Chat Model Node

1. Add an **OpenAI Chat Model** node to your workflow
2. Configure it with the following settings:
   - **Connection**: Select the OpenRouter Key Aggregator credentials you created
   - **Model**: Select `deepseek/deepseek-chat-v3-0324:free` from the dropdown
   - If the model doesn't appear in the dropdown, you can manually enter it
   - **Options**: Leave as default or configure as needed

## Troubleshooting

### Model Not Found Error

If you encounter a "Model not found" error:

1. Make sure you're using one of the exact model IDs:
   - `meta-llama/llama-4-maverick:free`
   - `meta-llama/llama-4-scout:free`
   - `google/gemini-2.5-pro-exp-03-25:free`
   - `deepseek/deepseek-chat-v3-0324:free`
   - `google/gemini-2.0-flash-exp:free`

2. Try manually entering the model ID instead of selecting from the dropdown

### Cannot Read Properties of Undefined (reading 'content') Error

This error occurs when the message format is incorrect. To fix it:

#### Solution 1: Use the chatInput Format

The OpenRouter Key Aggregator now supports the n8n-specific `chatInput` format directly:

```javascript
return [{
  json: {
    model: "deepseek/deepseek-chat-v3-0324:free",
    chatInput: "Your message here" // Will be automatically converted to messages format
  }
}];
```

This is the simplest solution and should work in most cases.

#### Solution 2: Fix Input Format

If the chatInput format doesn't work, use the standard messages format:

1. Make sure you're using the Function node as described above to format your messages
2. Verify that your messages array has the correct structure:
   ```json
   {
     "messages": [
       {
         "role": "user",
         "content": "Your message here"
       }
     ]
   }
   ```

3. Check that the OpenAI Chat Model node is properly connected to the Function node

4. If you're still encountering issues, try using the full model ID (e.g., `deepseek/deepseek-chat-v3-0324:free`) instead of a simplified name

#### Solution 2: Add a Response Formatter Function Node

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

Connect this Function node to your AI Agent node to ensure it always receives a properly formatted response.

### Authentication Errors

If you encounter authentication errors:

1. Verify that your API key is correct
2. Make sure you've added the API key in both the credential settings and the custom headers
3. Check that the base URL is correct: `https://openrouter-key-aggregator.onrender.com/api`

## Advanced Configuration

### Using Different Models

The OpenRouter Key Aggregator supports the following free models:

- `meta-llama/llama-4-maverick:free`
- `meta-llama/llama-4-scout:free`
- `google/gemini-2.5-pro-exp-03-25:free`
- `deepseek/deepseek-chat-v3-0324:free`
- `google/gemini-2.0-flash-exp:free`

To use a different model, simply change the model parameter in your Function node:

```javascript
return [{
  json: {
    model: "google/gemini-2.5-pro-exp-03-25:free", // Change to your preferred model
    messages: [
      {
        role: "user",
        content: chatInput
      }
    ]
  }
}];
```

### Rate Limits

Be aware of OpenRouter's rate limits:
- Free models: 50 requests/day with <10 credits, 1000 requests/day with ≥10 credits

If you encounter rate limit errors, consider adding credits to your OpenRouter account or implementing retry logic in your workflow.
