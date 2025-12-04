"""
Document Generation Agent - Agent 5

Takes synthesis output and generates .pptx or .docx documents using Claude Agent Skills.

This agent invokes Claude's built-in document generation skills (pptx, docx) through
the code execution container to create formatted documents from structured outline data.

Input: Synthesis Agent output (outline JSON with sections, bullets, citations)
Output: Generated document file (binary content)

Performance Target: ~30-60 seconds
"""
import json
import os
import time
import re
import hashlib
from enum import Enum
from typing import Optional
from dataclasses import dataclass, field

import anthropic
import structlog

from app.core.exceptions import ValidationError
from app.services.agents.token_tracking import calculate_cost, log_token_usage
from app.services.memory.short_term import ShortTermMemoryService
from app.services.memory.long_term import LongTermMemoryService
from app.services.memory.episodic import EpisodicMemoryService
from app.schemas.stage_review import PipelineStage

logger = structlog.get_logger(__name__)


class DocumentGenerationMemory:
    """Memory services for Document Generation Agent.

    Memory Types:
    - Short-term (Redis): Current session context, format preferences, user corrections
    - Long-term (PostgreSQL): Successful document patterns, preferred styling
    - Episodic (ChromaDB): Past document outputs with quality scores
    """

    def __init__(
        self,
        redis_url: str = "redis://localhost:6379/0",
        database_url: Optional[str] = None,
        chroma_persist_dir: str = "./chroma_data"
    ):
        self.short_term = ShortTermMemoryService(redis_url)
        self.long_term = LongTermMemoryService(
            database_url or os.getenv("DATABASE_URL", "postgresql+asyncpg://localhost/pursuit_db")
        )
        self.episodic = EpisodicMemoryService(
            persist_directory=chroma_persist_dir,
            collection_name="document_generation_episodes"
        )

    # Short-term memory methods
    async def store_session_context(self, session_id: str, context: dict) -> None:
        """Store current document generation context in session."""
        await self.short_term.store(
            session_id=session_id,
            key="document_gen_context",
            value=context,
            ttl=3600
        )

    async def get_session_context(self, session_id: str) -> dict:
        """Get current session context for document generation."""
        context = await self.short_term.retrieve(session_id, "document_gen_context")
        return context or {}

    async def store_format_preference(self, session_id: str, format_pref: dict) -> None:
        """Store user's format preferences for the session."""
        await self.short_term.store(
            session_id=session_id,
            key="format_preference",
            value=format_pref,
            ttl=7200
        )

    async def get_format_preference(self, session_id: str) -> dict:
        """Get user's format preferences."""
        pref = await self.short_term.retrieve(session_id, "format_preference")
        return pref or {}

    async def store_user_correction(self, session_id: str, correction: dict) -> None:
        """Store a user correction for document styling."""
        await self.short_term.store(
            session_id=session_id,
            key=f"correction:{correction.get('type', 'general')}",
            value=correction,
            ttl=3600
        )

    # Long-term memory methods
    async def get_successful_patterns(self, industry: str, doc_format: str) -> list[dict]:
        """Get successful document patterns for industry and format."""
        patterns = await self.long_term.retrieve_patterns(
            pattern_type="document_pattern",
            filters={"industry": industry, "format": doc_format}
        )
        return patterns

    async def get_preferred_styling(self, industry: str, doc_format: str) -> dict:
        """Get preferred styling for industry and document format."""
        key = f"styling:{industry}:{doc_format}"
        result = await self.long_term.retrieve(key)
        return result.value if result else {}

    async def store_successful_pattern(
        self,
        industry: str,
        doc_format: str,
        pattern: dict,
        quality_score: float
    ) -> None:
        """Store a successful document pattern."""
        await self.long_term.store_pattern(
            pattern_type="document_pattern",
            pattern={
                "industry": industry,
                "format": doc_format,
                "pattern": pattern,
                "quality_score": quality_score
            }
        )

    # Episodic memory methods
    async def store_generation_episode(
        self,
        pursuit_id: str,
        file_name: str,
        doc_format: str,
        metadata: dict,
        quality_score: float
    ) -> None:
        """Store a document generation episode for future learning."""
        episode_id = hashlib.md5(f"{pursuit_id}:{doc_format}:{time.time()}".encode()).hexdigest()

        # Create searchable content
        content_parts = [
            metadata.get("entity_name", ""),
            metadata.get("industry", ""),
            doc_format,
            " ".join(metadata.get("section_names", []))
        ]

        await self.episodic.store(
            memory_id=episode_id,
            content=" ".join(content_parts),
            metadata={
                "pursuit_id": pursuit_id,
                "industry": metadata.get("industry", ""),
                "format": doc_format,
                "sections_count": metadata.get("sections_created", 0),
                "gaps_count": metadata.get("gaps_marked", 0),
                "quality_score": quality_score,
                "timestamp": time.time()
            },
            value={
                "file_name": file_name,
                "format": doc_format,
                "section_names": metadata.get("section_names", []),
                "bullets_created": metadata.get("bullets_created", 0),
                "quality_score": quality_score
            }
        )

    async def get_similar_documents(self, content: str, doc_format: str, n_results: int = 3) -> list[dict]:
        """Get similar past document generation episodes."""
        results = await self.episodic.search(
            query=content,
            n_results=n_results,
            filter_metadata={"format": doc_format, "quality_score": {"$gte": 0.7}}
        )
        return results

    async def update_document_quality(
        self,
        pursuit_id: str,
        quality_score: float,
        feedback: Optional[str] = None
    ) -> None:
        """Update quality score for a document generation episode based on user feedback."""
        results = await self.episodic.search(
            query=pursuit_id,
            n_results=1,
            filter_metadata={"pursuit_id": pursuit_id}
        )

        if results:
            episode = results[0]
            value = episode.get("value", {})
            value["quality_score"] = quality_score
            value["feedback"] = feedback

            await self.episodic.store(
                memory_id=episode.get("key", episode.get("id", "")),
                content=episode.get("content", ""),
                metadata={
                    **episode.get("metadata", {}),
                    "quality_score": quality_score
                },
                value=value
            )


class DocumentFormat(str, Enum):
    """Supported document output formats."""
    PPTX = "pptx"
    DOCX = "docx"


@dataclass
class DocumentGenerationResult:
    """Result from document generation agent."""
    file_content: bytes
    file_format: str
    file_name: str
    file_id: str

    # Document metrics
    sections_created: int
    bullets_created: int
    subtitles_included: int
    gaps_marked: int
    slide_count: int  # For PPTX only

    # Content
    title_text: str
    section_names: list[str]

    # Performance
    processing_time_ms: int

    # Token usage
    input_tokens: int = 0
    output_tokens: int = 0
    estimated_cost_usd: float = 0.0


# =============================================================================
# HITL Helper Functions
# =============================================================================


def extract_synthesis_from_review(reviewed_output: Optional[dict]) -> Optional[dict]:
    """
    Extract outline from human-reviewed synthesis output.

    Args:
        reviewed_output: The corrected output from EditTrackingMemory

    Returns:
        The outline dict if present, None otherwise
    """
    if not reviewed_output:
        return None

    outline = reviewed_output.get("outline")
    return outline if outline else None


def merge_synthesis_output(
    original: dict,
    corrected_outline: Optional[dict]
) -> dict:
    """
    Merge original synthesis output with corrected outline.

    Args:
        original: Original synthesis output
        corrected_outline: Corrected outline from human review

    Returns:
        Merged synthesis output with corrected outline if available
    """
    merged = original.copy()

    if corrected_outline:
        merged["outline"] = corrected_outline

    return merged


async def apply_synthesis_corrections(
    synthesis_output: dict,
    edit_tracking: Optional[any],
    pursuit_id: Optional[str]
) -> dict:
    """
    Apply human corrections to synthesis output if available.

    Args:
        synthesis_output: Original synthesis output
        edit_tracking: EditTrackingMemory service instance
        pursuit_id: Current pursuit ID

    Returns:
        Corrected synthesis output if review exists, original otherwise
    """
    if not edit_tracking or not pursuit_id:
        return synthesis_output

    has_review = await edit_tracking.has_review(
        pursuit_id=pursuit_id,
        stage=PipelineStage.synthesis
    )

    if not has_review:
        return synthesis_output

    corrected_output = await edit_tracking.get_corrected_output(
        pursuit_id=pursuit_id,
        stage=PipelineStage.synthesis
    )

    if not corrected_output:
        return synthesis_output

    corrected_outline = extract_synthesis_from_review(corrected_output)
    effective_synthesis = merge_synthesis_output(synthesis_output, corrected_outline)

    logger.info(
        "using_human_reviewed_synthesis",
        pursuit_id=pursuit_id,
        has_corrected_outline=corrected_outline is not None,
        original_sections=len(synthesis_output.get("outline", {}).get("sections", [])),
        corrected_sections=len(corrected_outline.get("sections", [])) if corrected_outline else 0
    )

    return effective_synthesis


# =============================================================================
# Validation Functions
# =============================================================================


def _validate_synthesis_output(synthesis_output: dict) -> None:
    """Validate that synthesis output has required structure."""
    if not synthesis_output:
        raise ValidationError("Empty synthesis output provided")

    if "outline" not in synthesis_output:
        raise ValidationError("Synthesis output missing 'outline' field")

    outline = synthesis_output.get("outline", {})
    if "sections" not in outline:
        raise ValidationError("Synthesis output outline missing 'sections' field")

    sections = outline.get("sections", [])
    if not sections:
        raise ValidationError("Synthesis output has no sections")


def _validate_pursuit_metadata(metadata: dict) -> None:
    """Validate that pursuit metadata has required fields."""
    if not metadata:
        raise ValidationError("Empty pursuit metadata provided")

    required_fields = ["entity_name"]
    missing = [f for f in required_fields if not metadata.get(f)]

    if missing:
        raise ValidationError(f"Pursuit metadata missing required fields: {missing}")


def _sanitize_filename(name: str) -> str:
    """Sanitize entity name for use in filename."""
    # Replace spaces and special chars with underscores
    sanitized = re.sub(r'[^\w\s-]', '', name)
    sanitized = re.sub(r'[\s-]+', '_', sanitized)
    return sanitized


def _build_document_prompt(
    synthesis_output: dict,
    metadata: dict,
    output_format: DocumentFormat,
    memory_context: str = ""
) -> str:
    """Build the prompt for Claude to generate the document."""

    entity_name = metadata.get("entity_name", "Proposal")
    industry = metadata.get("industry", "")
    service_types = metadata.get("service_types", [])

    outline = synthesis_output.get("outline", {})
    sections = outline.get("sections", [])
    citations = synthesis_output.get("citations", [])

    # Build section content
    sections_text = []
    for section in sections:
        heading = section.get("heading", "")
        subtitle = section.get("subtitle", "")
        bullets = section.get("bullets", [])

        section_text = f"\n## {heading}"
        if subtitle:
            section_text += f"\n*{subtitle}*"

        for bullet in bullets:
            text = bullet.get("text", "")
            is_gap = bullet.get("is_gap", False)

            if is_gap:
                section_text += f"\n- [GAP] {text}"
            else:
                section_text += f"\n- {text}"

        sections_text.append(section_text)

    outline_content = "\n".join(sections_text)

    if output_format == DocumentFormat.PPTX:
        format_instructions = """
Create a PowerPoint presentation with the following requirements:
- First slide: Title slide with the entity name and "Proposal Response" as subtitle
- Each section heading becomes a new slide title
- Section subtitle becomes the slide subtitle
- Bullets become the slide content (bullet points)
- Mark any [GAP] items with yellow highlighting or a marker
- Use a professional, clean design
- Add slide numbers
"""
    else:  # DOCX
        format_instructions = """
Create a Word document with the following requirements:
- Title page with the entity name
- Table of contents
- Each section heading as Heading 1
- Section subtitle as italic text below heading
- Bullets as bullet point lists
- Mark any [GAP] items with yellow highlighting
- Use professional formatting
- Add page numbers
"""

    # Add memory context if available
    memory_section = ""
    if memory_context:
        memory_section = f"""
## Learning from Past Documents
{memory_context}

Apply any relevant styling preferences and patterns from successful past documents.
"""

    prompt = f"""
Create a {output_format.value} document for: {entity_name}
Industry: {industry}
Services: {', '.join(service_types) if service_types else 'N/A'}

{format_instructions}
{memory_section}
Document Content:
{outline_content}

Generate the document now. Make sure all sections and bullets are included.
"""

    return prompt


def _extract_file_id(response) -> Optional[str]:
    """Extract file ID from Claude API response."""
    for block in response.content:
        # Check for bash/code execution result blocks
        if hasattr(block, 'content'):
            content = block.content

            # Content could be an object with a nested content list
            # e.g., BetaBashCodeExecutionResultBlock has content.content = [{'file_id': ..., 'type': 'bash_code_execution_output'}]
            if hasattr(content, 'content'):
                nested_content = content.content
                if isinstance(nested_content, list):
                    for item in nested_content:
                        # Item could be a dict or object
                        if isinstance(item, dict):
                            if 'file_id' in item:
                                return item['file_id']
                        elif hasattr(item, 'file_id'):
                            return item.file_id

            # Content could be a direct list
            if isinstance(content, list):
                for item in content:
                    if isinstance(item, dict) and 'file_id' in item:
                        return item['file_id']
                    if hasattr(item, 'file_id'):
                        return item.file_id

        # Direct file_id on block
        if hasattr(block, 'file_id'):
            return block.file_id

    return None


def _count_document_elements(synthesis_output: dict) -> tuple[int, int, int, int, list[str]]:
    """Count sections, bullets, subtitles, and gaps in synthesis output."""
    outline = synthesis_output.get("outline", {})
    sections = outline.get("sections", [])

    section_count = len(sections)
    bullet_count = 0
    subtitle_count = 0
    gap_count = 0
    section_names = []

    for section in sections:
        section_names.append(section.get("heading", ""))

        if section.get("subtitle"):
            subtitle_count += 1

        bullets = section.get("bullets", [])
        bullet_count += len(bullets)

        for bullet in bullets:
            if bullet.get("is_gap", False):
                gap_count += 1

    return section_count, bullet_count, subtitle_count, gap_count, section_names


async def document_generation_agent(
    synthesis_output: dict,
    pursuit_metadata: dict,
    output_format: Optional[DocumentFormat] = None,
    memory: Optional[DocumentGenerationMemory] = None,
    session_id: Optional[str] = None,
    pursuit_id: Optional[str] = None,
    edit_tracking: Optional[any] = None
) -> DocumentGenerationResult:
    """
    Generate a document from synthesis output using Claude Agent Skills.

    Args:
        synthesis_output: Output from Synthesis Agent (outline with sections/bullets)
        pursuit_metadata: Pursuit metadata (entity name, format preference, etc.)
        output_format: Explicit format override (pptx or docx)
        memory: Optional memory services for learning from past documents
        session_id: Optional session ID for short-term memory
        pursuit_id: Optional pursuit ID for episodic memory
        edit_tracking: Optional EditTrackingMemory for HITL corrections

    Returns:
        DocumentGenerationResult with file content and metrics

    Raises:
        ValidationError: If inputs are invalid
        Exception: If document generation fails
    """
    start_time = time.time()

    # HITL Integration: Apply human corrections from synthesis stage
    effective_synthesis = await apply_synthesis_corrections(
        synthesis_output, edit_tracking, pursuit_id
    )

    # Validate inputs (use effective synthesis after HITL corrections)
    _validate_synthesis_output(effective_synthesis)
    _validate_pursuit_metadata(pursuit_metadata)

    # Memory context variables
    memory_context = ""
    similar_docs = []
    styling_prefs = {}

    # Load memory context if available
    if memory and session_id:
        try:
            industry = pursuit_metadata.get("industry", "")

            # Get session context
            session_context = await memory.get_session_context(session_id)

            # Get format preferences
            format_prefs = await memory.get_format_preference(session_id)

            # Get similar past documents
            entity_name = pursuit_metadata.get("entity_name", "")
            search_content = f"{entity_name} {industry}"

            # Determine format for search
            format_str = output_format.value if output_format else pursuit_metadata.get("expected_format", "pptx")
            similar_docs = await memory.get_similar_documents(search_content, format_str, n_results=3)

            # Get preferred styling
            styling_prefs = await memory.get_preferred_styling(industry, format_str)

            # Get successful patterns
            patterns = await memory.get_successful_patterns(industry, format_str)

            # Build memory context for prompt
            if similar_docs or styling_prefs or patterns or format_prefs:
                memory_parts = []

                if format_prefs:
                    memory_parts.append(f"User format preferences: {json.dumps(format_prefs)}")

                if styling_prefs:
                    memory_parts.append(f"Industry styling preferences: {json.dumps(styling_prefs)}")

                if similar_docs:
                    doc_summaries = []
                    for doc in similar_docs[:3]:
                        value = doc.get("value", {})
                        doc_summaries.append({
                            "format": value.get("format"),
                            "sections": value.get("section_names", []),
                            "quality_score": value.get("quality_score", 0)
                        })
                    memory_parts.append(f"Similar successful documents: {json.dumps(doc_summaries)}")

                if patterns:
                    pattern_summaries = [p.get("pattern", {}) for p in patterns[:2]]
                    memory_parts.append(f"Successful patterns: {json.dumps(pattern_summaries)}")

                memory_context = "\n".join(memory_parts)

            logger.info(
                "Loaded memory context",
                session_id=session_id,
                similar_docs=len(similar_docs),
                has_styling=bool(styling_prefs)
            )
        except Exception as e:
            logger.warning(
                "Failed to load memory context",
                error=str(e)
            )
            memory_context = ""

    # Determine output format
    if output_format is None:
        format_str = pursuit_metadata.get("expected_format", "pptx").lower()
        try:
            output_format = DocumentFormat(format_str)
        except ValueError:
            output_format = DocumentFormat.PPTX
    elif isinstance(output_format, str):
        try:
            output_format = DocumentFormat(output_format.lower())
        except ValueError:
            raise ValueError(f"Invalid output format: {output_format}")

    # Count elements for metrics (use effective synthesis after HITL corrections)
    section_count, bullet_count, subtitle_count, gap_count, section_names = \
        _count_document_elements(effective_synthesis)

    entity_name = pursuit_metadata.get("entity_name", "Proposal")

    logger.info(
        "Starting document generation",
        entity_name=entity_name,
        format=output_format.value,
        sections=section_count,
        bullets=bullet_count
    )

    # Build prompt (use effective synthesis after HITL corrections)
    prompt = _build_document_prompt(effective_synthesis, pursuit_metadata, output_format, memory_context)

    # Call Claude API with Skills
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    try:
        response = client.beta.messages.create(
            model="claude-sonnet-4-5-20250929",
            max_tokens=16384,  # Increased to ensure code execution completes
            betas=["code-execution-2025-08-25", "skills-2025-10-02"],
            container={
                "skills": [{
                    "type": "anthropic",
                    "skill_id": output_format.value,
                    "version": "latest"
                }]
            },
            tools=[{
                "type": "code_execution_20250825",
                "name": "code_execution"
            }],
            messages=[{
                "role": "user",
                "content": prompt
            }]
        )

        # Extract file ID from response
        file_id = _extract_file_id(response)

        if not file_id:
            raise Exception("No file ID returned from document generation")

        # Extract token usage
        input_tokens = response.usage.input_tokens
        output_tokens = response.usage.output_tokens
        estimated_cost = calculate_cost(input_tokens, output_tokens)

        # Log token usage
        log_token_usage(
            agent_name="document_generation",
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            pursuit_id=None
        )

        logger.info(
            "Document generated, retrieving file",
            file_id=file_id
        )

        # Retrieve file content
        # The beta files API uses download() method which returns BinaryAPIResponse
        file_response = client.beta.files.download(file_id)
        file_content = file_response.read()

        # Generate filename
        sanitized_name = _sanitize_filename(entity_name)
        timestamp = time.strftime("%Y%m%d_%H%M%S")
        file_name = f"{sanitized_name}_Proposal_{timestamp}.{output_format.value}"

        # Calculate processing time
        processing_time_ms = int((time.time() - start_time) * 1000)

        # Estimate slide count for PPTX (sections + title slide)
        slide_count = section_count + 1 if output_format == DocumentFormat.PPTX else 0

        logger.info(
            "Document generation complete",
            file_name=file_name,
            processing_time_ms=processing_time_ms
        )

        # Store episode in memory for learning
        if memory and pursuit_id:
            try:
                await memory.store_generation_episode(
                    pursuit_id=pursuit_id,
                    file_name=file_name,
                    doc_format=output_format.value,
                    metadata={
                        "entity_name": entity_name,
                        "industry": pursuit_metadata.get("industry", ""),
                        "sections_created": section_count,
                        "bullets_created": bullet_count,
                        "gaps_marked": gap_count,
                        "section_names": section_names
                    },
                    quality_score=0.8  # Default score, can be updated later
                )
                logger.info(
                    "Stored document generation episode",
                    pursuit_id=pursuit_id
                )
            except Exception as e:
                logger.warning(
                    "Failed to store generation episode",
                    error=str(e)
                )

        return DocumentGenerationResult(
            file_content=file_content,
            file_format=output_format.value,
            file_name=file_name,
            file_id=file_id,
            sections_created=section_count,
            bullets_created=bullet_count,
            subtitles_included=subtitle_count,
            gaps_marked=gap_count,
            slide_count=slide_count,
            title_text=entity_name,
            section_names=section_names,
            processing_time_ms=processing_time_ms,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            estimated_cost_usd=estimated_cost
        )

    except anthropic.APIError as e:
        logger.error(
            "Claude API error during document generation",
            error=str(e)
        )
        raise
    except Exception as e:
        logger.error(
            "Document generation failed",
            error=str(e)
        )
        raise
