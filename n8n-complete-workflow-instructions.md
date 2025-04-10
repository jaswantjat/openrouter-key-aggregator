# Complete n8n Workflow to Fix "Cannot read properties of undefined (reading 'content')" Error

This guide provides step-by-step instructions to create a complete n8n workflow that resolves the "Cannot read properties of undefined (reading 'content')" error when using the OpenRouter Key Aggregator with n8n's AI Agent node.

## Workflow Overview

The complete workflow consists of:

1. **Manual Input Node** → Provides the initial input
2. **Format Input Function Node** → Formats the input for the OpenAI Chat Model
3. **OpenAI Chat Model Node** → Makes the request to the OpenRouter Key Aggregator
4. **Format Response Function Node** → Ensures the response is properly formatted
5. **AI Agent Node** → Processes the formatted response

## Step 1: Create the Manual Input Node

1. Add a **Manual Trigger** node to your workflow
2. Configure it with a parameter named `userInput` with a default value (e.g., "What is the capital of France?")

## Step 2: Add the Format Input Function Node

1. Add a **Function** node after the Manual Input node
2. Name it "Format Input"
3. Add the following code:

```javascript
// Input from previous node
const userInput = items[0].json.userInput || "Hello";

// Format for the OpenAI Chat Model
return [{
  json: {
    model: "deepseek/deepseek-chat-v3-0324:free", // Use one of the supported free models
    messages: [
      {
        role: "user",
        content: userInput
      }
    ]
  }
}];
```

## Step 3: Add the OpenAI Chat Model Node

1. Add an **OpenAI Chat Model** node after the Format Input node
2. Configure it with your OpenRouter Key Aggregator credentials:
   - **Connection**: Select your OpenRouter Key Aggregator credentials
   - **Model**: Select or enter `deepseek/deepseek-chat-v3-0324:free`
   - **Options**: Leave as default or configure as needed

## Step 4: Add the Format Response Function Node

1. Add a **Function** node after the OpenAI Chat Model node
2. Name it "Format Response"
3. Add the following code:

```javascript
// Input from the OpenAI Chat Model node
const input = items[0].json;

// Create a properly formatted response that n8n can process
let formattedResponse = {
  id: input.id || `chatcmpl-${Date.now()}`,
  object: input.object || 'chat.completion',
  created: input.created || Math.floor(Date.now() / 1000),
  model: input.model || 'unknown',
  choices: []
};

// Handle the case where choices might be missing or malformed
if (!input.choices || !Array.isArray(input.choices) || input.choices.length === 0) {
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
  formattedResponse.choices = input.choices.map((choice, index) => {
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
formattedResponse.usage = input.usage || {
  prompt_tokens: 0,
  completion_tokens: 0,
  total_tokens: 0
};

// Return the formatted response
return [{
  json: formattedResponse
}];
```

## Step 5: Add the AI Agent Node

1. Add an **AI Agent** node after the Format Response node
2. Configure it according to your needs

## Step 6: Connect the Nodes

Connect the nodes in the following order:
1. Manual Input → Format Input
2. Format Input → OpenAI Chat Model
3. OpenAI Chat Model → Format Response
4. Format Response → AI Agent

## Step 7: Test the Workflow

1. Save the workflow
2. Run the workflow by clicking the "Execute Workflow" button
3. Check the output of each node to ensure it's working correctly

## Troubleshooting

If you're still encountering issues:

1. Check the logs of each node to see where the error is occurring
2. Verify that your API key is valid and has sufficient credits
3. Make sure you're using the correct base URL and model ID
4. Try using a different model to see if the issue is specific to one model
