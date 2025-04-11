/**
 * Test script for n8n integration with OpenRouter Key Aggregator
 * 
 * This script tests various authentication methods to identify
 * which one works with n8n.
 */
const axios = require('axios');

// OpenRouter Key Aggregator API key
const AGGREGATOR_API_KEY = '51fa83450b6f92dd3606cad17d261d3d';
const AGGREGATOR_URL = 'https://openrouter-key-aggregator.onrender.com/api';

// Test with different authentication methods
async function testAuthMethods() {
  console.log('Testing different authentication methods...');
  
  const authMethods = [
    {
      name: 'X-API-Key header',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': AGGREGATOR_API_KEY
      }
    },
    {
      name: 'x-api-key header (lowercase)',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': AGGREGATOR_API_KEY
      }
    },
    {
      name: 'Authorization header with Bearer',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AGGREGATOR_API_KEY}`
      }
    },
    {
      name: 'Authorization header without Bearer',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': AGGREGATOR_API_KEY
      }
    },
    {
      name: 'openai-api-key header',
      headers: {
        'Content-Type': 'application/json',
        'openai-api-key': AGGREGATOR_API_KEY
      }
    }
  ];
  
  // Test each authentication method
  for (const method of authMethods) {
    console.log(`\nTesting ${method.name}...`);
    
    try {
      const response = await axios({
        method: 'POST',
        url: `${AGGREGATOR_URL}/auth-test`,
        headers: method.headers,
        timeout: 10000
      });
      
      console.log(`✅ SUCCESS: ${method.name}`);
      console.log('Response:', response.data);
    } catch (error) {
      console.error(`❌ FAILED: ${method.name}`);
      console.error('Error:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
    }
  }
}

// Test with diagnostic endpoint
async function testDiagnostic() {
  console.log('\nTesting diagnostic endpoint...');
  
  try {
    const response = await axios({
      method: 'GET',
      url: `${AGGREGATOR_URL}/diagnostic`,
      timeout: 10000
    });
    
    console.log('Diagnostic response:', response.data);
  } catch (error) {
    console.error('Error calling diagnostic endpoint:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Test with n8n-style request
async function testN8nRequest() {
  console.log('\nTesting n8n-style request...');
  
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
      },
      timeout: 30000
    });
    
    console.log('Response status:', response.status);
    console.log('Response data structure:', Object.keys(response.data));
    
    // Check if the response has the expected structure
    const hasChoices = !!response.data.choices;
    const hasContent = !!response.data.choices?.[0]?.message?.content;
    
    console.log('Has choices:', hasChoices);
    console.log('Has content:', hasContent);
    
    if (hasContent) {
      console.log('Content:', response.data.choices[0].message.content);
    }
  } catch (error) {
    console.error('Error with n8n-style request:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the tests
async function runTests() {
  try {
    await testAuthMethods();
    await testDiagnostic();
    await testN8nRequest();
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

runTests();
