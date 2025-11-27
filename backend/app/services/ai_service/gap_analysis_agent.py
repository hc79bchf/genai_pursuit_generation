from typing import Dict, Any, List
import json
import logging
from pydantic import BaseModel, Field

from app.services.memory_service import MemoryService
from app.services.ai_service.llm_service import LLMService
from app.core.config import settings

logger = logging.getLogger(__name__)

class GapAnalysisResult(BaseModel):
    gaps: List[str] = Field(description="List of identified gaps where information is missing")
    search_queries: List[str] = Field(description="List of search queries to find missing information")
    reasoning: str = Field(description="Explanation of why these gaps were identified")

class GapAnalysisAgent:
    def __init__(self, llm_service: LLMService):
        self.llm_service = llm_service
        self.memory_service = MemoryService()

    async def analyze(self, pursuit_metadata: Dict[str, Any], template_details: Dict[str, Any], user_id: str) -> Dict[str, Any]:
        """
        Analyzes the gap between extracted metadata and the selected template.
        Retrieves relevant past information from memory to inform the analysis.
        """
        logger.info(f"Starting gap analysis for pursuit: {pursuit_metadata.get('id')}")

        # 1. Retrieve relevant context from memory (RAG)
        # We search for similar pursuits or past gap analyses
        query = f"Gap analysis for {pursuit_metadata.get('entity_name', '')} {pursuit_metadata.get('industry', '')}"
        memories = self.memory_service.search_long_term(query, user_id=user_id, limit=3)
        
        memory_context = ""
        if memories:
            memory_context = "\nRelevant past analyses/knowledge:\n"
            for m in memories:
                if isinstance(m, dict):
                    text = m.get('memory', m.get('text', str(m)))
                else:
                    text = str(m)
                memory_context += f"- {text}\n"
            
            logger.info(f"Retrieved Memory Context for Gap Analysis:\n{memory_context}")

        # 2. Construct Prompt
        prompt = f"""
        You are an expert proposal manager. Your task is to perform a Gap Analysis for a new pursuit.
        
        GOAL: Identify missing information in the "Extracted Metadata" that is required to fulfill the "Target Proposal Outline".
        
        INPUTS:
        
        1. Target Proposal Outline:
        Title: {template_details.get('title')}
        Description: {template_details.get('description')}
        Structure:
        {json.dumps(template_details.get('details', []), indent=2)}
        
        2. Extracted Metadata (from RFP):
        {json.dumps(pursuit_metadata, default=str, indent=2)}
        
        3. Context (Past Knowledge):
        {memory_context}
        
        INSTRUCTIONS:
        - Compare the "Extracted Metadata" against the "Target Proposal Outline".
        - Identify critical information that is MISSING or INCOMPLETE in the metadata but required by the outline.
        - For each gap, formulate a specific "Deep Search Query" that can be used to find this information on the web (e.g., client's strategic goals, competitor info, specific technology stack details).
        - Provide a list of gaps and a corresponding list of search queries.
        
        OUTPUT FORMAT:
        Return a JSON object with the following structure:
        {{
            "gaps": ["gap 1", "gap 2", ...],
            "search_queries": ["query 1", "query 2", ...],
            "reasoning": "Brief explanation of the analysis..."
        }}
        """
        
        # 3. Call LLM
        try:
            result = await self.llm_service.generate_json(
                prompt=prompt,
                schema=GapAnalysisResult,
                model=settings.LLM_MODEL_SMART
            )
            
            result_dict = result.model_dump()
            
            # 4. Store result in memory
            try:
                memory_text = f"Gap Analysis for {pursuit_metadata.get('entity_name')}: Found {len(result_dict['gaps'])} gaps. Queries: {', '.join(result_dict['search_queries'][:3])}..."
                self.memory_service.add_long_term(
                    memory_text, 
                    user_id=user_id, 
                    metadata={"type": "gap_analysis", "entity": pursuit_metadata.get('entity_name')}
                )
            except Exception as e:
                logger.error(f"Failed to store gap analysis memory: {e}")
                
            return result_dict
            
        except Exception as e:
            logger.error(f"Gap analysis failed: {e}", exc_info=True)
            raise e
