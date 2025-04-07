/**
 * Example client for the OpenRouter API Key Aggregator
 *
 * This example shows how to use the OpenRouter API Key Aggregator
 * with different models from various providers.
 */

// Replace with your actual API Key Aggregator URL
const API_URL = 'https://your-service.onrender.com/api';

// Optional: Authentication credentials (if enabled)
const AUTH_USERNAME = 'admin';
const AUTH_PASSWORD = 'password';

// Helper function to make API calls
async function callAPI(model, prompt) {
  // Create authorization header if authentication is enabled
  const headers = {
    'Content-Type': 'application/json'
  };

  if (AUTH_USERNAME && AUTH_PASSWORD) {
    const auth = Buffer.from(`${AUTH_USERNAME}:${AUTH_PASSWORD}`).toString('base64');
    headers['Authorization'] = `Basic ${auth}`;
  }

  // Add OpenRouter-specific headers
  headers['HTTP-Referer'] = 'https://example.com';
  headers['X-Title'] = 'API Key Aggregator Example';

  try {
    const response = await fetch(`${API_URL}/proxy/chat/completions`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'user', content: prompt }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`API Error: ${JSON.stringify(errorData)}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error calling API:', error);
    throw error;
  }
}

// Example usage with different models
async function runExamples() {
  console.log('OpenRouter API Key Aggregator - Client Examples');
  console.log('=============================================');

  try {
    // Example 1: Llama 4 Maverick (Free)
    console.log('\n1. Llama 4 Maverick (Free)');
    console.log('------------------------');
    const llama4Response = await callAPI(
      'meta-llama/llama-4-maverick:free',
      'Explain quantum computing in simple terms'
    );
    console.log('Response:', llama4Response.choices[0].message.content);

    // Example 2: Gemini 2.5 Pro Exp (Free)
    console.log('\n2. Gemini 2.5 Pro Exp (Free)');
    console.log('------------------------');
    const geminiResponse = await callAPI(
      'google/gemini-2.5-pro-exp-03-25:free',
      'What are the benefits of renewable energy?'
    );
    console.log('Response:', geminiResponse.choices[0].message.content);

    // Example 3: Anthropic Claude 3.5 Sonnet
    console.log('\n3. Anthropic Claude 3.5 Sonnet');
    console.log('-----------------------------');
    const claudeResponse = await callAPI(
      'anthropic/claude-3-5-sonnet',
      'Write a short poem about artificial intelligence'
    );
    console.log('Response:', claudeResponse.choices[0].message.content);

    // Example 3: OpenAI GPT-4o
    console.log('\n3. OpenAI GPT-4o');
    console.log('----------------');
    const gptResponse = await callAPI(
      'openai/gpt-4o',
      'Give me 3 creative ideas for a mobile app'
    );
    console.log('Response:', gptResponse.choices[0].message.content);

  } catch (error) {
    console.error('Failed to run examples:', error);
  }
}

// Run the examples
runExamples();
