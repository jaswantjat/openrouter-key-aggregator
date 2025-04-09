/**
 * Example Function node for n8n to format messages for the OpenRouter Key Aggregator
 * 
 * This function takes the chatInput from n8n and formats it into the proper messages array
 * for the OpenRouter Key Aggregator.
 * 
 * Place this Function node before the AI Agent node in your n8n workflow.
 */

// Input from previous node: items[0].json.chatInput
const chatInput = items[0].json.chatInput || "Hi";

// Format message properly for AI Agent
return [{
  json: {
    model: "meta-llama/llama-4-scout:free", // Use one of the exact free model IDs
    messages: [
      {
        role: "user",
        content: chatInput
      }
    ]
  }
}];

/**
 * Configuration for n8n AI Agent node:
 * 
 * Base URL: https://openrouter-key-aggregator.onrender.com/api
 * API Key: 51fa83450b6f92dd3606cad17d261d3d
 * Custom Headers: {
 *   "X-API-Key": "51fa83450b6f92dd3606cad17d261d3d"
 * }
 * 
 * Available free models:
 * - meta-llama/llama-4-maverick:free
 * - meta-llama/llama-4-scout:free
 * - google/gemini-2.5-pro-exp-03-25:free
 * - deepseek/deepseek-chat-v3-0324:free
 * - google/gemini-2.0-flash-exp:free
 */
