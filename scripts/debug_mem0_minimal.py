import os
import logging
from mem0 import Memory
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(level=logging.DEBUG)

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

config = {
    "vector_store": {
        "provider": "chroma",
        "config": {
            "collection_name": "debug_memory",
            "host": "chroma",
            "port": 8000,
        }
    },
    "llm": {
        "provider": "openai",
        "config": {
            "model": "gpt-4o-mini",
            "api_key": OPENAI_API_KEY,
        }
    },
    "embedder": {
        "provider": "openai",
        "config": {
            "api_key": OPENAI_API_KEY
        }
    }
}

print("Initializing Memory...")
m = Memory.from_config(config)

print("Adding memory...")
try:
    result = m.add("I like to play cricket on weekends", user_id="debug_user")
    print(f"Result: {result}")
except Exception as e:
    print(f"Error: {e}")

print("Searching memory...")
try:
    results = m.search("What do I like to do?", user_id="debug_user")
    print(f"Search Results: {results}")
except Exception as e:
    print(f"Error: {e}")
