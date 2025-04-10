# n8n OpenRouter Integration Fix

This repository contains solutions for fixing the "Cannot read properties of undefined (reading 'content')" error when using OpenRouter with n8n's AI Agent node.

## Problem

When using the OpenRouter Key Aggregator with n8n's AI Agent node, you may encounter the error "Cannot read properties of undefined (reading 'content')". This error occurs when the ToolCallingAgentOutputParser in n8n's AI Agent node tries to access a 'content' property that doesn't exist in the response.

## Solutions

This repository provides several solutions to fix this issue:

1. **Use the Dedicated chatInput Format** (Recommended): Use a Function node to format your input with the chatInput format.
2. **Add a Response Formatter Function Node**: Add a Function node after the OpenAI Chat Model node to ensure the response is properly formatted.
3. **Complete Workflow with Both Input and Response Formatting**: Implement a complete workflow with both input and response formatting.

## Files

- `n8n-chatinput-function.js`: Function node code for formatting input with the chatInput format
- `n8n-openai-credentials-config.md`: Configuration settings for OpenAI credentials in n8n
- `n8n-response-formatter-function.js`: Function node code for formatting the response
- `n8n-complete-workflow-instructions.md`: Step-by-step instructions for creating a complete workflow
- `n8n-debugging-guide.md`: Advanced debugging techniques
- `n8n-solution-summary.md`: Summary of all solutions

## Usage

1. Choose the solution that best fits your needs
2. Copy the code from the corresponding file
3. Implement the solution in your n8n workflow
4. Test the workflow to ensure it works correctly

## Additional Resources

- [n8n Documentation](https://docs.n8n.io/)
- [OpenRouter Documentation](https://openrouter.ai/docs)
- [LangChain Documentation](https://js.langchain.com/docs/)

## License

MIT
