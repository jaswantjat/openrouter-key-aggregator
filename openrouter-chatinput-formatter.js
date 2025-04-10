/**
 * OpenRouter-Specific ChatInput Formatter for n8n
 * 
 * This function node specifically handles the chatInput format for OpenRouter
 * and ensures the response is properly formatted for n8n's AI Agent node.
 */

// Input from previous node
const chatInput = items[0].json.chatInput || items[0].json.userInput || "Hello";

// Log the input for debugging
console.log("ChatInput:", chatInput);

// Format for OpenRouter with chatInput
return [{
  json: {
    model: "deepseek/deepseek-chat-v3-0324:free", // Use one of the supported free models
    chatInput: chatInput,
    // Add a flag to indicate this is a chatInput request
    _isChatInputRequest: true,
    // Add a callback to format the response
    _responseFormatter: function(response) {
      // Check if we have the expected structure
      if (!response || !response.response || !response.response.generations || 
          !Array.isArray(response.response.generations) || response.response.generations.length === 0 ||
          !Array.isArray(response.response.generations[0]) || response.response.generations[0].length === 0) {
        return {
          id: `error-${Date.now()}`,
          object: "chat.completion",
          created: Math.floor(Date.now() / 1000),
          model: "error",
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: "Error: Invalid response format from OpenRouter"
              },
              finish_reason: "error"
            }
          ],
          usage: {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0
          }
        };
      }

      // Extract the text from the first generation
      const generation = response.response.generations[0][0];
      const text = generation.text || "";
      const modelName = generation.generationInfo?.model_name || "unknown";
      const finishReason = generation.generationInfo?.finish_reason || "stop";

      // Extract token usage
      const promptTokens = response.tokenUsage?.promptTokens || 0;
      const completionTokens = response.tokenUsage?.completionTokens || 0;
      const totalTokens = response.tokenUsage?.totalTokens || 0;

      // Create the properly formatted response for n8n AI Agent
      return {
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
    }
  }
}];
