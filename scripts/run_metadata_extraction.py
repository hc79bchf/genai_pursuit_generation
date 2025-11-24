import asyncio
import os
import sys
import logging
from docx import Document

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

def read_docx(file_path):
    doc = Document(file_path)
    full_text = []
    for para in doc.paragraphs:
        full_text.append(para.text)
    return '\n'.join(full_text)

async def main():
    # Check if running in container with mounted data
    if os.path.exists("/data/AI_Platform_RFP.docx"):
        file_path = "/data/AI_Platform_RFP.docx"
    else:
        file_path = os.path.join(os.path.dirname(__file__), '..', 'Data', 'AI_Platform_RFP.docx')
    
    if not os.path.exists(file_path):
        logger.error(f"File not found at {file_path}")
        return

    logger.info(f"Reading file: {file_path}")
    rfp_text = read_docx(file_path)
    logger.info(f"Extracted {len(rfp_text)} characters.")
    
    logger.info("Initializing Agent...")
    try:
        llm_service = LLMService()
        agent = MetadataExtractionAgent(llm_service)
        
        logger.info("Running Metadata Extraction (this may take a moment)...")
        result = await agent.extract(rfp_text)
        
        logger.info("Extraction Results:")
        # If result is a Pydantic model, dump it to dict for pretty printing
        if hasattr(result, "model_dump"):
            import json
            print(json.dumps(result.model_dump(), indent=2, default=str))
        else:
            print(result)
            
    except Exception as e:
        logger.exception("An error occurred during extraction")

if __name__ == "__main__":
    asyncio.run(main())
