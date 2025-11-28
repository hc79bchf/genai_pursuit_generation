import logging
import json
from typing import Dict, Any, List, Optional
from app.services.memory_service import MemoryService
from app.services.ai_service.llm_service import LLMService
from app.core.config import settings

logger = logging.getLogger(__name__)

class PPTOutlineAgent:
    def __init__(self, llm_service: LLMService):
        self.llm_service = llm_service
        self.memory_service = MemoryService()

    async def generate_outline(
        self, 
        pursuit_metadata: Dict[str, Any], 
        research_result: Optional[Dict[str, Any]] = None,
        user_id: str = "agent_memory_user"
    ) -> str:
        """
        Generates a MARP-formatted PPT outline based on metadata, research, and prior pursuit knowledge.
        """
        # 1. Retrieve relevant context from memory (Prior Pursuits)
        query = f"Proposal for {pursuit_metadata.get('entity_name', '')} {pursuit_metadata.get('service_types', [])}"
        memories = self.memory_service.search_long_term(query, user_id=user_id, limit=3)
        
        memory_context = ""
        if memories:
            memory_context = "\nRelevant Prior Pursuit Knowledge:\n"
            for m in memories:
                if isinstance(m, dict):
                    text = m.get('memory', m.get('text', str(m)))
                else:
                    text = str(m)
                memory_context += f"- {text}\n"

        # 2. Format Research Context
        research_context = ""
        if research_result:
            research_context = f"\nDeep Search Insights:\n{research_result.get('overall_summary', 'No summary available.')}\n"
            if 'research_results' in research_result:
                 for res in research_result['research_results'][:3]: 
                     research_context += f"- {res.get('summary', '')}\n"

        # 3. Construct Prompt
        system_prompt = """You are an expert proposal manager and presentation designer. 
        Your task is to create a COMPREHENSIVE and DETAILED PowerPoint presentation for a business proposal using MARP Markdown format.
        Do not just create an outline; write the ACTUAL CONTENT for the slides.
        Structure the presentation logically to persuade the client.
        Use the provided metadata, research insights, and prior knowledge to tailor the content.
        """

        prompt = f"""
        Create a detailed MARP Markdown presentation for the following pursuit:

        PURSUIT METADATA:
        {json.dumps(pursuit_metadata, default=str)}

        {research_context}

        {memory_context}

        REQUIREMENTS:
        - Use MARP Markdown format.
        - Start with `---` and include:
            - `marp: true`
            - `theme: gaia`
            - `class: lead`
            - `backgroundColor: #fff`
        - **Design Principles:**
            - **Keep it simple:** Avoid text-heavy slides. Use the "5/5/5" rule (max 5 lines, 5 words per line).
            - **Strong Visuals:** Use split backgrounds (`![bg right]`) for layouts. Use placeholder images (`![width:500px](https://source.unsplash.com/random/800x600?tech)`) if specific ones aren't available.
            - **Diagrams:** Use **Mermaid** syntax for architecture or process flows.
        - **Custom Styling:**
            - Include a `<style>` block at the top for a premium look.
            - Example CSS:
              ```css
              section {{
                font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
                font-size: 24px;
                padding: 40px;
              }}
              h1 {{
                color: #2c3e50;
              }}
              ```
        - **Slide Structure (10-15 slides):**
            1. **Title Slide:** Use a split background image (`![bg right:40%](url)`).
            2. **Executive Summary:** Use a clean layout with icons or bold key points.
            3. **Requirements:** Use a list or a table.
            4. **Proposed Solution:** **MUST** include a Mermaid diagram (flowchart or sequence) representing the architecture.
            5. **Methodology:** Use a timeline or process diagram.
            6. **Team:** Use circular image placeholders for team members.
            7. **Conclusion:** Strong closing slide with contact info.
        - **Directives:**
            - Use `<!-- _class: invert -->` for dark background slides (like Title or Transition slides).
            - Use `<!-- _backgroundColor: #f0f0f0 -->` for specific slides to create variety.
        
        Output MUST be the raw Markdown string. Do not wrap in JSON.
        """

        # 4. Generate Response
        try:
            response = await self.llm_service.generate_text(
                prompt=prompt,
                system=system_prompt,
                model=settings.LLM_MODEL_SMART
            )
            
            return response

        except Exception as e:
            logger.error(f"Failed to generate PPT outline: {e}")
            raise e
