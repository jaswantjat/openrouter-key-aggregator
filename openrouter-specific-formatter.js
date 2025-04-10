/**
 * OpenRouter-Specific Response Formatter for n8n
 * 
 * This function node specifically handles the exact response format from OpenRouter API
 * and transforms it into the format expected by n8n's AI Agent node.
 * 
 * Example input from OpenRouter:
 * {
 *   "response": {
 *     "generations": [
 *       [
 *         {
 *           "text": "Hello! How can I assist you today? 😊",
 *           "generationInfo": {
 *             "prompt": 0,
 *             "completion": 0,
 *             "finish_reason": "stop",
 *             "model_name": "deepseek/deepseek-chat-v3-0324"
 *           }
 *         }
 *       ]
 *     ]
 *   },
 *   "tokenUsage": {
 *     "completionTokens": 12,
 *     "promptTokens": 9,
 *     "totalTokens": 21
 *   }
 * }
 * 
 * Expected output for n8n AI Agent:
 * {
 *   "id": "chatcmpl-123456789",
 *   "object": "chat.completion",
 *   "created": 1234567890,
 *   "model": "deepseek/deepseek-chat-v3-0324",
 *   "choices": [
 *     {
 *       "index": 0,
 *       "message": {
 *         "role": "assistant",
 *         "content": "Hello! How can I assist you today? 😊"
 *       },
 *       "finish_reason": "stop"
 *     }
 *   ],
 *   "usage": {
 *     "prompt_tokens": 9,
 *     "completion_tokens": 12,
 *     "total_tokens": 21
 *   }
 * }
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
