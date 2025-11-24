import asyncio
import sys
import os
from uuid import uuid4

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

from app.services.ai_service.metadata_agent import MetadataExtractionAgent
from app.services.ai_service.llm_service import LLMService

# Mock LLM Service to avoid API calls and just return a string
class MockLLMService:
    async def generate_text(self, prompt, system, model):
        return "This is a mock response."

    async def generate_json(self, prompt, schema, model):
        return {}

async def verify_chat():
    print("Verifying chat functionality...")
    
    # Mock services
    llm_service = MockLLMService()
    agent = MetadataExtractionAgent(llm_service)
    
    # Mock pursuit context
    pursuit_context = {"id": str(uuid4()), "entity_name": "Test Entity"}
    
    try:
        response = await agent.chat("Hello", pursuit_context)
        print(f"Chat response: {response}")
        print("Chat verification PASSED")
    except Exception as e:
        print(f"Chat verification FAILED: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(verify_chat())
