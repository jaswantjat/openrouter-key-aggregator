/**
 * Test script to call OpenRouter API directly
 * 
 * This script tests the chatInput format with OpenRouter's API directly.
 */
const axios = require('axios');

// OpenRouter API key (replace with your actual key)
const OPENROUTER_API_KEY = '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';

// Test with standard format
async function testStandardFormat() {
  console.log('Testing standard format with OpenRouter directly...');
  
  try {
    const response = await axios({
      method: 'POST',
      url: 'https://openrouter.ai/api/v1/chat/completions',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://openrouter-key-aggregator.onrender.com',
        'X-Title': 'OpenRouter Key Aggregator Test'
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
    console.error('Error calling OpenRouter directly:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

// Test with n8n chatInput format
async function testN8nFormat() {
  console.log('\nTesting n8n chatInput format with OpenRouter directly...');
  
  try {
    const response = await axios({
      method: 'POST',
      url: 'https://openrouter.ai/api/v1/chat/completions',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://openrouter-key-aggregator.onrender.com',
        'X-Title': 'OpenRouter Key Aggregator Test'
      },
      data: {
        model: 'deepseek/deepseek-chat-v3-0324:free',
        messages: [
          {
            role: 'user',
            content: JSON.stringify([
              {
                "sessionId": "959e177ee7ec4da88dc64b186d031821",
                "action": "sendMessage",
                "chatInput": "Hello, how are you?"
              }
            ])
          }
        ]
      }
    });
    
    console.log('Response status:', response.status);
    console.log('Response data structure:', Object.keys(response.data));
    console.log('Response data:', JSON.stringify(response.data, null, 2));
    
    return response.data;
  } catch (error) {
    console.error('Error calling OpenRouter with n8n format:', error.message);
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
    console.log('Standard format response structure:', Object.keys(standardResult));
    console.log('n8n format response structure:', Object.keys(n8nResult));
    
    // Check if the responses have the same structure
    const standardKeys = Object.keys(standardResult).sort().join(',');
    const n8nKeys = Object.keys(n8nResult).sort().join(',');
    
    console.log('\nDo responses have the same structure?', standardKeys === n8nKeys);
    
    // Check if both responses have choices with content
    const standardContent = standardResult.choices?.[0]?.message?.content;
    const n8nContent = n8nResult.choices?.[0]?.message?.content;
    
    console.log('Standard format has content:', !!standardContent);
    console.log('n8n format has content:', !!n8nContent);
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

runTests();
