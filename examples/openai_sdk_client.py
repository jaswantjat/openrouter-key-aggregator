"""
Example client for the OpenRouter API Key Aggregator using the OpenAI SDK

This example shows how to use the OpenRouter API Key Aggregator
with the OpenAI SDK, which is compatible with OpenRouter's API.
"""

from openai import OpenAI
import base64
import os

# Replace with your actual API Key Aggregator URL
API_URL = 'https://your-service.onrender.com/api'

# Optional: Authentication credentials (if enabled)
AUTH_USERNAME = 'admin'
AUTH_PASSWORD = 'password'

# Create authentication header if needed
auth_header = None
if AUTH_USERNAME and AUTH_PASSWORD:
    auth_string = f"{AUTH_USERNAME}:{AUTH_PASSWORD}"
    auth_bytes = auth_string.encode('ascii')
    base64_bytes = base64.b64encode(auth_bytes)
    base64_string = base64_bytes.decode('ascii')
    auth_header = f'Basic {base64_string}'

# Create OpenAI client with custom base URL
client = OpenAI(
    base_url=f"{API_URL}/proxy",  # Point to our proxy endpoint
    api_key="dummy-key",  # This key is not used, but required by the SDK
    default_headers={
        "Authorization": auth_header,  # Add Basic auth if enabled
        "HTTP-Referer": "https://example.com",  # Optional for OpenRouter stats
        "X-Title": "API Key Aggregator OpenAI SDK Example"  # Optional for OpenRouter stats
    }
)

def run_examples():
    """
    Run examples with different models using the OpenAI SDK
    """
    print('OpenRouter API Key Aggregator - OpenAI SDK Client Examples')
    print('========================================================')
    
    try:
        # Example 1: Google Gemini 2.5 Pro
        print('\n1. Google Gemini 2.5 Pro')
        print('------------------------')
        gemini_response = client.chat.completions.create(
            model="google/gemini-2.5-pro-preview-03-25",
            messages=[
                {"role": "user", "content": "Explain quantum computing in simple terms"}
            ]
        )
        print('Response:', gemini_response.choices[0].message.content)
        
        # Example 2: Anthropic Claude 3.5 Sonnet
        print('\n2. Anthropic Claude 3.5 Sonnet')
        print('-----------------------------')
        claude_response = client.chat.completions.create(
            model="anthropic/claude-3-5-sonnet",
            messages=[
                {"role": "user", "content": "Write a short poem about artificial intelligence"}
            ]
        )
        print('Response:', claude_response.choices[0].message.content)
        
        # Example 3: OpenAI GPT-4o
        print('\n3. OpenAI GPT-4o')
        print('----------------')
        gpt_response = client.chat.completions.create(
            model="openai/gpt-4o",
            messages=[
                {"role": "user", "content": "Give me 3 creative ideas for a mobile app"}
            ]
        )
        print('Response:', gpt_response.choices[0].message.content)
            
    except Exception as e:
        print(f"Error running examples: {e}")

if __name__ == "__main__":
    run_examples()
