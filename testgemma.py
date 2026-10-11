
from google import genai
import os

client = genai.Client(
    api_key=os.environ["GEMINI_API_KEY"]
)

response = client.models.generate_content(
    model="gemma-4-26b-a4b-it",
    contents="Generate 5 feedback questions for a food delivery website."
)

print(response.text)
