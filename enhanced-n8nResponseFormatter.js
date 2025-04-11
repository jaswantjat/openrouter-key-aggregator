/**
 * Enhanced n8n Response Formatter
 * 
 * This utility ensures that all responses sent to n8n have the correct structure
 * to prevent the "Cannot read properties of undefined (reading 'content')" error.
 * 
 * It handles multiple response formats:
 * 1. OpenRouter standard format
 * 2. OpenRouter generations format
 * 3. Error responses
 */

/**
 * Formats a response to ensure it's compatible with n8n's AI Agent node
 * @param {Object} response - The response from OpenRouter or error object
 * @param {Object} requestData - The original request data
 * @returns {Object} - A properly formatted response for n8n
 */
function formatResponseForN8n(response, requestData = {}) {
  console.log(`[DEBUG] Formatting response for n8n compatibility`);
  
  // If this is already an error response, ensure it has the right structure
  if (response.error) {
    return formatErrorResponseForN8n(response.error, requestData);
  }

  try {
    // IMPORTANT: Check for the specific OpenRouter response format with generations array
    if (response.response && response.response.generations && 
        Array.isArray(response.response.generations) && response.response.generations.length > 0 &&
        Array.isArray(response.response.generations[0]) && response.response.generations[0].length > 0) {
      
      console.log(`[DEBUG] Detected OpenRouter specific format with generations array`);
      
      // Extract the text from the first generation
      const generation = response.response.generations[0][0];
      const text = generation.text || "";
      const modelName = generation.generationInfo?.model_name || requestData.model || "unknown";
      const finishReason = generation.generationInfo?.finish_reason || "stop";

      // Extract token usage
      const promptTokens = response.tokenUsage?.promptTokens || 0;
      const completionTokens = response.tokenUsage?.completionTokens || 0;
      const totalTokens = response.tokenUsage?.totalTokens || 0;

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

      console.log(`[DEBUG] Formatted OpenRouter generations response: ${JSON.stringify(formattedResponse).substring(0, 200)}...`);
      return formattedResponse;
    }
    
    // Check for nested response structure
    if (response.data && (response.data.choices || response.data.response)) {
      console.log(`[DEBUG] Detected nested response structure with data property`);
      return formatResponseForN8n(response.data, requestData);
    }

    // Create a properly formatted response for standard format
    const formattedResponse = {
      id: response.id || `gen-${Date.now()}`,
      object: response.object || 'chat.completion',
      created: response.created || Math.floor(Date.now() / 1000),
      model: response.model || requestData.model || 'unknown',
      choices: []
    };

    // Handle the case where choices might be missing or malformed
    if (!response.choices || !Array.isArray(response.choices) || response.choices.length === 0) {
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
      formattedResponse.choices = response.choices.map((choice, index) => {
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
          // Handle different content formats
          let content = choice.message.content;
          
          // Handle array content (some models return content as an array)
          if (Array.isArray(content)) {
            let textContent = '';
            content.forEach(part => {
              if (typeof part === 'string') {
                textContent += part;
              } else if (part && part.type === 'text' && part.text) {
                textContent += part.text;
              }
            });
            content = textContent;
          }
          
          // Handle JSON string content
          if (typeof content === 'string' && 
              ((content.startsWith('{') && content.endsWith('}')) || 
               (content.startsWith('[') && content.endsWith(']')))) {
            try {
              const parsedContent = JSON.parse(content);
              // Keep the original string if parsing succeeds but we want to maintain string format
              // This is just to validate it's proper JSON
              console.log(`[DEBUG] Successfully parsed JSON content`);
            } catch (error) {
              console.log(`[DEBUG] Content looks like JSON but failed to parse: ${error.message}`);
            }
          }
          
          formattedChoice.message = {
            role: choice.message.role || 'assistant',
            content: content || 'No content available.'
          };
          
          // Add any additional properties from the original message
          Object.entries(choice.message).forEach(([key, value]) => {
            if (!['role', 'content'].includes(key)) {
              formattedChoice.message[key] = value;
            }
          });
        }
        
        return formattedChoice;
      });
    }

    // Add usage information if available
    formattedResponse.usage = response.usage || {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0
    };

    console.log(`[DEBUG] Formatted response: ${JSON.stringify(formattedResponse).substring(0, 200)}...`);
    return formattedResponse;
  } catch (error) {
    console.error(`[ERROR] Error formatting response: ${error.message}`);
    console.error(error.stack);
    
    return formatErrorResponseForN8n({
      message: `Error formatting response: ${error.message}`,
      code: 500
    }, requestData);
  }
}

/**
 * Formats an error response to ensure it's compatible with n8n's AI Agent node
 * @param {Object} error - The error object
 * @param {Object} requestData - The original request data
 * @returns {Object} - A properly formatted error response for n8n
 */
function formatErrorResponseForN8n(error, requestData = {}) {
  console.log(`[DEBUG] Formatting error response for n8n compatibility: ${JSON.stringify(error)}`);
  
  const errorMessage = error.message || 'Unknown error';
  const errorStatus = error.code || 500;
  const errorData = error.metadata || null;

  // Create a response that's compatible with n8n's AI Agent node and LangChain
  // The critical part is ensuring choices[0].message.content exists
  const errorResponse = {
    id: `error-${Date.now()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: requestData.model || 'error',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: `Error: ${errorMessage}` // This is the critical part for n8n
        },
        finish_reason: 'error'
      }
    ],
    usage: {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0
    },
    error: {
      message: errorMessage,
      type: 'server_error',
      code: errorStatus,
      ...(errorData ? { metadata: errorData } : {})
    }
  };

  console.log(`[DEBUG] Formatted error response: ${JSON.stringify(errorResponse).substring(0, 200)}...`);
  return errorResponse;
}

module.exports = {
  formatResponseForN8n,
  formatErrorResponseForN8n
};
