from typing import Dict, Any, List, Optional
import json
import logging
import re
from pydantic import BaseModel, Field

from app.services.memory_service import MemoryService
from app.services.ai_service.llm_service import LLMService
from app.core.config import settings

logger = logging.getLogger(__name__)


class GapAnalysisResult(BaseModel):
    """Result schema for gap analysis including deep research prompt"""
    gaps: List[str] = Field(description="List of identified gaps where information is missing")
    search_queries: List[str] = Field(description="List of search queries to find missing information")
    reasoning: str = Field(description="Explanation of why these gaps were identified")
    deep_research_prompt: str = Field(
        default="",
        description="A comprehensive research prompt for deep research, sanitized of PII and entity names"
    )

class GapAnalysisAgent:
    """
    Agent for performing gap analysis between RFP metadata and proposal templates.
    Generates deep research prompts for identified knowledge gaps.
    """

    def __init__(self, llm_service: LLMService):
        self.llm_service = llm_service
        self.memory_service = MemoryService()

    def _sanitize_text(self, text: str, entity_names: List[str]) -> str:
        """
        Remove entity names and potential PII from text.
        Replaces entity names with generic placeholders.
        """
        if not text:
            return text

        sanitized = text
        for entity in entity_names:
            if entity:
                # Case-insensitive replacement
                pattern = re.compile(re.escape(entity), re.IGNORECASE)
                sanitized = pattern.sub("[CLIENT]", sanitized)

        # Remove common PII patterns (emails, phone numbers)
        sanitized = re.sub(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', '[EMAIL]', sanitized)
        sanitized = re.sub(r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b', '[PHONE]', sanitized)

        return sanitized

    def _build_reference_pursuits_context(self, reference_pursuits: Optional[List[Dict[str, Any]]]) -> str:
        """Build context string from reference pursuits, sanitizing entity names."""
        if not reference_pursuits:
            return ""

        context_parts = ["\n4. Reference Past Pursuits (similar successful engagements):"]
        for ref in reference_pursuits:
            # Don't include specific pursuit names - use generic descriptions
            industry = ref.get('industry', 'Unknown')
            win_status = ref.get('win_status', 'Unknown')
            components = ref.get('components', [])

            context_parts.append(f"""
   - Industry: {industry}
   - Outcome: {win_status}
   - Components Available: {', '.join(components) if components else 'None specified'}""")

        return '\n'.join(context_parts)

    async def analyze(
        self,
        pursuit_metadata: Dict[str, Any],
        template_details: Dict[str, Any],
        user_id: str,
        reference_pursuits: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Analyzes the gap between extracted metadata and the selected template.
        Generates a deep research prompt for identified gaps, sanitized of PII.

        Args:
            pursuit_metadata: Extracted RFP metadata
            template_details: Selected proposal template structure
            user_id: Current user ID for memory operations
            reference_pursuits: Optional list of similar past pursuits for context

        Returns:
            Dict containing gaps, search_queries, reasoning, and deep_research_prompt
        """
        logger.info(f"Starting gap analysis for pursuit: {pursuit_metadata.get('id')}")

        # Collect entity names for sanitization
        entity_names = [
            pursuit_metadata.get('entity_name', ''),
            pursuit_metadata.get('client_name', ''),
            pursuit_metadata.get('organization', ''),
        ]
        # Filter out empty strings
        entity_names = [e for e in entity_names if e]

        # 1. Retrieve relevant context from memory (RAG)
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
                # Sanitize memory context
                text = self._sanitize_text(text, entity_names)
                memory_context += f"- {text}\n"

            logger.info(f"Retrieved Memory Context for Gap Analysis")

        # 2. Build reference pursuits context
        reference_context = self._build_reference_pursuits_context(reference_pursuits)

        # 3. Prepare sanitized metadata for the prompt (for context, not the deep research prompt)
        sanitized_requirements = self._sanitize_text(
            pursuit_metadata.get('requirements_text', ''),
            entity_names
        )

        # 4. Construct Prompt
        prompt = f"""
        You are an expert proposal manager. Your task is to perform a Gap Analysis for a new pursuit.

        GOAL:
        1. Identify missing information in the "Extracted Metadata" that is required to fulfill the "Target Proposal Outline".
        2. Generate a comprehensive "Deep Research Prompt" that can be used for in-depth research on the identified gaps.

        INPUTS:

        1. Target Proposal Outline:
        Title: {template_details.get('title')}
        Description: {template_details.get('description')}
        Structure:
        {json.dumps(template_details.get('details', []), indent=2)}

        2. Extracted Metadata (from RFP):
        - Industry: {pursuit_metadata.get('industry', 'Not specified')}
        - Service Types: {', '.join(pursuit_metadata.get('service_types', [])) or 'Not specified'}
        - Technologies: {', '.join(pursuit_metadata.get('technologies', [])) or 'Not specified'}
        - Requirements Summary: {sanitized_requirements or 'Not specified'}

        3. Context (Past Knowledge):
        {memory_context}
        {reference_context}

        INSTRUCTIONS:
        - Compare the "Extracted Metadata" against the "Target Proposal Outline".
        - Identify critical information that is MISSING or INCOMPLETE in the metadata but required by the outline.
        - For each gap, formulate a specific search query for web research.
        - Generate a comprehensive "Deep Research Prompt" following these CRITICAL RULES:

        DEEP RESEARCH PROMPT RULES:
        1. DO NOT include any entity names, company names, or client names
        2. DO NOT include any email addresses, phone numbers, or personal information
        3. DO NOT include any confidential or proprietary information
        4. DO focus on industry best practices and methodologies
        5. DO include the industry context (e.g., "Healthcare IT", "Financial Services")
        6. DO include the service types and technology stack context
        7. DO structure the prompt with clear sections: Industry Context, Existing Information, Knowledge Gaps, Research Objectives
        8. DO make the prompt actionable for a researcher conducting deep industry research

        OUTPUT FORMAT:
        Return a JSON object with the following structure:
        {{
            "gaps": ["gap 1", "gap 2", ...],
            "search_queries": ["query 1", "query 2", ...],
            "reasoning": "Brief explanation of the analysis...",
            "deep_research_prompt": "A comprehensive, multi-paragraph research prompt that:
                - Sets the context (role, industry, engagement type)
                - Describes existing information available
                - Lists specific knowledge gaps to research
                - Provides clear research objectives
                - Focuses on industry best practices and methodologies
                - Contains NO entity names, PII, or confidential data"
        }}
        """

        # 5. Call LLM
        try:
            result = await self.llm_service.generate_json(
                prompt=prompt,
                schema=GapAnalysisResult,
                model=settings.LLM_MODEL_SMART
            )

            result_dict = result.model_dump()

            # 6. Post-process: Ensure deep_research_prompt is sanitized
            if result_dict.get('deep_research_prompt'):
                result_dict['deep_research_prompt'] = self._sanitize_text(
                    result_dict['deep_research_prompt'],
                    entity_names
                )

            # 7. Store result in memory (sanitized)
            try:
                memory_text = f"Gap Analysis for {pursuit_metadata.get('industry', 'unknown industry')}: Found {len(result_dict['gaps'])} gaps including: {', '.join(result_dict['gaps'][:3])}..."
                self.memory_service.add_long_term(
                    memory_text,
                    user_id=user_id,
                    metadata={
                        "type": "gap_analysis",
                        "industry": pursuit_metadata.get('industry'),
                        "gap_count": len(result_dict['gaps'])
                    }
                )
            except Exception as e:
                logger.error(f"Failed to store gap analysis memory: {e}")

            # Clear the deep_research_prompt - it should only be generated when user confirms gaps
            result_dict['deep_research_prompt'] = ""

            return result_dict

        except Exception as e:
            logger.error(f"Gap analysis failed: {e}", exc_info=True)
            raise e

    async def generate_deep_research_prompt(
        self,
        confirmed_gaps: List[str],
        proposal_context: Dict[str, Any],
        user_id: str
    ) -> Dict[str, Any]:
        """
        Generate a deep research prompt from user-confirmed gaps.
        This is called AFTER user confirms gaps, not during initial analysis.

        Args:
            confirmed_gaps: List of gaps confirmed by the user
            proposal_context: Context about the proposal including industry, service_types,
                            technologies, and requirements_met
            user_id: Current user ID for memory operations

        Returns:
            Dict containing the generated deep_research_prompt
        """
        logger.info(f"Generating deep research prompt for {len(confirmed_gaps)} confirmed gaps")

        # Collect entity names for sanitization
        entity_names = [
            proposal_context.get('entity_name', ''),
            proposal_context.get('client_name', ''),
            proposal_context.get('organization', ''),
        ]
        entity_names = [e for e in entity_names if e]

        # Build requirements met context
        requirements_met = proposal_context.get('requirements_met', [])
        requirements_context = ""
        if requirements_met:
            requirements_context = "\n".join([f"- {req}" for req in requirements_met])

        # Build gaps context
        gaps_context = "\n".join([f"{i+1}. {gap}" for i, gap in enumerate(confirmed_gaps)])

        # Build service types and technologies context
        service_types = proposal_context.get('service_types', [])
        technologies = proposal_context.get('technologies', [])

        prompt = f"""
        You are an expert at crafting research prompts for deep industry research.

        Your task is to generate a comprehensive, well-structured research prompt that will be used
        to conduct deep research on knowledge gaps for a proposal.

        CONTEXT:
        - Industry: {proposal_context.get('industry', 'Not specified')}
        - Service Focus: {', '.join(service_types) if service_types else 'Not specified'}
        - Technology Stack: {', '.join(technologies) if technologies else 'Not specified'}

        REQUIREMENTS ALREADY ADDRESSED:
        {requirements_context or 'No specific requirements addressed yet'}

        KNOWLEDGE GAPS REQUIRING RESEARCH:
        {gaps_context}

        INSTRUCTIONS:
        Generate a comprehensive research prompt following these rules:

        1. STRUCTURE: Include these sections:
           - Role definition (e.g., "You are a senior [industry] consultant...")
           - Industry Context (domain, service focus, technology stack)
           - Requirements Already Addressed (what's covered)
           - Knowledge Gaps Requiring Research (numbered list)
           - Research Objectives (what to focus on)

        2. PRIVACY RULES (CRITICAL):
           - DO NOT include any company names, client names, or entity names
           - DO NOT include any email addresses, phone numbers, or personal information
           - Use generic industry terms instead of specific company references

        3. FOCUS AREAS:
           - Industry best practices and standards
           - Regulatory requirements and compliance frameworks
           - Implementation methodologies and patterns
           - Case studies and benchmarks where applicable

        4. OUTPUT:
           - Make the prompt actionable and specific
           - Focus on gathering information that can be incorporated into a proposal
           - Ensure the prompt is comprehensive but concise

        Return ONLY the research prompt text, nothing else.
        """

        try:
            result = await self.llm_service.generate_text(
                prompt=prompt,
                model=settings.LLM_MODEL_SMART
            )

            # Sanitize the result to remove any entity names that may have slipped through
            sanitized_prompt = self._sanitize_text(result, entity_names)

            return {
                "deep_research_prompt": sanitized_prompt,
                "confirmed_gaps": confirmed_gaps,
                "prompt_status": "generated"
            }

        except Exception as e:
            logger.error(f"Failed to generate deep research prompt: {e}", exc_info=True)
            raise e

    async def regenerate_deep_research_prompt(
        self,
        original_prompt: str,
        user_feedback: str,
        confirmed_gaps: List[str],
        proposal_context: Dict[str, Any],
        user_id: str
    ) -> Dict[str, Any]:
        """
        Regenerate the deep research prompt based on user feedback.
        Incorporates user feedback while maintaining best practices structure.

        Args:
            original_prompt: The original generated prompt
            user_feedback: User's feedback on what to change
            confirmed_gaps: List of gaps confirmed by the user
            proposal_context: Context about the proposal
            user_id: Current user ID for memory operations

        Returns:
            Dict containing the regenerated deep_research_prompt
        """
        logger.info(f"Regenerating deep research prompt with user feedback")

        # Collect entity names for sanitization
        entity_names = [
            proposal_context.get('entity_name', ''),
            proposal_context.get('client_name', ''),
            proposal_context.get('organization', ''),
        ]
        entity_names = [e for e in entity_names if e]

        # Sanitize user feedback in case they included entity names
        sanitized_feedback = self._sanitize_text(user_feedback, entity_names)

        prompt = f"""
        You are an expert at crafting research prompts for deep industry research.

        Your task is to REGENERATE a research prompt based on user feedback while maintaining
        best practices and proper structure.

        ORIGINAL PROMPT:
        {original_prompt}

        USER FEEDBACK:
        {sanitized_feedback}

        CONTEXT:
        - Industry: {proposal_context.get('industry', 'Not specified')}
        - Confirmed Gaps: {', '.join(confirmed_gaps)}

        INSTRUCTIONS:
        1. Incorporate the user's feedback into the regenerated prompt
        2. MAINTAIN the best practice structure:
           - Role definition
           - Industry Context
           - Requirements Already Addressed
           - Knowledge Gaps Requiring Research
           - Research Objectives

        3. PRIVACY RULES (CRITICAL):
           - DO NOT include any company names, client names, or entity names
           - DO NOT include any email addresses, phone numbers, or personal information
           - Use generic industry terms instead of specific company references
           - Even if user feedback mentions specific companies, DO NOT include them

        4. Ensure the prompt remains actionable and focused on proposal-relevant research

        Return ONLY the regenerated research prompt text, nothing else.
        """

        try:
            result = await self.llm_service.generate_text(
                prompt=prompt,
                model=settings.LLM_MODEL_SMART
            )

            # Sanitize the result to remove any entity names
            sanitized_prompt = self._sanitize_text(result, entity_names)

            return {
                "deep_research_prompt": sanitized_prompt,
                "confirmed_gaps": confirmed_gaps,
                "prompt_status": "regenerated",
                "user_feedback": sanitized_feedback
            }

        except Exception as e:
            logger.error(f"Failed to regenerate deep research prompt: {e}", exc_info=True)
            raise e
