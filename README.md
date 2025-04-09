# OpenRouter API Key Aggregator

A service that manages multiple OpenRouter API keys to bypass the 200 requests per day limit by distributing requests across multiple keys. Works with all models available on OpenRouter, including free models like Llama 4 Maverick, Llama 4 Scout, Gemini 2.5 Pro Exp, DeepSeek Chat v3, and Gemini 2.0 Flash Exp.

## Features

- Manages multiple OpenRouter API keys
- Tracks usage for each key
- Automatically rotates keys based on usage limits
- Respects OpenRouter rate limits (200 requests/day, 20 requests/minute, 5 seconds between requests)
- Provides a status endpoint to monitor key usage
- Supports API key authentication for clients
- Optional basic authentication for admin access
- Compatible with OpenAI SDK (supports both `/api/proxy/...` and `/api/v1/...` endpoints)
- Robust n8n integration with fixes for common errors

## Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Copy the `.env.example` file to `.env` and add your OpenRouter API keys:
   ```
   cp .env.example .env
   ```

4. Edit the `.env` file and replace `your-openrouter-api-key-here` with your actual OpenRouter API key(s):
   ```
   # Get your API keys from https://openrouter.ai/keys
   OPENROUTER_API_KEYS=sk-or-v1-your-key-here,sk-or-v1-another-key-here
   ```

   You can add multiple keys separated by commas. The service will rotate between them to maximize your daily request limit.

## Usage

### Start the server

```
npm start
```

For development with auto-reload:
```
npm run dev
```

### Client Examples

Check the `examples` directory for client examples in JavaScript and Python:

- `client.js` - JavaScript example using fetch
- `client.py` - Python example using requests
- `openai_sdk_client.py` - Python example using the OpenAI SDK

### API Endpoints

#### Proxy Endpoint

```
POST /api/proxy/chat/completions
```

The request body format is identical to OpenRouter's API. Example:

```json
{
  "model": "anthropic/claude-3-opus:beta",
  "messages": [
    { "role": "user", "content": "Hello, how are you?" }
  ]
}
```

You can use any model available on OpenRouter by changing the `model` parameter. Examples:

```json
// Google Gemini 2.5 Pro
{
  "model": "google/gemini-2.5-pro-preview-03-25",
  "messages": [
    { "role": "user", "content": "Hello, how are you?" }
  ]
}

// Anthropic Claude 3.5 Sonnet
{
  "model": "anthropic/claude-3-5-sonnet",
  "messages": [
    { "role": "user", "content": "Hello, how are you?" }
  ]
}

// OpenAI GPT-4o
{
  "model": "openai/gpt-4o",
  "messages": [
    { "role": "user", "content": "Hello, how are you?" }
  ]
}
```

#### Status Endpoint

```
GET /api/status
```

Returns the current status of all API keys, including usage statistics.

### Authentication

#### API Key Authentication (Recommended for Clients)

To enable API key authentication for clients, set the following environment variable:

```
API_KEY_AUTH_ENABLED=true
```

Then generate API keys using the admin API:

```bash
# Generate a new API key
curl -X POST https://your-service.onrender.com/api/keys \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic $(echo -n admin:password | base64)" \
  -d '{"name": "Client App 1", "rateLimit": 100}'

# List all API keys
curl https://your-service.onrender.com/api/keys \
  -H "Authorization: Basic $(echo -n admin:password | base64)"
```

Clients can then use the API key in their requests:

```
# As a header
X-API-Key: your_api_key

# Or as a query parameter
?api_key=your_api_key
```

### Using with OpenAI SDK

You can use the OpenAI SDK with this service by setting the base URL to your service URL. The configuration depends on which tool you're using:

#### For Python OpenAI SDK

```python
from openai import OpenAI

client = OpenAI(
  # For direct Python OpenAI SDK usage:
  base_url="https://your-service.onrender.com/api/v1",  # Include /api/v1 in the base URL

  # Your API key from the admin dashboard
  api_key="your_api_key",

  # Optional: You can also set the API key in the headers
  default_headers={
    "X-API-Key": "your_api_key"  # Same as above
  }
)

# Example using a free model
completion = client.chat.completions.create(
  model="meta-llama/llama-4-maverick:free",  # Free model
  messages=[
    {"role": "user", "content": "Hello, how are you?"}
  ]
)

print(completion.choices[0].message.content)
```

#### For JavaScript OpenAI SDK

```javascript
import OpenAI from 'openai';

const openai = new OpenAI({
  baseURL: 'https://your-service.onrender.com/api/v1', // Include /api/v1 in the base URL
  apiKey: 'your_api_key',
  defaultHeaders: {
    'X-API-Key': 'your_api_key'
  }
});

const completion = await openai.chat.completions.create({
  model: 'meta-llama/llama-4-maverick:free',
  messages: [
    { role: 'user', content: 'Hello, how are you?' }
  ]
});

console.log(completion.choices[0].message.content);
```

#### Available Free Models

You can use any of these free models:
```
meta-llama/llama-4-maverick:free
meta-llama/llama-4-scout:free
google/gemini-2.5-pro-exp-03-25:free
deepseek/deepseek-chat-v3-0324:free
google/gemini-2.0-flash-exp:free
```

### Using with n8n

When configuring OpenAI credentials in n8n, you need to use specific settings to ensure compatibility:

#### Method 1: Using the Base URL without any path (Recommended)

1. **API Key**: Your API key generated from the admin dashboard (e.g., `51fa83450b6f92dd3606cad17d261d3d`)
2. **Base URL**: `https://your-service.onrender.com` (without any path)
3. **Organization ID**: Leave blank
4. **Custom Headers**: Add the following custom headers:
   ```json
   {
     "x-api-key": "YOUR_API_KEY_HERE"
   }
   ```

#### Method 2: Using the Base URL with /api prefix

1. **API Key**: Your API key generated from the admin dashboard (e.g., `51fa83450b6f92dd3606cad17d261d3d`)
2. **Base URL**: `https://your-service.onrender.com/api` (include the `/api` prefix)
3. **Organization ID**: Leave blank
4. **Custom Headers**: Add the following custom headers:
   ```json
   {
     "x-api-key": "YOUR_API_KEY_HERE"
   }
   ```

#### Method 3: Using the Base URL with /v1/chat/completions (Not Recommended)

This method is not recommended but will work with our latest update:

1. **API Key**: Your API key generated from the admin dashboard (e.g., `51fa83450b6f92dd3606cad17d261d3d`)
2. **Base URL**: `https://your-service.onrender.com/v1/chat/completions`
3. **Organization ID**: Leave blank
4. **Custom Headers**: Add the following custom headers:
   ```json
   {
     "x-api-key": "YOUR_API_KEY_HERE"
   }
   ```

#### Method 4: Using LangChain Configuration

If you're using LangChain directly (not through n8n), you can configure it like this:

```javascript
import { ChatOpenAI } from "@langchain/openai";

const llm = new ChatOpenAI({
  temperature: 0.9,
  streamUsage: false, // Important for compatibility with some proxies
  configuration: {
    baseURL: "https://your-service.onrender.com", // No path needed
    defaultHeaders: {
      "x-api-key": "YOUR_API_KEY_HERE"
    }
  }
});

await llm.invoke("Hi there!");
```

#### Troubleshooting "Models not found" in n8n

If you're seeing a "models not found" error in n8n, try these solutions:

1. **Use the correct base URL**: Make sure you're using `https://your-service.onrender.com` as the base URL (without any path).

2. **Add custom headers**: In your n8n OpenAI credentials, add these custom headers:
   ```json
   {
     "x-api-key": "YOUR_API_KEY_HERE"
   }
   ```

3. **Try simplified model names**: Our service supports both full model IDs and simplified names:
   - `meta-llama/llama-4-scout:free` or just `llama-4-scout`
   - `google/gemini-2.0-flash-exp:free` or just `gemini-2.0-flash-exp`

4. **Check your OpenRouter API key**: Make sure you've added at least one valid OpenRouter API key to your `.env` file. The key should start with `sk-or-v1-`.

5. **Verify your client API key**: Make sure the API key you're using in n8n is correctly configured and active in your service.

6. **Test the endpoints directly**: Use curl to test the endpoints directly:
   ```bash
   # Test the models endpoint
   curl -X GET https://your-service.onrender.com/v1/models \
     -H "x-api-key: YOUR_API_KEY_HERE"

   # Test the chat completions endpoint
   curl -X POST https://your-service.onrender.com/v1/chat/completions \
     -H "Content-Type: application/json" \
     -H "x-api-key: YOUR_API_KEY_HERE" \
     -d '{
       "model": "llama-4-scout",
       "messages": [
         {
           "role": "user",
           "content": "What is the capital of Italy?"
         }
       ]
     }'
   ```

7. **Restart your service**: Sometimes a simple restart of your service can fix the issue.

8. **Check n8n logs**: Look at the n8n logs to see what URL it's trying to access and what errors it's encountering.

### n8n Integration

The OpenRouter Key Aggregator is fully compatible with n8n's AI nodes. For detailed integration instructions, see the following guides:

- [n8n Integration Guide](docs/n8n-integration-guide.md) - General guide for integrating with n8n
- [Fixing "Cannot read properties of undefined (reading 'content')" Error](docs/n8n-content-error-fix.md) - Specific guide for fixing the common content error

Example workflows:
- [Basic n8n Workflow](examples/n8n-deepseek-workflow.json) - Simple workflow for using the OpenRouter Key Aggregator with n8n
- [Content Error Fix Workflow](examples/n8n-content-error-fix-workflow.json) - Workflow that demonstrates how to fix the content error

#### Basic Authentication (For Admin Access)

To enable basic authentication for admin access, set the following environment variables:

```
AUTH_ENABLED=true
AUTH_USERNAME=your_username
AUTH_PASSWORD=your_password
```

Then include the Authorization header in your admin requests:

```
Authorization: Basic base64(username:password)
```

## Deployment

### Render

1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Set the build command: `npm install`
4. Set the start command: `npm start`
5. Add environment variables in the Render dashboard

## License

MIT
