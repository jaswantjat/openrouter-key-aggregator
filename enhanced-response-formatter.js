/**
 * Enhanced Response Formatter for n8n OpenRouter Integration
 * 
 * This function node provides robust error handling and response normalization
 * to fix the "Cannot read properties of undefined (reading 'content')" error
 * in n8n's AI Agent node when using OpenRouter.
 */

// Input from the OpenAI Chat Model node
const input = items[0].json;

// Log the input for debugging
console.log("Input to enhanced formatter:", JSON.stringify(input).substring(0, 500));

try {
  // Handle different nesting structures
  let inputToProcess = input;

  // Check if the response is nested under a 'data' property
  if (!input.choices && input.data && input.data.choices) {
    inputToProcess = input.data;
    console.log("Found nested data structure, using input.data");
  }

  // Handle JSON parsing for content if it's a string that looks like JSON
  const parseJsonContent = (content) => {
    if (typeof content !== 'string') return content;
    
    try {
      // Check if content looks like JSON
      if ((content.startsWith('{') && content.endsWith('}')) || 
          (content.startsWith('[') && content.endsWith(']'))) {
        return JSON.parse(content);
      }
      return content;
    } catch (error) {
      console.log("Failed to parse JSON content:", error.message);
      return content;
    }
  };

  // Create a properly formatted response that n8n can process
  let formattedResponse = {
    id: inputToProcess.id || `chatcmpl-${Date.now()}`,
    object: inputToProcess.object || 'chat.completion',
    created: inputToProcess.created || Math.floor(Date.now() / 1000),
    model: inputToProcess.model || 'unknown',
    choices: []
  };

  // Handle the case where choices might be missing or malformed
  if (!inputToProcess.choices || !Array.isArray(inputToProcess.choices) || inputToProcess.choices.length === 0) {
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
    formattedResponse.choices = inputToProcess.choices.map((choice, index) => {
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
        // Handle array content (some models return content as an array)
        let content = choice.message.content;
        
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
        
        // Parse JSON content if needed
        content = parseJsonContent(content);
        
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
  formattedResponse.usage = inputToProcess.usage || {
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0
  };

  // Add debug information
  formattedResponse._debug = {
    timestamp: new Date().toISOString(),
    formatter: 'enhanced-response-formatter',
    originalStructure: Object.keys(input).join(',')
  };

  // Log the formatted response for debugging
  console.log("Enhanced formatted response:", JSON.stringify(formattedResponse).substring(0, 500));

  // Return the formatted response
  return [{
    json: formattedResponse
  }];
} catch (error) {
  console.error("Error in enhanced formatter:", error.message);
  
  // Return a fallback response
  return [{
    json: {
      id: `error-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: 'error',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: `Error formatting response: ${error.message}`
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
        message: error.message,
        stack: error.stack
      }
    }
  }];
}
