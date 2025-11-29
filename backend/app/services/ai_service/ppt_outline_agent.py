import logging
import json
import os
from typing import Dict, Any, List, Optional
from app.services.memory_service import MemoryService
from app.services.ai_service.llm_service import LLMService
from app.core.config import settings

logger = logging.getLogger(__name__)

# Load MARP style guide
STYLE_GUIDE_PATH = os.path.join(os.path.dirname(__file__), "marp_style_guide.md")

def load_marp_style_guide() -> str:
    """Load the MARP style guide from file."""
    try:
        with open(STYLE_GUIDE_PATH, "r") as f:
            return f.read()
    except FileNotFoundError:
        logger.warning("MARP style guide not found, using default instructions")
        return ""

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

        # 3. Load MARP Style Guide
        style_guide = load_marp_style_guide()

        # 4. Construct Prompt
        system_prompt = """You are an expert proposal manager and presentation designer.
        Your task is to create a COMPREHENSIVE and DETAILED PowerPoint presentation for a business proposal using MARP Markdown format.
        Do not just create an outline; write the ACTUAL CONTENT for the slides.
        Structure the presentation logically to persuade the client.
        Use the provided metadata, research insights, and prior knowledge to tailor the content.
        Follow the MARP Style Guide provided for consistent, professional styling.
        """

        prompt = f"""
        Create a detailed MARP Markdown presentation for the following pursuit:

        PURSUIT METADATA:
        {json.dumps(pursuit_metadata, default=str)}

        {research_context}

        {memory_context}

        ======== MARP STYLE GUIDE ========
        {style_guide}
        ==================================

        REQUIREMENTS:
        - Use MARP Markdown format following the style guide above.
        - Start with the front matter:
            ```yaml
            ---
            marp: true
            theme: gaia
            class: lead
            paginate: true
            backgroundColor: #1e1e2e
            color: #ffffff
            ---
            ```
        - **MUST include a `<style>` block** at the top using the CSS from the style guide for a premium, branded look.
        - **Design Principles (from Style Guide):**
            - Follow the **5/5/5 rule**: max 5 bullets, 5 words per bullet, avoid 5+ text-heavy slides in a row.
            - Use **split backgrounds** (`![bg right:40%](url)`) for visual layouts.
            - Use **placeholder images** from Unsplash: `![bg right:40%](https://source.unsplash.com/random/800x600?technology,business)`
            - Include **Mermaid diagrams** for architecture, processes, or workflows.
        - **Color Palette (App Theme):**
            - Primary: `#7c3aed` (Purple)
            - Primary Light: `#a78bfa`
            - Background Dark: `#1e1e2e`
            - Text Light: `#ffffff`
            - Accent: `#06b6d4` (Cyan)
        - **Slide Structure (10-15 slides):**
            1. **Title Slide:** Use `<!-- _class: invert -->` with split background image.
            2. **Executive Summary:** Clean layout with bold key points (3-5 bullets max).
            3. **Client Understanding:** Show understanding of their needs.
            4. **Requirements Overview:** Table or numbered list format.
            5. **Proposed Solution:** **MUST include a Mermaid diagram** (flowchart or architecture).
            6. **Methodology:** Timeline or process flow diagram.
            7. **Technology Stack:** Icons with brief descriptions.
            8. **Team Introduction:** Circular avatar placeholders.
            9. **Case Studies/Experience:** Split background with results/metrics.
            10. **Timeline & Milestones:** Visual timeline.
            11. **Investment/Pricing:** Clean table format.
            12. **Why Choose Us:** Differentiators with icons.
            13. **Next Steps:** Clear call to action.
            14. **Contact & Q&A:** Use `<!-- _class: lead invert -->`.
        - **Slide Directives:**
            - Use `<!-- _class: invert -->` for dark background slides (Title, Transitions).
            - Use `<!-- _backgroundColor: #f8f9fa -->` for light contrast slides.
            - Vary slide styles to maintain visual interest.

        Output MUST be the raw Markdown string. Do not wrap in JSON or code blocks.
        """

        # 5. Generate Response
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
