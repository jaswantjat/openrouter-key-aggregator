# OpenRouter Key Aggregator Tests

This directory contains tests for the OpenRouter Key Aggregator, focusing on n8n compatibility and chatInput format handling.

## Test Files

1. **test-openrouter-direct.js**: Tests calling OpenRouter API directly with both standard and n8n chatInput formats.
2. **test-aggregator.js**: Tests calling our OpenRouter Key Aggregator with both standard and n8n chatInput formats.
3. **test-n8n-compatibility.js**: Tests if the responses from our OpenRouter Key Aggregator are compatible with n8n's AI Agent node.

## How to Run the Tests

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run individual tests:
   ```bash
   # Test OpenRouter directly
   npm run test-openrouter
   
   # Test our OpenRouter Key Aggregator
   npm run test-aggregator
   
   # Test n8n compatibility
   npm run test-n8n
   ```

3. Run all tests:
   ```bash
   npm run test-all
   ```

## Configuration

Before running the tests, make sure to update the API keys in the test files:

1. In `test-openrouter-direct.js`, update the `OPENROUTER_API_KEY` variable with your actual OpenRouter API key.
2. In `test-aggregator.js` and `test-n8n-compatibility.js`, update the `AGGREGATOR_API_KEY` variable with your actual OpenRouter Key Aggregator API key.
3. In `test-aggregator.js` and `test-n8n-compatibility.js`, update the `AGGREGATOR_URL` variable with your actual OpenRouter Key Aggregator URL.

## Expected Results

If everything is working correctly, all tests should pass with the following results:

1. **test-openrouter-direct.js**: Both standard and n8n chatInput formats should return responses with the same structure.
2. **test-aggregator.js**: Both standard and n8n chatInput formats should return responses with the expected structure.
3. **test-n8n-compatibility.js**: Both AI Agent and chatInput compatibility checks should pass.

## Troubleshooting

If any of the tests fail, check the following:

1. Make sure your API keys are correct and have sufficient credits.
2. Check if the OpenRouter Key Aggregator is running and accessible.
3. Verify that the OpenRouter API is available and not experiencing any issues.
4. Check the error messages for specific details about what went wrong.
