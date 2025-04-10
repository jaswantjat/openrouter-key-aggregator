/**
 * n8n Function Node to Format Input for OpenRouter Key Aggregator
 * 
 * This function node should be placed BEFORE the OpenAI Chat Model node
 * to ensure the request is properly formatted for the chatInput endpoint.
 */

// Input from previous node (adjust as needed)
const userInput = items[0].json.userInput || items[0].json.chatInput || "Hello";

// Format for the chatInput endpoint
return [{
  json: {
    model: "deepseek/deepseek-chat-v3-0324:free", // Use one of the supported free models
    chatInput: userInput // Will be automatically converted to messages format
  }
}];
