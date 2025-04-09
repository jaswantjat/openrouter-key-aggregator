/**
 * Utility functions for formatting responses to ensure compatibility with n8n and other clients
 */

/**
 * Creates a properly formatted chat completion response
 * This ensures the response is compatible with n8n's AI Agent node
 *
 * @param {Object} options - Options for creating the response
 * @param {string} options.content - The content of the message
 * @param {string} options.model - The model used for the response
 * @param {string} options.role - The role of the message (default: 'assistant')
 * @param {string} options.finishReason - The reason the response was finished (default: 'stop')
 * @returns {Object} A properly formatted chat completion response
 */
function createChatCompletionResponse(options = {}) {
  const {
    content = '',
    model = 'unknown',
    role = 'assistant',
    finishReason = 'stop'
  } = options;

  // Ensure content is a string
  const safeContent = content === null || content === undefined ? '' : String(content);

  return {
    id: `chatcmpl-${Date.now()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: model,
    choices: [
      {
        index: 0,
        message: {
          role: role,
          content: safeContent
        },
        finish_reason: finishReason
      }
    ],
    usage: {
      prompt_tokens: 0,
      completion_tokens: safeContent.length / 4, // Rough estimate
      total_tokens: safeContent.length / 4
    }
  };
}

/**
 * Creates an error response that is still compatible with n8n's AI Agent node
 *
 * @param {Object} options - Options for creating the error response
 * @param {string} options.message - The error message
 * @param {number} options.status - The HTTP status code
 * @param {string} options.type - The error type
 * @returns {Object} A properly formatted error response
 */
function createErrorResponse(options = {}) {
  const {
    message = 'An error occurred',
    status = 500,
    type = 'server_error'
  } = options;

  // For n8n AI Agent node compatibility, we need to ensure the response has:
  // 1. A choices array with at least one element
  // 2. Each choice must have a message object
  // 3. Each message must have a content property (even for errors)
  // 4. The error details should be included but not interfere with the above structure

  // Create a response that exactly matches the OpenAI API format
  // This is critical for n8n compatibility
  return {
    id: `error-${Date.now()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: 'error',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: `Error: ${message}` // This is the critical part for n8n
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
      message: message,
      type: type,
      param: null,
      code: 'error',
      status: status
    }
  };
}

/**
 * Ensures a chat completion response has the correct structure
 * This is used to fix responses from OpenRouter that might be missing required fields
 *
 * @param {Object} response - The original response
 * @returns {Object} A properly formatted response
 */
function ensureValidChatCompletionResponse(response) {
  if (!response) {
    return createChatCompletionResponse({ content: 'No response received' });
  }

  // If it's already an error response with our format, return it
  if (response.error && response.choices && response.choices[0]?.message?.content) {
    return response;
  }

  // If it's an error response without our format, convert it
  if (response.error) {
    // Handle OpenRouter's specific error format
    const errorMessage = response.error.message ||
                        (response.error.metadata ? `${response.error.code}: ${JSON.stringify(response.error.metadata)}` : 'Unknown error');

    return createErrorResponse({
      message: errorMessage,
      status: response.error.code || response.error.status || 500,
      type: response.error.type || 'server_error'
    });
  }

  // If there are no choices, create a default one
  if (!response.choices || !Array.isArray(response.choices) || response.choices.length === 0) {
    response.choices = [{
      index: 0,
      message: {
        role: 'assistant',
        content: 'No content provided'
      },
      finish_reason: 'stop'
    }];
  }

  // Ensure each choice has a valid message with content
  response.choices.forEach((choice, index) => {
    // If choice has no message, create one
    if (!choice.message) {
      choice.message = {
        role: 'assistant',
        content: ''
      };
    }

    // If message has null/undefined content, set to empty string
    if (choice.message.content === null || choice.message.content === undefined) {
      choice.message.content = '';
    }

    // If message has no role, set to assistant
    if (!choice.message.role) {
      choice.message.role = 'assistant';
    }

    // Ensure finish_reason exists
    if (!choice.finish_reason) {
      choice.finish_reason = 'stop';
    }

    // Handle array content (some models return content as an array)
    if (Array.isArray(choice.message.content)) {
      let textContent = '';
      choice.message.content.forEach(part => {
        if (typeof part === 'string') {
          textContent += part;
        } else if (part && part.type === 'text' && part.text) {
          textContent += part.text;
        }
      });
      choice.message.content = textContent;
    }
  });

  // Ensure other required fields exist
  if (!response.id) {
    response.id = `chatcmpl-${Date.now()}`;
  }

  if (!response.object) {
    response.object = 'chat.completion';
  }

  if (!response.created) {
    response.created = Math.floor(Date.now() / 1000);
  }

  if (!response.model) {
    response.model = 'unknown';
  }

  if (!response.usage) {
    response.usage = {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0
    };
  }

  return response;
}

module.exports = {
  createChatCompletionResponse,
  createErrorResponse,
  ensureValidChatCompletionResponse
};
