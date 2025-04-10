# Handling OpenRouter's Specific Response Format in n8n

This guide provides detailed instructions for handling OpenRouter's specific response format in n8n to fix the "Cannot read properties of undefined (reading 'content')" error.

## Understanding OpenRouter's Response Format

OpenRouter returns responses in a specific format that differs from what n8n's AI Agent node expects. Here's an example of OpenRouter's response format:

```json
{
  "response": {
    "generations": [
      [
        {
          "text": "Hello! How can I assist you today? 😊",
          "generationInfo": {
            "prompt": 0,
            "completion": 0,
            "finish_reason": "stop",
            "model_name": "deepseek/deepseek-chat-v3-0324"
          }
        }
      ]
    ]
  },
  "tokenUsage": {
    "completionTokens": 12,
    "promptTokens": 9,
    "totalTokens": 21
  }
}
```

## What n8n's AI Agent Node Expects

The n8n AI Agent node, specifically the ToolCallingAgentOutputParser in Langchain, expects a response in this format:

```json
{
  "id": "chatcmpl-123456789",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "deepseek/deepseek-chat-v3-0324",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! How can I assist you today? 😊"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 9,
    "completion_tokens": 12,
    "total_tokens": 21
  }
}
```

The key difference is that OpenRouter's response has the text content nested under `response.generations[0][0].text`, while n8n's AI Agent expects it under `choices[0].message.content`.

## Solution: OpenRouter-Specific Response Formatter

To fix this issue, you need to add a Function node after the OpenAI Chat Model node to transform OpenRouter's response format into the format expected by n8n's AI Agent node.

### Step 1: Add a Function Node

Add a Function node after the OpenAI Chat Model node and name it "Format Response".

### Step 2: Add the Following Code to the Function Node

```javascript
/**
 * OpenRouter-Specific Response Formatter for n8n
 * 
 * This function node specifically handles the exact response format from OpenRouter API
 * and transforms it into the format expected by n8n's AI Agent node.
 */

// Input from the OpenRouter API call
const input = items[0].json;

// Log the input for debugging
console.log("OpenRouter response:", JSON.stringify(input).substring(0, 500));

try {
  // Check if we have the expected structure
  if (!input || !input.response || !input.response.generations || 
      !Array.isArray(input.response.generations) || input.response.generations.length === 0 ||
      !Array.isArray(input.response.generations[0]) || input.response.generations[0].length === 0) {
    
    // If we don't have the expected structure, check if we already have a compatible format
    if (input.choices && Array.isArray(input.choices) && input.choices.length > 0 && 
        input.choices[0].message && input.choices[0].message.content) {
      console.log("Response already in compatible format");
      return items;
    }
    
    throw new Error("Invalid OpenRouter response format");
  }

  // Extract the text from the first generation
  const generation = input.response.generations[0][0];
  const text = generation.text || "";
  const modelName = generation.generationInfo?.model_name || "unknown";
  const finishReason = generation.generationInfo?.finish_reason || "stop";

  // Extract token usage
  const promptTokens = input.tokenUsage?.promptTokens || 0;
  const completionTokens = input.tokenUsage?.completionTokens || 0;
  const totalTokens = input.tokenUsage?.totalTokens || 0;

  // Create the properly formatted response for n8n AI Agent
  const formattedResponse = {
    id: `chatcmpl-${Date.now()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: modelName,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: text
        },
        finish_reason: finishReason
      }
    ],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens
    }
  };

  // Log the formatted response for debugging
  console.log("Formatted response for n8n:", JSON.stringify(formattedResponse).substring(0, 500));

  // Return the formatted response
  return [{
    json: formattedResponse
  }];
} catch (error) {
  console.error("Error formatting OpenRouter response:", error.message);
  
  // Return a fallback response
  return [{
    json: {
      id: `error-${Date.now()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: "error",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: `Error formatting OpenRouter response: ${error.message}`
          },
          finish_reason: "error"
        }
      ],
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      },
      error: {
        message: error.message,
        stack: error.stack
      }
    }
  }];
}
```

### Step 3: Connect the Nodes

Connect the nodes in the following order:
1. Manual Input → Format Input
2. Format Input → OpenAI Chat Model
3. OpenAI Chat Model → Format Response
4. Format Response → AI Agent

## Explanation of the Solution

This solution works by:

1. Taking the response from OpenRouter
2. Extracting the text content from `response.generations[0][0].text`
3. Extracting the model name from `response.generations[0][0].generationInfo.model_name`
4. Extracting the finish reason from `response.generations[0][0].generationInfo.finish_reason`
5. Extracting token usage from `tokenUsage`
6. Creating a new response object in the format expected by n8n's AI Agent node
7. Returning the formatted response

The formatter also includes error handling to ensure that even if the response format is unexpected, it will still return a valid response that the AI Agent node can process.

## References

### OpenRouter API Documentation

According to the [OpenRouter API documentation](https://openrouter.ai/docs/api-reference/chat), the response format for chat completions is:

```json
{
  "id": "gen-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "model": "anthropic/claude-3-opus:beta",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! How can I assist you today?"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 9,
    "completion_tokens": 9,
    "total_tokens": 18
  }
}
```

However, when using the OpenRouter Key Aggregator, the response format is different, as shown in the example at the beginning of this guide.

### n8n AI Agent Node Documentation

According to the [n8n AI Agent node documentation](https://docs.n8n.io/integrations/builtin/cluster-nodes/root-nodes/n8n-nodes-langchain.agent/), the AI Agent node expects responses in the OpenAI format, which includes a `choices` array with `message` objects that have `role` and `content` properties.

## Troubleshooting

If you're still encountering issues:

1. Check the logs of the Format Response node to see the exact structure of the response from OpenRouter
2. Verify that your API key is valid and has sufficient credits
3. Make sure you're using the correct base URL and model ID
4. Try using a different model to see if the issue is specific to one model
5. Disable the "Require Specific Output Format" setting in the AI Agent node to see if that affects the error

## Need More Help?

If you're still experiencing issues after implementing this solution, please provide:

1. The exact error message and stack trace
2. Screenshots of your workflow configuration
3. The logs from each node in your workflow
4. The model you're trying to use

This information will help diagnose and fix the issue more effectively.
