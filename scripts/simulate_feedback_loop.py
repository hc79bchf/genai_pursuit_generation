import asyncio
import os
import sys
import logging
import json
from datetime import date
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Ensure backend is in path
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend'))
if backend_path not in sys.path:
    sys.path.append(backend_path)

from app.services.ai_service.llm_service import LLMService
from app.services.ai_service.metadata_agent import MetadataExtractionAgent
from app.services.memory_service import MemoryService

# Fake RFP Text
RFP_TEXT = """
REQUEST FOR PROPOSAL
Project: AI Transformation Initiative
Client: Acme Corp
Date: November 21, 2025

Overview:
Acme Corp is seeking a partner to develop a generative AI platform.

Submission Details:
Please submit your proposals by January 15, 2026.
Contact: Jane Doe (jane.doe@acme.com)
"""

async def main():
    from app.core.config import settings
    import uuid
    # User ID for this simulation
    user_id = f"debug_user_{uuid.uuid4().hex[:8]}"
    logger.info(f"Using user_id: {user_id}")
    
    logger.info("Initializing services...")
    llm_service = LLMService()
    agent = MetadataExtractionAgent(llm_service)
    memory_service = MemoryService()
    # or we could try to delete if we had the IDs. For now, we assume the prompt will prioritize recent/relevant info.
    
    print("\n" + "="*50)
    print("ROUND 1: Initial Extraction (No Feedback)")
    print("="*50)
    
    result1 = await agent.extract(RFP_TEXT, user_id=user_id)
    print(f"Extracted Due Date: {result1.get('submission_due_date')}")
    print(f"Extracted Owner: {result1.get('client_pursuit_owner_name')}")
    
    # Test Simple Memory
    logger.info("Testing simple memory addition...")
    try:
        res = memory_service.add_long_term("I like to play cricket on weekends", user_id=user_id)
        logger.info(f"Simple memory add result: {res}")
    except Exception as e:
        logger.error(f"Simple memory add failed: {e}")
    
    # Simulate Feedback 1
    feedback1 = "Correction: The submission due date has been extended to February 28, 2026."
    print("\n" + "-"*50)
    print(f"INJECTING FEEDBACK 1: {feedback1}")
    print("-"*50)
    
    # Store feedback in memory
    # We store it associated with the RFP content so it's retrieved next time
    memory_service.add_long_term(
        f"User Feedback for AI Transformation Initiative: {feedback1}",
        user_id=user_id
    )
    
    # Wait a bit for indexing (simulated)
    print("Memory updating...")
    await asyncio.sleep(5)
    
    print("\n" + "="*50)
    print("ROUND 2: EXTRACTION WITH MEMORY (After Feedback 1)")
    print("="*50)
    
    result2 = await agent.extract(RFP_TEXT, user_id=user_id)
    print(f"Extracted Due Date: {result2.get('submission_due_date')}")
    print(f"Extracted Owner: {result2.get('client_pursuit_owner_name')}")
    
    # Simulate Feedback 2
    feedback2 = "Correction: The client contact is actually John Smith, not Jane Doe."
    print("\n" + "-"*50)
    print(f"INJECTING FEEDBACK 2: {feedback2}")
    print("-"*50)
    
    memory_service.add_long_term(
        f"User Feedback for AI Transformation Initiative: {feedback2}",
        user_id=user_id
    )
    
    await asyncio.sleep(5)
    
    print("\n" + "="*50)
    print("ROUND 3: EXTRACTION WITH ACCUMULATED MEMORY (After Feedback 2)")
    print("="*50)
    
    result3 = await agent.extract(RFP_TEXT, user_id=user_id)
    print(f"Extracted Due Date: {result3.get('submission_due_date')}")
    print(f"Extracted Owner: {result3.get('client_pursuit_owner_name')}")
    
    print("\n" + "="*50)
    print("SUMMARY OF IMPROVEMENT")
    print("="*50)
    print(f"Round 1 Due Date: {result1.get('submission_due_date')} (Original)")
    print(f"Round 2 Due Date: {result2.get('submission_due_date')} (After Feedback 1)")
    print(f"Round 3 Due Date: {result3.get('submission_due_date')} (Should persist)")
    print(f"Round 1 Owner:    {result1.get('client_pursuit_owner_name')} (Original)")
    print(f"Round 3 Owner:    {result3.get('client_pursuit_owner_name')} (After Feedback 2)")

if __name__ == "__main__":
    asyncio.run(main())
