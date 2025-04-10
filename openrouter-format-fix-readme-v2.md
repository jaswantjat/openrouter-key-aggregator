# OpenRouter Format Fix for n8n AI Agent Node

This update addresses the "Cannot read properties of undefined (reading 'content')" error in n8n's AI Agent node when using the OpenRouter Key Aggregator.

## The Problem

The error occurs because of format mismatches between n8n, OpenRouter Key Aggregator, and OpenRouter API. There are two specific formats that need to be handled:

### 1. n8n chatInput Request Format:
```json
[
  {
    "sessionId": "959e177ee7ec4da88dc64b186d031821",
    "action": "sendMessage",
    "chatInput": "i"
  }
]
```

### 2. OpenRouter Response Format:
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

### Expected Format for n8n AI Agent:
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

The key differences are:
1. n8n sends the chatInput in an array format with sessionId and action fields
2. OpenRouter's response has the text content nested under `response.generations[0][0].text`
3. n8n's AI Agent expects the content under `choices[0].message.content`

## The Solution

This update modifies the OpenRouter Key Aggregator to handle both the specific request format from n8n and the response format from OpenRouter:

1. **Updated n8nResponseFormatter.js**: Added specific handling for the OpenRouter response format with generations array.
2. **Updated chatInputController.js**: Added handling for the n8n array format with sessionId and action fields.

### Key Changes in chatInputController.js:

```javascript
// Handle array input format
if (Array.isArray(requestData) && requestData.length > 0) {
  console.log(`[DEBUG] Detected array input format`);
  
  // Use the first item in the array
  const firstItem = requestData[0];
  
  // Check if it has the expected structure with sessionId, action, and chatInput
  if (firstItem.sessionId && firstItem.action === 'sendMessage' && firstItem.chatInput) {
    console.log(`[DEBUG] Detected n8n specific format with sessionId and action`);
    
    // Extract the chatInput
    requestData = {
      chatInput: firstItem.chatInput,
      model: req.query.model || 'deepseek/deepseek-chat-v3-0324:free', // Default model if not specified
      sessionId: firstItem.sessionId // Keep the sessionId for reference
    };
    
    console.log(`[DEBUG] Extracted chatInput: ${requestData.chatInput}`);
  }
}

// If the original request was in array format, return the response in array format
if (Array.isArray(req.body)) {
  console.log(`[DEBUG] Returning response in array format`);
  
  // Create a response that matches the expected format for n8n
  const arrayResponse = [
    {
      sessionId: requestData.sessionId || 'session-123',
      response: {
        generations: [
          [
            {
              text: formattedResponse.choices[0].message.content,
              generationInfo: {
                finish_reason: formattedResponse.choices[0].finish_reason,
                model_name: formattedResponse.model
              }
            }
          ]
        ]
      },
      tokenUsage: {
        promptTokens: formattedResponse.usage.prompt_tokens,
        completionTokens: formattedResponse.usage.completion_tokens,
        totalTokens: formattedResponse.usage.total_tokens
      }
    }
  ];
  
  return res.json(arrayResponse);
}
```

### Key Changes in n8nResponseFormatter.js:

```javascript
// Check for the specific OpenRouter response format with generations array
if (response.response && response.response.generations && 
    Array.isArray(response.response.generations) && response.response.generations.length > 0 &&
    Array.isArray(response.response.generations[0]) && response.response.generations[0].length > 0) {
  
  console.log(`[DEBUG] Detected OpenRouter specific format with generations array`);
  
  // Extract the text from the first generation
  const generation = response.response.generations[0][0];
  const text = generation.text || "";
  const modelName = generation.generationInfo?.model_name || requestData.model || "unknown";
  const finishReason = generation.generationInfo?.finish_reason || "stop";

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
          content: text // This is the critical part for n8n
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

  return formattedResponse;
}
```

## How to Apply the Changes

1. Replace your existing `src/utils/n8nResponseFormatter.js` file with the updated version.
2. Replace your existing `src/controllers/chatInputController.js` file with the updated version.
3. Restart your OpenRouter Key Aggregator service.

## Testing the Changes

After applying the changes, test your n8n workflow with the AI Agent node:

1. Create a simple workflow with a Manual Input node, OpenAI Chat Model node, and AI Agent node.
2. Configure the OpenAI Chat Model node to use your OpenRouter Key Aggregator.
3. Run the workflow and check if the error is resolved.

## Additional Resources

- [n8n Documentation](https://docs.n8n.io/)
- [OpenRouter Documentation](https://openrouter.ai/docs)
- [LangChain Documentation](https://js.langchain.com/docs/)
