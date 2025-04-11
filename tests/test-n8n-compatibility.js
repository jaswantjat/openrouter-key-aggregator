/**
 * Test script for n8n AI Agent node compatibility
 * 
 * This script tests if the responses from our OpenRouter Key Aggregator
 * are compatible with n8n's AI Agent node.
 */
const axios = require('axios');

// OpenRouter Key Aggregator API key (replace with your actual key)
const AGGREGATOR_API_KEY = '51fa83450b6f92dd3606cad17d261d3d';
const AGGREGATOR_URL = 'https://openrouter-key-aggregator.onrender.com/api';

// Test n8n AI Agent compatibility
async function testN8nAIAgentCompatibility() {
  console.log('Testing n8n AI Agent compatibility...');
  
  try {
    // First, get a response from the aggregator
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
    
    // Now, check if the response is compatible with n8n AI Agent node
    const data = response.data;
    
    // Check for required fields
    const checks = {
      hasChoices: !!data.choices && Array.isArray(data.choices),
      hasMessage: !!data.choices?.[0]?.message,
      hasContent: !!data.choices?.[0]?.message?.content,
      hasRole: !!data.choices?.[0]?.message?.role,
      hasFinishReason: !!data.choices?.[0]?.finish_reason,
      hasUsage: !!data.usage
    };
    
    console.log('\nCompatibility checks:');
    Object.entries(checks).forEach(([check, result]) => {
      console.log(`- ${check}: ${result ? '✅' : '❌'}`);
    });
    
    const isCompatible = Object.values(checks).every(Boolean);
    console.log(`\nOverall compatibility: ${isCompatible ? '✅ Compatible' : '❌ Not compatible'}`);
    
    // Test accessing the content property (this is what causes the error in n8n)
    try {
      const content = data.choices[0].message.content;
      console.log('\nSuccessfully accessed content property:', content.substring(0, 50) + '...');
    } catch (error) {
      console.error('\nError accessing content property:', error.message);
    }
    
    return { data, isCompatible };
  } catch (error) {
    console.error('Error testing n8n compatibility:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

// Test n8n chatInput format compatibility
async function testN8nChatInputCompatibility() {
  console.log('\nTesting n8n chatInput format compatibility...');
  
  try {
    // First, get a response from the aggregator using chatInput format
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
    
    // Now, check if the response is in the expected format for n8n
    const data = response.data;
    
    // Check for required fields
    const checks = {
      isArray: Array.isArray(data),
      hasSessionId: !!data[0]?.sessionId,
      hasResponse: !!data[0]?.response,
      hasGenerations: !!data[0]?.response?.generations && Array.isArray(data[0]?.response?.generations),
      hasText: !!data[0]?.response?.generations?.[0]?.[0]?.text,
      hasTokenUsage: !!data[0]?.tokenUsage
    };
    
    console.log('\nCompatibility checks:');
    Object.entries(checks).forEach(([check, result]) => {
      console.log(`- ${check}: ${result ? '✅' : '❌'}`);
    });
    
    const isCompatible = Object.values(checks).every(Boolean);
    console.log(`\nOverall compatibility: ${isCompatible ? '✅ Compatible' : '❌ Not compatible'}`);
    
    // Test accessing the text property
    try {
      const text = data[0].response.generations[0][0].text;
      console.log('\nSuccessfully accessed text property:', text.substring(0, 50) + '...');
    } catch (error) {
      console.error('\nError accessing text property:', error.message);
    }
    
    return { data, isCompatible };
  } catch (error) {
    console.error('Error testing n8n chatInput compatibility:', error.message);
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
    const aiAgentResult = await testN8nAIAgentCompatibility();
    const chatInputResult = await testN8nChatInputCompatibility();
    
    console.log('\n=== Summary ===');
    console.log('AI Agent compatibility:', aiAgentResult.isCompatible ? '✅ Compatible' : '❌ Not compatible');
    console.log('ChatInput compatibility:', chatInputResult.isCompatible ? '✅ Compatible' : '❌ Not compatible');
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

runTests();
