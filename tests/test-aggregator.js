/**
 * Test script to call OpenRouter Key Aggregator
 * 
 * This script tests the chatInput format with our OpenRouter Key Aggregator.
 */
const axios = require('axios');

// OpenRouter Key Aggregator API key (replace with your actual key)
const AGGREGATOR_API_KEY = '51fa83450b6f92dd3606cad17d261d3d';
const AGGREGATOR_URL = 'https://openrouter-key-aggregator.onrender.com/api';

// Test with standard format
async function testStandardFormat() {
  console.log('Testing standard format with OpenRouter Key Aggregator...');
  
  try {
    const response = await axios({
      method: 'POST',
      url: `${AGGREGATOR_URL}/v1/chat/completions`,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': AGGREGATOR_API_KEY
      },
      data: {
        model: 'deepseek/deepseek-chat-v3-0324:free',
        messages: [
          {
            role: 'user',
            content: 'Hello, how are you?'
          }
        ]
      }
    });
    
    console.log('Response status:', response.status);
    console.log('Response data structure:', Object.keys(response.data));
    console.log('Response data:', JSON.stringify(response.data, null, 2));
    
    return response.data;
  } catch (error) {
    console.error('Error calling Aggregator directly:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

// Test with n8n chatInput format
async function testN8nFormat() {
  console.log('\nTesting n8n chatInput format with OpenRouter Key Aggregator...');
  
  try {
    const response = await axios({
      method: 'POST',
      url: `${AGGREGATOR_URL}/chatInput`,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': AGGREGATOR_API_KEY
      },
      data: [
        {
          "sessionId": "959e177ee7ec4da88dc64b186d031821",
          "action": "sendMessage",
          "chatInput": "Hello, how are you?"
        }
      ]
    });
    
    console.log('Response status:', response.status);
    console.log('Response data structure:', Object.keys(response.data));
    console.log('Response data:', JSON.stringify(response.data, null, 2));
    
    return response.data;
  } catch (error) {
    console.error('Error calling Aggregator with n8n format:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

// Run the tests
async function runTests() {
  try {
    const standardResult = await testStandardFormat();
    const n8nResult = await testN8nFormat();
    
    console.log('\nComparison:');
    
    // Check if the standard response has the expected structure
    const hasChoices = !!standardResult.choices;
    const hasContent = standardResult.choices?.[0]?.message?.content;
    
    console.log('Standard format has choices:', hasChoices);
    console.log('Standard format has content:', !!hasContent);
    
    // Check if the n8n response has the expected structure
    const isArray = Array.isArray(n8nResult);
    const hasGenerations = !!n8nResult[0]?.response?.generations;
    const hasText = !!n8nResult[0]?.response?.generations?.[0]?.[0]?.text;
    
    console.log('n8n format is array:', isArray);
    console.log('n8n format has generations:', hasGenerations);
    console.log('n8n format has text:', hasText);
    
    console.log('\nBoth responses have the expected structure:', hasChoices && hasContent && isArray && hasGenerations && hasText);
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

runTests();
