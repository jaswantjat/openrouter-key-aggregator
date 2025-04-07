"""
Example for using the OpenRouter API Key Aggregator with n8n and OpenAI SDK
"""

from openai import OpenAI

# This is the correct way to configure the OpenAI client for n8n
client = OpenAI(
    # The base URL should be your service URL WITHOUT /api at the end
    base_url="https://openrouter-key-aggregator.onrender.com/api/v1",
    
    # Your API key from the admin dashboard
    api_key="your_api_key_here",
    
    # Optional: You can also set the API key in the headers
    default_headers={
        "X-API-Key": "your_api_key_here"  # Same as above
    }
)

# Example using a free model
try:
    completion = client.chat.completions.create(
        model="meta-llama/llama-4-maverick:free",  # Free model
        messages=[
            {"role": "user", "content": "Hello, how are you?"}
        ]
    )
    print("Success! Response:")
    print(completion.choices[0].message.content)
    
except Exception as e:
    print(f"Error: {e}")
    
    # Print more details if available
    if hasattr(e, 'response'):
        print(f"Status code: {e.response.status_code}")
        print(f"Response body: {e.response.text}")
