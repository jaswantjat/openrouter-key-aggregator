/**
 * Example client for the OpenRouter API Key Aggregator using API Key authentication
 * 
 * This example shows how to use the OpenRouter API Key Aggregator
 * with API key authentication.
 */

// Replace with your actual API Key Aggregator URL
const API_URL = 'https://your-service.onrender.com/api';

// Replace with your actual API key
const API_KEY = 'your_api_key_here';

// Helper function to make API calls
async function callAPI(model, prompt) {
  // Create headers with API key
  const headers = {
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY,
    'HTTP-Referer': 'https://example.com',
    'X-Title': 'API Key Aggregator Example'
  };
  
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
  console.log('OpenRouter API Key Aggregator - API Key Client Example');
  console.log('===================================================');
  
  try {
    // Example: Google Gemini 2.5 Pro
    console.log('\nGoogle Gemini 2.5 Pro');
    console.log('---------------------');
    const geminiResponse = await callAPI(
      'google/gemini-2.5-pro-preview-03-25',
      'Explain quantum computing in simple terms'
    );
    console.log('Response:', geminiResponse.choices[0].message.content);
    
  } catch (error) {
    console.error('Failed to run examples:', error);
  }
}

// Run the examples
runExamples();
