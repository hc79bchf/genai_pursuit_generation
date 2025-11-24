from mem0 import Memory
from app.core.config import settings
import json

def verify_memory():
    print("Verifying agent memory persistence...")
    try:
        # Initialize memory with same config as agent
        m = Memory.from_config(settings.MEM0_CONFIG)
        
        # Search for the memory stored by the agent
        # The agent stores it with user_id="agent_memory_user"
        results = m.search("AI Platform", user_id="agent_memory_user")
        
        if results:
            print(f"SUCCESS: Found {len(results)} memory items.")
            for res in results:
                print(f"- {res}")
        else:
            print("FAILURE: No memory items found for 'agent_memory_user'.")
            
    except Exception as e:
        print(f"Error verifying memory: {e}")

if __name__ == "__main__":
    verify_memory()
