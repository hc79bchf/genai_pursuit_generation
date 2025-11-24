import asyncio
import os
import sys

# Add app to path
sys.path.append(os.getcwd())

from app.services.ai_service.metadata_agent import MetadataExtractionAgent
from app.services.ai_service.llm_service import LLMService

# Mock text content from dummy_rfp.txt
RFP_TEXT = """Request for Proposal: Enterprise Transformation Project
Client Entity: Global Tech Solutions
Point of Contact: Jane Smith
Email: jane.smith@globaltech.com
Industry: Technology
Geography: North America

Project Overview:
We are seeking a partner to modernize our legacy infrastructure.

Scope of Work:
- Cloud Migration to AWS
- Microservices Architecture Implementation
- Frontend Rewrite using React and Next.js

Technologies Required:
- Python
- PostgreSQL
- Docker
- Kubernetes
- React
- TypeScript

Timeline:
Submission Due Date: 2025-05-15
Project Start: 2025-06-01

Budget:
Estimated Fees: $500,000 USD

Submission Format:
Please submit your proposal in PDF format.
"""

async def main():
    print("Initializing LLM Service...")
    llm_service = LLMService()
    
    print("Initializing Metadata Extraction Agent...")
    agent = MetadataExtractionAgent(llm_service)
    
    print(f"Extracting metadata from text ({len(RFP_TEXT)} chars)...")
    try:
        result = await agent.extract(RFP_TEXT, user_id="debug_user")
        print("\nExtraction Result:")
        import json
        print(json.dumps(result, indent=2, default=str))
    except Exception as e:
        print(f"\nExtraction Failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
