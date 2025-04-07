# OpenRouter API Key Aggregator

A service that manages multiple OpenRouter API keys to bypass the 200 requests per day limit by distributing requests across multiple keys. Works with all models available on OpenRouter.

## Features

- Manages multiple OpenRouter API keys
- Tracks usage for each key
- Automatically rotates keys based on usage limits
- Respects OpenRouter rate limits (200 requests/day, 20 requests/minute, 5 seconds between requests)
- Provides a status endpoint to monitor key usage
- Supports API key authentication for clients
- Optional basic authentication for admin access

## Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file with your OpenRouter API keys:
   ```
   OPENROUTER_API_KEYS=key1,key2,key3
   PORT=3000
   AUTH_ENABLED=false
   AUTH_USERNAME=admin
   AUTH_PASSWORD=password
   OPENROUTER_API_URL=https://openrouter.ai/api/v1
   ```

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
