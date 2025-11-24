from typing import Dict, Any
import json
from app.schemas.pursuit import PursuitMetadata
from app.services.memory_service import MemoryService

import logging

logger = logging.getLogger(__name__)

class MetadataExtractionAgent:
    def __init__(self, llm_service):
        self.llm_service = llm_service
        self.memory_service = MemoryService()

    async def extract(self, rfp_text: str, user_id: str = "agent_memory_user") -> Dict[str, Any]:
        """
        Extracts metadata from the provided RFP text using the LLM.
        """
        # 1. Retrieve relevant context from memory
        # Use the first 1000 chars as query context
        query = rfp_text[:1000]
        memories = self.memory_service.search_long_term(query, user_id=user_id, limit=3)
        
        memory_context = ""
        if memories:
            memory_context = "\nRelevant past extractions:\n"
            for m in memories:
                logger.info(f"Raw memory object: {m}")
                if isinstance(m, dict):
                    text = m.get('memory', m.get('text', str(m)))
                else:
                    text = str(m)
                memory_context += f"- {text}\n"
            
            logger.info(f"Retrieved Memory Context:\n{memory_context}")

        prompt = f"""
        You are an expert proposal manager. Your task is to extract key metadata from the following Request for Proposal (RFP) text.
        
        CRITICAL INSTRUCTION: You have access to "Relevant past extractions" which contain user feedback and corrections. 
        If the RFP text contradicts the "Relevant past extractions", YOU MUST PRIORITIZE THE PAST EXTRACTIONS/FEEDBACK. 
        For example, if the RFP says the due date is Jan 15, but feedback says it was extended to Feb 28, use Feb 28.
        
        {memory_context}
        
        Please extract the following fields:
        - entity_name: Client organization name
        - client_pursuit_owner_name: Name of the client contact
        - client_pursuit_owner_email: Email of the client contact
        - industry: Client industry
        - service_types: List of services requested (e.g., Engineering, Data, Design). MUST be a JSON list. Return [] if none found.
        - technologies: List of technologies mentioned. MUST be a JSON list. Return [] if none found.
        - submission_due_date: Due date (YYYY-MM-DD)
        - expected_format: 'docx' or 'pptx' (default to 'docx' if unclear)
        - rfp_objective: Summary of the client's main goal or objective
        - requirements: List of specific requirements mentioned in the RFP. MUST be a JSON list. Return [] if none found.
        - sources: List of references to where information was found (e.g., "Page 5, Section 2.1")
        
        RFP TEXT:
        {rfp_text}
        """
        
        # The LLM service uses tool use to enforce the Pydantic schema structure
        # Use the smart model (Sonnet) for better extraction quality
        from app.core.config import settings
        
        response = await self.llm_service.generate_json(
            prompt=prompt,
            schema=PursuitMetadata,
            model=settings.LLM_MODEL_SMART
        )
        
        result = response
        if hasattr(response, "model_dump"):
            result = response.model_dump()
            
        # 2. Store the result in memory for future reference
        try:
            # Store a summary or the full JSON
            memory_text = f"Extracted metadata for {result.get('entity_name', 'Unknown Entity')}: {json.dumps(result, default=str)}"
            self.memory_service.add_long_term(
                memory_text, 
                user_id=user_id, 
                metadata={"type": "metadata_extraction", "entity": result.get('entity_name')}
            )
        except Exception as e:
            # Don't fail the extraction if memory storage fails
            logger.error(f"Failed to store memory: {e}")
            
        return result

    async def chat(self, message: str, pursuit_context: Dict[str, Any], rfp_text: str = "", user_id: str = "agent_memory_user") -> str:
        """
        Chat with the agent about a specific pursuit.
        """
        # 1. Retrieve relevant context from memory
        memories = self.memory_service.search_long_term(message, user_id=user_id, limit=3)
        
        memory_context = ""
        if memories:
            memory_context = "\nRelevant past interactions/knowledge:\n"
            for m in memories:
                if isinstance(m, dict):
                    text = m.get('memory', m.get('text', str(m)))
                else:
                    text = str(m)
                memory_context += f"- {text}\n"

        # 2. Construct Prompt
        system_prompt = """You are an expert proposal manager assisting a user with a pursuit. 
        You have access to the RFP content and the current pursuit metadata.
        Answer the user's questions accurately based on the RFP.
        If the user provides corrections or new information, acknowledge it and suggest updating the metadata if applicable.
        """

        prompt = f"""
        CONTEXT:
        Pursuit Metadata: {json.dumps(pursuit_context, default=str)}
        
        {memory_context}
        
        RFP EXCERPT (First 5000 chars):
        {rfp_text[:5000]}...
        
        USER MESSAGE:
        {message}
        """

        # 3. Generate Response
        from app.core.config import settings
        response = await self.llm_service.generate_text(
            prompt=prompt,
            system=system_prompt,
            model=settings.LLM_MODEL_SMART
        )

        # 4. Store interaction in memory
        try:
            pursuit_id = str(pursuit_context.get("id"))
            self.memory_service.add_short_term(pursuit_id, "user", message)
            self.memory_service.add_short_term(pursuit_id, "assistant", response)
        except Exception as e:
            logger.error(f"Failed to store chat memory: {e}")

        return response
