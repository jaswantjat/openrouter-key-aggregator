/**
 * n8n Response Formatter
 * 
 * This utility ensures that all responses sent to n8n have the correct structure
 * to prevent the "Cannot read properties of undefined (reading 'content')" error,
 * particularly when dealing with tool calls.
 */

/**
 * Formats a response to ensure it's compatible with n8n's AI Agent node
 * @param {Object} response - The response from OpenRouter or error object
 * @param {Object} requestData - The original request data
 * @returns {Object} - A properly formatted response for n8n
 */
function formatResponseForN8n(response, requestData = {}) {
  console.log(`[DEBUG] Formatting response for n8n compatibility (Formatter V2)`);
  
  // If this is already an error response, ensure it has the right structure
  if (response.error && !response.choices) { // Check if it's purely an error structure
    console.log(`[DEBUG] Formatting as error response.`);
    // Pass the original error object from the response if available
    const errorObj = response.error || { message: 'Unknown error during formatting', code: 500 };
    return formatErrorResponseForN8n(errorObj, requestData);
  }

  try {
    // Create a base structure, copying essential top-level fields
    const formattedResponse = {
      id: response.id || `gen-${Date.now()}`,
      object: response.object || 'chat.completion',
      created: response.created || Math.floor(Date.now() / 1000),
      model: response.model || requestData.model || 'unknown',
      choices: [],
      usage: response.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
    };

    // Process choices carefully
    if (!response.choices || !Array.isArray(response.choices) || response.choices.length === 0) {
      console.log('[DEBUG] Original response has no choices, creating default choice.');
      // Create a default choice only if none exist
      formattedResponse.choices = [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: 'No response generated.' // Default content when no choices received
          },
          finish_reason: 'stop'
        }
      ];
    } else {
      // Map existing choices, preserving structure correctly
      formattedResponse.choices = response.choices.map((choice, index) => {
        
        // Ensure the choice has a message object
        if (!choice.message) {
            console.warn(`[WARN] Choice index ${index} is missing message object. Creating default.`);
            return {
                index: choice.index !== undefined ? choice.index : index,
                message: {
                    role: 'assistant',
                    content: '' // Default to empty string if message was missing
                },
                finish_reason: choice.finish_reason || 'stop' 
            };
        }

        // Create the base formatted choice, copying index and finish_reason
        const formattedChoice = {
          index: choice.index !== undefined ? choice.index : index,
          message: { // Start building the message object
            role: choice.message.role || 'assistant'
            // Content and tool_calls handled next
          },
          finish_reason: choice.finish_reason || 'stop' // Preserve original finish_reason
        };

        // Check for tool_calls
        const hasToolCalls = choice.message.tool_calls && Array.isArray(choice.message.tool_calls);

        if (hasToolCalls) {
            // If tool_calls exist, copy them and set content to null (unless already provided)
            formattedChoice.message.tool_calls = choice.message.tool_calls;
            // IMPORTANT: Content must be null if tool_calls are present, according to OpenAI spec
            // Only set content if it was explicitly provided alongside tool_calls (uncommon)
            formattedChoice.message.content = choice.message.content !== undefined ? choice.message.content : null;
            // Ensure finish_reason reflects tool usage if not already set
            if (formattedChoice.finish_reason !== 'tool_calls' && formattedChoice.finish_reason !== 'length' && formattedChoice.finish_reason !== 'error'){
                 console.log(`[DEBUG] Setting finish_reason to 'tool_calls' for choice ${formattedChoice.index}`);
                 formattedChoice.finish_reason = 'tool_calls';
            }
        } else {
            // If no tool_calls, ensure content exists (default to empty string if null/undefined)
            formattedChoice.message.content = (choice.message.content === undefined || choice.message.content === null) ? '' : choice.message.content;
        }
        
        console.log(`[DEBUG] Processed choice ${formattedChoice.index}: content='${String(formattedChoice.message.content).substring(0,30)}...', tool_calls=${hasToolCalls}, finish_reason=${formattedChoice.finish_reason}`);
        return formattedChoice;
      });
    }

    console.log(`[DEBUG] Final formatted response (Formatter V2): ${JSON.stringify(formattedResponse).substring(0, 200)}...`);
    return formattedResponse;
  } catch (error) {
    console.error(`[ERROR] Error during response formatting (Formatter V2): ${error.message}`, error.stack);
    // Fallback to error formatter if anything goes wrong during formatting
    return formatErrorResponseForN8n({
      message: `Internal Server Error during response formatting: ${error.message}`,
      code: 500
    }, requestData);
  }
}

/**
 * Formats an error response to ensure it's compatible with n8n's AI Agent node
 * @param {Object} error - The error object (should have message, optionally code, data)
 * @param {Object} requestData - The original request data
 * @returns {Object} - A properly formatted error response for n8n
 */
function formatErrorResponseForN8n(error, requestData = {}) {
  console.log(`[DEBUG] Formatting error response for n8n compatibility: ${JSON.stringify(error)}`);
  
  // Ensure error is an object
  if (typeof error !== 'object' || error === null) {
      error = { message: String(error) }; 
  }
  
  const errorMessage = error.message || 'Unknown processing error';
  // Ensure status is a valid HTTP status code, default to 500
  const errorStatus = (typeof error.status === 'number' && error.status >= 400 && error.status <= 599) 
                      ? error.status 
                      : (typeof error.code === 'number' && error.code >= 400 && error.code <= 599 ? error.code : 500);
  const errorType = error.type || 'server_error';
  const errorData = error.data || error.metadata || null; // Accept 'data' or 'metadata'

  // Create a response that's compatible with n8n's AI Agent node and LangChain
  // Critical part: choices[0].message.content must exist, even for errors.
  const errorResponse = {
    id: `error-${Date.now()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: requestData.model || 'error_model',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          // Provide a clear error message in the content field
          content: `Error processing request: ${errorMessage}` 
        },
        finish_reason: 'error'
      }
    ],
    usage: {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0
    },
    // Include a structured error field as well
    error: {
      message: errorMessage,
      type: errorType,
      code: errorStatus,
      ...(errorData ? { data: errorData } : {}) // Use 'data' consistently here
    }
  };

  console.log(`[DEBUG] Formatted error response: ${JSON.stringify(errorResponse).substring(0, 200)}...`);
  return errorResponse;
}

module.exports = {
  formatResponseForN8n,
  formatErrorResponseForN8n
};
