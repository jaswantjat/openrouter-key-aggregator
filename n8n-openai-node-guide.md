# n8n OpenAI Node Integration Guide for OpenRouter Key Aggregator

This guide provides detailed instructions for integrating the OpenRouter Key Aggregator with n8n's OpenAI node, addressing common authentication issues and providing best practices.

## Common Authentication Issues

The "No auth credentials found" error typically occurs due to one of the following reasons:

1. **Header Case Sensitivity**: n8n may send headers with different casing than expected (e.g., `Authorization` vs `authorization`)
2. **Base URL Configuration**: The base URL in n8n needs to be configured correctly without the `/v1` suffix
3. **Authentication Method**: n8n uses different authentication methods depending on configuration

## OpenAI Node Configuration

### Step 1: Create OpenAI API Credentials in n8n

1. In n8n, go to **Settings** > **Credentials** > **New Credential**
2. Search for and select **OpenAI API**
3. Configure the credential with these exact settings:
   - **Credential Name**: OpenRouter Key Aggregator
   - **API Key**: `51fa83450b6f92dd3606cad17d261d3d`
   - **Base URL**: `https://openrouter-key-aggregator.onrender.com/api` (important: use this exact URL)
   - **Organization ID**: Leave blank

4. Save the credential

### Step 2: Configure the OpenAI Chat Model Node

1. Add an **OpenAI Chat Model** node to your workflow
2. In the node settings:
   - **Connection**: Select the OpenRouter Key Aggregator credential you created
   - **Operation**: Chat Completion
   - **Model**: Select one of the available models:
     - `deepseek` (for deepseek/deepseek-chat-v3-0324:free)
     - `llama-4-maverick` (for meta-llama/llama-4-maverick:free)
     - `llama-4-scout` (for meta-llama/llama-4-scout:free)
   - **Messages**: Configure your messages as needed

3. Save the node

## Troubleshooting Authentication Issues

If you encounter the "No auth credentials found" error, try these solutions:

### Solution 1: Check Base URL Format

Make sure the Base URL in your OpenAI API credential is exactly:
```
https://openrouter-key-aggregator.onrender.com/api
```

Do not add `/v1` or any other path at the end.

### Solution 2: Recreate the Credential

Sometimes recreating the credential can resolve authentication issues:

1. Delete the existing OpenAI API credential
2. Create a new credential following the steps above
3. Reconnect the OpenAI Chat Model node to the new credential

### Solution 3: Use HTTP Request Node Instead

If the OpenAI node still doesn't work, use an HTTP Request node:

1. Add an **HTTP Request** node to your workflow
2. Configure it as follows:
   - **Method**: POST
   - **URL**: `https://openrouter-key-aggregator.onrender.com/api/v1/chat/completions`
   - **Authentication**: None
   - **Headers**:
     ```
     Content-Type: application/json
     Authorization: Bearer 51fa83450b6f92dd3606cad17d261d3d
     ```
   - **Body** (JSON):
     ```json
     {
       "model": "deepseek/deepseek-chat-v3-0324:free",
       "messages": [
         {
           "role": "user",
           "content": "{{$json.input}}"
         }
       ]
     }
     ```

### Solution 4: Check for CORS Issues

If you're using n8n Cloud, you might encounter CORS issues. Try using a self-hosted n8n instance if possible.

## Example Workflow

Here's a complete example workflow for using the OpenRouter Key Aggregator with n8n's OpenAI node:

1. **Manual Trigger Node**: Starts the workflow

2. **Set Node**: Prepares the input
   ```json
   {
     "input": "Hello, how are you?"
   }
   ```

3. **OpenAI Chat Model Node**: Generates the response
   - **Connection**: OpenRouter Key Aggregator
   - **Operation**: Chat Completion
   - **Model**: deepseek
   - **Messages**:
     - Role: User
     - Content: {{$json.input}}

4. **Set Node**: Formats the output
   ```json
   {
     "response": "{{$json.response}}"
   }
   ```

## Understanding OpenAI API Concepts

As per the OpenAI documentation, here are key concepts to understand:

1. **Text Generation Models**: The OpenRouter Key Aggregator provides access to models like deepseek and llama-4, which are text generation models similar to GPT-4 and GPT-3.5.

2. **Tokens**: Text is processed in chunks called tokens. As a rule of thumb, 1 token is approximately 4 characters or 0.75 words for English text.

3. **Context Length**: Each model has a maximum context length, which limits the combined length of the prompt and the generated output.

4. **Authentication**: The OpenAI API uses Bearer token authentication, which is what the OpenRouter Key Aggregator is configured to accept.

## Best Practices

1. **Use Simplified Model Names**: When possible, use the simplified model names (`deepseek`, `llama-4-maverick`, `llama-4-scout`) for better compatibility.

2. **Monitor Token Usage**: Be aware of the token limits for the models you're using to avoid errors.

3. **Handle Errors Gracefully**: Add error handling nodes to your workflow to handle potential API errors.

4. **Test with Simple Prompts**: When troubleshooting, use simple prompts to isolate issues.

## Technical Details

The OpenRouter Key Aggregator has been updated to handle n8n's authentication patterns:

1. **Case-Insensitive Header Checking**: Headers are now checked in a case-insensitive manner to handle variations in how n8n sends authentication headers
2. **Multiple Authentication Methods**: Support for Bearer token, api-key, and openai-api-key headers to accommodate different n8n configurations
3. **Path Handling**: Special handling for different base URL configurations, including when the base URL includes or excludes the `/v1` suffix
4. **Error Formatting**: Error responses match OpenAI's format exactly to ensure proper error handling in n8n

By following this guide, you should be able to successfully integrate the OpenRouter Key Aggregator with n8n's OpenAI node.
