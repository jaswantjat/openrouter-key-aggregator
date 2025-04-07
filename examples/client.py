"""
Example client for the OpenRouter API Key Aggregator using Python

This example shows how to use the OpenRouter API Key Aggregator
with different models from various providers using Python.
"""

import requests
import json
import base64

# Replace with your actual API Key Aggregator URL
API_URL = 'https://your-service.onrender.com/api'

# Optional: Authentication credentials (if enabled)
AUTH_USERNAME = 'admin'
AUTH_PASSWORD = 'password'

def call_api(model, prompt):
    """
    Call the API Key Aggregator with the specified model and prompt
    """
    # Create headers
    headers = {
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://example.com',
        'X-Title': 'API Key Aggregator Python Example'
    }

    # Add authentication if enabled
    if AUTH_USERNAME and AUTH_PASSWORD:
        auth_string = f"{AUTH_USERNAME}:{AUTH_PASSWORD}"
        auth_bytes = auth_string.encode('ascii')
        base64_bytes = base64.b64encode(auth_bytes)
        base64_string = base64_bytes.decode('ascii')
        headers['Authorization'] = f'Basic {base64_string}'

    # Create request body
    data = {
        'model': model,
        'messages': [
            {'role': 'user', 'content': prompt}
        ]
    }

    # Make the API call
    response = requests.post(
        f'{API_URL}/proxy/chat/completions',
        headers=headers,
        json=data
    )

    # Check for errors
    if response.status_code != 200:
        print(f"Error: {response.status_code}")
        print(response.text)
        return None

    return response.json()

def run_examples():
    """
    Run examples with different models
    """
    print('OpenRouter API Key Aggregator - Python Client Examples')
    print('====================================================')

    try:
        # Example 1: Llama 4 Maverick (Free)
        print('\n1. Llama 4 Maverick (Free)')
        print('------------------------')
        llama4_response = call_api(
            'meta-llama/llama-4-maverick:free',
            'Explain quantum computing in simple terms'
        )
        if llama4_response:
            print('Response:', llama4_response['choices'][0]['message']['content'])

        # Example 2: Gemini 2.5 Pro Exp (Free)
        print('\n2. Gemini 2.5 Pro Exp (Free)')
        print('------------------------')
        gemini_response = call_api(
            'google/gemini-2.5-pro-exp-03-25:free',
            'What are the benefits of renewable energy?'
        )
        if gemini_response:
            print('Response:', gemini_response['choices'][0]['message']['content'])

        # Example 3: Anthropic Claude 3.5 Sonnet
        print('\n3. Anthropic Claude 3.5 Sonnet')
        print('-----------------------------')
        claude_response = call_api(
            'anthropic/claude-3-5-sonnet',
            'Write a short poem about artificial intelligence'
        )
        if claude_response:
            print('Response:', claude_response['choices'][0]['message']['content'])

        # Example 3: OpenAI GPT-4o
        print('\n3. OpenAI GPT-4o')
        print('----------------')
        gpt_response = call_api(
            'openai/gpt-4o',
            'Give me 3 creative ideas for a mobile app'
        )
        if gpt_response:
            print('Response:', gpt_response['choices'][0]['message']['content'])

    except Exception as e:
        print(f"Error running examples: {e}")

if __name__ == "__main__":
    run_examples()
