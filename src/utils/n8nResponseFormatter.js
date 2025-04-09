/**
 * n8n Response Formatter
 * 
 * This utility ensures that all responses sent to n8n have the correct structure
 * to prevent the "Cannot read properties of undefined (reading 'content')" error.
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
    // Create a properly formatted response
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
          formattedChoice.message = {
            role: choice.message.role || 'assistant',
            content: choice.message.content || 'No content available.'
          };
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
