/**
 * Test script for streaming support in OpenRouter Key Aggregator
 * 
 * This script tests the streaming support by making a request to the OpenRouter Key Aggregator
 * with stream: true and logging the response.
 */

const axios = require('axios');

// Configuration
const config = {
  // Replace with your actual OpenRouter Key Aggregator URL
  baseUrl: 'https://openrouter-key-aggregator.onrender.com',
  // Replace with your API key
  apiKey: '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',
  // Model to test
  model: 'deepseek/deepseek-chat-v3-0324:free'
};

/**
 * Test streaming with the OpenRouter Key Aggregator
 */
async function testStreaming() {
  console.log('Testing streaming support...');
  
  try {
    // Make a streaming request to the OpenRouter Key Aggregator
    const response = await axios({
      method: 'POST',
      url: `${config.baseUrl}/api/v1/chat/completions`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      data: {
        model: config.model,
        messages: [
          { role: 'system', content: 'You are a helpful assistant' },
          { role: 'user', content: 'Hello, how are you?' }
        ],
        stream: true
      },
      responseType: 'stream'
    });
    
    console.log('Streaming response received');
    
    // Process the streaming response
    let chunks = [];
    
    response.data.on('data', (chunk) => {
      const chunkStr = chunk.toString();
      chunks.push(chunkStr);
      console.log(`Received chunk: ${chunkStr}`);
    });
    
    response.data.on('end', () => {
      console.log('Streaming response completed');
      console.log('Total chunks received:', chunks.length);
    });
    
    response.data.on('error', (error) => {
      console.error('Streaming error:', error.message);
    });
  } catch (error) {
    console.error('Error testing streaming:');
    console.error(`- Status: ${error.response?.status || 'No status'}`);
    console.error(`- Message: ${error.message}`);
    
    if (error.response?.data) {
      console.error('- Response data:', error.response.data);
    }
  }
}

// Run the test
testStreaming();
