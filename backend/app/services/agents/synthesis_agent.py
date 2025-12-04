"""
Synthesis Agent

Combines gap analysis results, research findings, and reference content
into a structured proposal outline with citations.

Memory Types Used:
- Short-term (Redis): Current synthesis context, user refinements
- Long-term (PostgreSQL): Successful outline patterns, preferred phrasing
- Episodic (ChromaDB): Past synthesis outputs with user feedback scores
"""

import os
import re
import time
import json
import uuid
import hashlib
import asyncio
from typing import TypedDict, Any, Optional, AsyncGenerator, Union
from functools import lru_cache

import anthropic
from anthropic import AsyncAnthropic
import structlog

logger = structlog.get_logger(__name__)

from app.core.exceptions import ValidationError
from app.services.memory.short_term import ShortTermMemoryService
from app.services.memory.long_term import LongTermMemoryService
from app.services.memory.episodic import EpisodicMemoryService
from app.services.agents.token_tracking import calculate_cost, log_token_usage
from app.schemas.stage_review import PipelineStage


# Constants
MODEL_NAME = "claude-sonnet-4-5-20250929"
MAX_TOKENS = 16384  # Larger for outline generation
MAX_SYNTHESIS_TIME_MS = 90000  # 90 seconds target

# Optimization constants
MAX_INPUT_TOKENS_TARGET = 12000  # Target max input tokens to avoid slow responses
MAX_REFERENCE_CONTENT_CHARS = 300  # Reduced from 500 for faster processing
MAX_REFERENCE_PURSUITS = 5  # Limit number of reference pursuits
MAX_COVERAGE_ITEMS = 8  # Limit coverage matrix items in prompt
MAX_RESEARCH_FINDINGS = 5  # Limit research findings in prompt
MAX_BULLETS_PER_FINDING = 2  # Limit extracted info per finding


# =============================================================================
# HITL Helper Functions
# =============================================================================


def extract_research_from_review(reviewed_output: Optional[dict]) -> tuple[list[dict], list[dict]]:
    """
    Extract findings and sources from a human-reviewed research output.

    Args:
        reviewed_output: The corrected output from EditTrackingMemory.get_corrected_output()

    Returns:
        Tuple of (findings list, sources list)
    """
    if not reviewed_output:
        return [], []

    findings = reviewed_output.get("findings", [])
    sources = reviewed_output.get("sources", [])

    return findings, sources


def merge_research_findings(
    original: dict,
    corrected_findings: Optional[list[dict]],
    corrected_sources: Optional[list[dict]]
) -> dict:
    """
    Merge corrected research findings with original.

    Corrected findings/sources override original values. Other fields from original
    are preserved.

    Args:
        original: Original research findings dict
        corrected_findings: Corrected findings list (may be None or empty)
        corrected_sources: Corrected sources list (may be None or empty)

    Returns:
        Merged research findings dict
    """
    merged = original.copy()

    # Use corrected findings if provided and non-empty
    if corrected_findings:
        merged["findings"] = corrected_findings

    # Use corrected sources if provided and non-empty
    if corrected_sources:
        merged["sources"] = corrected_sources

    return merged


async def apply_research_corrections(
    research_findings: dict,
    edit_tracking: Optional[Any],
    pursuit_id: Optional[str],
) -> dict:
    """
    Apply human-reviewed corrections to research findings.

    Checks EditTrackingMemory for a reviewed research output and merges
    any corrections with the original findings.

    Args:
        research_findings: Original research findings from Research Agent
        edit_tracking: EditTrackingMemory instance (optional)
        pursuit_id: Pursuit ID for lookup (optional)

    Returns:
        Research findings with human corrections applied (if any)
    """
    if not edit_tracking or not pursuit_id:
        return research_findings

    has_review = await edit_tracking.has_review(
        pursuit_id=pursuit_id,
        stage=PipelineStage.research,
    )

    if not has_review:
        return research_findings

    corrected_output = await edit_tracking.get_corrected_output(
        pursuit_id=pursuit_id,
        stage=PipelineStage.research,
    )

    if not corrected_output:
        return research_findings

    corrected_findings, corrected_sources = extract_research_from_review(corrected_output)
    effective_research = merge_research_findings(
        research_findings, corrected_findings, corrected_sources
    )

    logger.info(
        "using_human_reviewed_research",
        pursuit_id=pursuit_id,
        original_findings_count=len(research_findings.get("findings", [])),
        corrected_findings_count=len(corrected_findings) if corrected_findings else 0,
    )

    return effective_research


# =============================================================================
# Performance Optimization Helpers
# =============================================================================


async def _fetch_memory_context_parallel(
    memory: "SynthesisMemory",
    metadata: dict,
    selected_components: Optional[list[str]] = None,
) -> tuple[list[dict], dict]:
    """
    Fetch all memory context in parallel for faster performance.

    Instead of sequential await calls, this fetches patterns and phrasing
    concurrently using asyncio.gather.

    Args:
        memory: SynthesisMemory instance
        metadata: Pursuit metadata
        selected_components: Optional list of selected components

    Returns:
        Tuple of (successful_patterns, preferred_phrasing dict)
    """
    industry = metadata.get("industry", "")
    service_types = metadata.get("service_types", [])

    # Build list of coroutines to run in parallel
    coros = [memory.get_successful_patterns(industry, service_types)]

    # Add phrasing lookups
    phrasing_keys = ["structure"]  # Always get structure
    if selected_components:
        phrasing_keys.extend(selected_components[:3])  # Top 3 components

    for key in phrasing_keys:
        coros.append(memory.get_preferred_phrasing(industry, key))

    # Run all memory lookups in parallel
    results = await asyncio.gather(*coros, return_exceptions=True)

    # Extract patterns (first result)
    successful_patterns = []
    if not isinstance(results[0], Exception):
        successful_patterns = results[0] or []

    # Extract phrasing (remaining results)
    preferred_phrasing = {}
    for i, key in enumerate(phrasing_keys):
        result = results[i + 1]
        if not isinstance(result, Exception) and result:
            if key == "structure":
                preferred_phrasing["_global_structure"] = result
            else:
                preferred_phrasing[key] = result

    return successful_patterns, preferred_phrasing


def _estimate_token_count(text: str) -> int:
    """
    Rough estimate of token count for a text string.

    Uses ~4 characters per token as approximation.
    """
    return len(text) // 4


# Simple in-memory cache for prompt templates (shared across requests)
_prompt_cache: dict[str, str] = {}
_cache_max_size = 50


def _get_cached_prompt_key(
    metadata_hash: str,
    components_hash: str,
    coverage_hash: str,
) -> str:
    """Generate a cache key for prompt components."""
    return f"{metadata_hash}:{components_hash}:{coverage_hash}"


def _hash_dict(d: dict) -> str:
    """Create a simple hash of a dict for cache keys."""
    return hashlib.md5(json.dumps(d, sort_keys=True, default=str).encode()).hexdigest()[:12]


def _hash_list(lst: list) -> str:
    """Create a simple hash of a list for cache keys."""
    return hashlib.md5(json.dumps(lst, sort_keys=True, default=str).encode()).hexdigest()[:12]


def _truncate_to_token_limit(text: str, max_tokens: int) -> str:
    """Truncate text to approximately fit within token limit."""
    max_chars = max_tokens * 4
    if len(text) <= max_chars:
        return text
    return text[:max_chars - 3] + "..."


class Citation(TypedDict):
    """Citation for a piece of content."""
    id: str
    source_type: str  # "past_pursuit", "web", "synthesized"
    pursuit_id: Optional[str]
    pursuit_name: Optional[str]
    url: Optional[str]
    title: Optional[str]
    section: Optional[str]


class OutlineBullet(TypedDict):
    """A single bullet point in the outline."""
    id: str
    text: str
    order: int
    is_gap: bool
    gap_explanation: Optional[str]
    citations: list[Citation]


class OutlineSection(TypedDict):
    """A section in the proposal outline."""
    id: str
    heading: str
    subtitle: Optional[str]
    order: int
    bullets: list[OutlineBullet]


class OutlineMetadata(TypedDict):
    """Metadata about the generated outline."""
    generated_at: str
    total_sections: int
    total_gaps: int
    agents_used: list[str]


class Outline(TypedDict):
    """The complete proposal outline."""
    sections: list[OutlineSection]
    metadata: OutlineMetadata


class SynthesisResult(TypedDict):
    """Complete result from synthesis agent."""
    outline: Outline
    processing_time_ms: int
    input_tokens: int
    output_tokens: int
    estimated_cost_usd: float


class StreamChunk(TypedDict):
    """A chunk of streaming output."""
    type: str  # "thinking", "section", "bullet", "done"
    content: Optional[Any]
    outline: Optional[Outline]


class SynthesisMemory:
    """Memory services for Synthesis Agent.

    Memory Types:
    - Short-term (Redis): Current synthesis context, user refinements
    - Long-term (PostgreSQL): Successful outline patterns, preferred phrasing
    - Episodic (ChromaDB): Past synthesis outputs with user feedback scores
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
            collection_name="synthesis_episodes"
        )

    # Short-term memory methods
    async def store_current_context(self, session_id: str, context: dict) -> None:
        """Store current synthesis context in session."""
        await self.short_term.store(
            session_id=session_id,
            key="synthesis_context",
            value=context,
            ttl=3600
        )

    async def get_session_context(self, session_id: str) -> dict:
        """Get current session context for synthesis."""
        context = await self.short_term.retrieve(session_id, "synthesis_context")
        return context or {}

    async def store_user_refinement(self, session_id: str, refinement: dict) -> None:
        """Store user refinement request."""
        await self.short_term.store(
            session_id=session_id,
            key="user_refinement",
            value=refinement,
            ttl=600
        )

    # Long-term memory methods
    async def get_successful_patterns(self, industry: str, service_types: list) -> list[dict]:
        """Get successful outline patterns for industry/service."""
        patterns = await self.long_term.retrieve_patterns(
            pattern_type="outline_pattern",
            filters={"industry": industry}
        )
        return patterns

    async def get_preferred_phrasing(self, industry: str, section_type: str) -> dict:
        """Get preferred phrasing for industry and section type."""
        key = f"phrasing:{industry}:{section_type}"
        result = await self.long_term.retrieve(key)
        return result.value if result else {}

    async def store_successful_pattern(
        self,
        industry: str,
        service_types: list,
        pattern: dict,
        quality_score: float
    ) -> None:
        """Store a successful outline pattern."""
        await self.long_term.store_pattern(
            pattern_type="outline_pattern",
            pattern={
                "industry": industry,
                "service_types": service_types,
                "pattern": pattern,
                "quality_score": quality_score
            }
        )

    # Episodic memory methods
    async def store_synthesis_episode(
        self,
        pursuit_id: str,
        outline: Outline,
        metadata: dict,
        quality_score: float
    ) -> None:
        """Store a synthesis episode for future learning."""
        episode_id = hashlib.md5(f"{pursuit_id}:{time.time()}".encode()).hexdigest()

        # Create searchable content from outline
        content_parts = []
        for section in outline["sections"]:
            content_parts.append(section["heading"])
            for bullet in section["bullets"]:
                content_parts.append(bullet["text"][:200])

        await self.episodic.store(
            memory_id=episode_id,
            content=" ".join(content_parts),
            metadata={
                "pursuit_id": pursuit_id,
                "industry": metadata.get("industry", ""),
                "section_count": len(outline["sections"]),
                "gap_count": outline["metadata"]["total_gaps"],
                "quality_score": quality_score,
                "timestamp": time.time()
            },
            value={
                "outline_summary": {
                    "sections": [s["heading"] for s in outline["sections"]],
                    "total_bullets": sum(len(s["bullets"]) for s in outline["sections"])
                },
                "quality_score": quality_score
            }
        )

    async def get_similar_syntheses(self, content: str, n_results: int = 3) -> list[dict]:
        """Get similar past synthesis episodes."""
        results = await self.episodic.search(
            query=content,
            n_results=n_results,
            filter_metadata={"quality_score": {"$gte": 0.7}}
        )
        return results

    async def update_synthesis_quality(
        self,
        pursuit_id: str,
        quality_score: float,
        feedback: Optional[str] = None
    ) -> None:
        """Update quality score for a synthesis episode based on user feedback."""
        # Search for the episode by pursuit_id
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

            # Re-store with updated quality
            await self.episodic.store(
                memory_id=episode.get("key", episode.get("id", "")),
                content=episode.get("content", ""),
                metadata={
                    **episode.get("metadata", {}),
                    "quality_score": quality_score
                },
                value=value
            )


# Default proposal components
DEFAULT_COMPONENTS = [
    "Executive Summary",
    "Understanding of Requirements",
    "Technical Approach",
    "Team & Experience",
    "Project Timeline",
    "Pricing"
]


SYNTHESIS_PROMPT = """You are a Synthesis Agent for proposal responses. Your task is to create a comprehensive proposal outline by combining content from multiple sources.

## Critical Rules
1. **NO HALLUCINATION**: Only use information from the provided sources
2. **CITE EVERYTHING**: Every bullet point must reference its source(s)
3. **MARK GAPS**: If content cannot be sourced, mark it as a gap with explanation
4. **FOLLOW STRUCTURE**: Organize content according to the specified components/template

## Metadata Context
{metadata_context}

## Proposal Structure
{structure_context}

## Coverage Information (from Gap Analysis)
{coverage_context}

## Research Findings
{research_context}

## Reference Content (from Past Pursuits)
{reference_context}

## Response Format
Return a JSON object with this exact structure:
{{
  "sections": [
    {{
      "id": "unique-section-id",
      "heading": "Section Title",
      "subtitle": "Optional subtitle or null",
      "order": 1,
      "bullets": [
        {{
          "id": "unique-bullet-id",
          "text": "Content of the bullet point",
          "order": 1,
          "is_gap": false,
          "gap_explanation": null,
          "citations": [
            {{
              "id": "citation-id",
              "source_type": "past_pursuit",
              "pursuit_id": "pursuit-001",
              "pursuit_name": "Name of pursuit",
              "section": "Section where content came from"
            }}
          ]
        }},
        {{
          "id": "unique-bullet-id-2",
          "text": "[GAP: Content needed for specific requirement]",
          "order": 2,
          "is_gap": true,
          "gap_explanation": "No source material available for this requirement",
          "citations": []
        }}
      ]
    }}
  ],
  "metadata": {{
    "generated_at": "ISO timestamp",
    "total_sections": 5,
    "total_gaps": 2,
    "agents_used": ["gap_analysis", "research", "synthesis"]
  }}
}}

## Citation Types
- **past_pursuit**: Content from reference pursuits (include pursuit_id, pursuit_name, section)
- **web**: Content from research findings (include url, title)
- **synthesized**: Content combining multiple sources (include all source references)

## Guidelines
- Create 3-7 bullet points per section
- Use industry-appropriate terminology
- Prioritize high-relevance content from well-covered requirements
- Mark gaps clearly with actionable explanations
- Order bullets logically within each section
- Generate unique IDs for sections, bullets, and citations
"""


async def synthesis_agent(
    gap_analysis: dict,
    research_findings: dict,
    reference_content: list[dict],
    metadata: dict,
    proposal_template: Optional[dict] = None,
    selected_components: Optional[list[str]] = None,
    memory: Optional[SynthesisMemory] = None,
    session_id: Optional[str] = None,
    pursuit_id: Optional[str] = None,
    stream: bool = False,
    edit_tracking: Optional[Any] = None,
) -> Union[SynthesisResult, AsyncGenerator[StreamChunk, None]]:
    """
    Synthesis Agent - Combines sources into structured proposal outline.

    Args:
        gap_analysis: Output from Gap Analysis Agent
        research_findings: Output from Research Agent
        reference_content: Content extracted from selected past pursuits
        metadata: Pursuit metadata (industry, service_types, technologies, etc.)
        proposal_template: Optional template defining proposal sections
        selected_components: Optional list of selected component types
        memory: Optional SynthesisMemory instance for memory-enhanced synthesis
        session_id: Optional session ID for short-term memory
        pursuit_id: Optional pursuit ID for episodic memory
        stream: If True, returns async generator for streaming output
        edit_tracking: Optional EditTrackingMemory for HITL integration

    Returns:
        SynthesisResult with outline and processing time, or async generator if streaming

    Raises:
        ValidationError: If required inputs are missing
    """
    if stream:
        return _synthesis_agent_streaming(
            gap_analysis=gap_analysis,
            research_findings=research_findings,
            reference_content=reference_content,
            metadata=metadata,
            proposal_template=proposal_template,
            selected_components=selected_components,
            memory=memory,
            session_id=session_id,
            pursuit_id=pursuit_id,
            edit_tracking=edit_tracking,
        )

    return await _synthesis_agent_non_streaming(
        gap_analysis=gap_analysis,
        research_findings=research_findings,
        reference_content=reference_content,
        metadata=metadata,
        proposal_template=proposal_template,
        selected_components=selected_components,
        memory=memory,
        session_id=session_id,
        pursuit_id=pursuit_id,
        edit_tracking=edit_tracking,
    )


async def _synthesis_agent_non_streaming(
    gap_analysis: dict,
    research_findings: dict,
    reference_content: list[dict],
    metadata: dict,
    proposal_template: Optional[dict] = None,
    selected_components: Optional[list[str]] = None,
    memory: Optional[SynthesisMemory] = None,
    session_id: Optional[str] = None,
    pursuit_id: Optional[str] = None,
    edit_tracking: Optional[Any] = None,
) -> SynthesisResult:
    """Non-streaming implementation of synthesis agent."""
    start_time = time.time()

    # Validate inputs
    if gap_analysis is None:
        raise ValidationError("Gap analysis is required")

    # HITL Integration: Apply any human-reviewed corrections to research findings
    effective_research = await apply_research_corrections(
        research_findings, edit_tracking, pursuit_id
    )

    # Store context in short-term memory if available
    if memory and session_id:
        await memory.store_current_context(
            session_id,
            {
                "gap_count": len(gap_analysis.get("gaps", [])),
                "research_count": len(effective_research.get("findings", [])),
                "reference_count": len(reference_content),
                "metadata": metadata
            }
        )

    # Determine structure early (needed for parallel memory lookup)
    components = _determine_components(proposal_template, selected_components)

    # Get learning context from memory (OPTIMIZED: parallel lookups)
    successful_patterns = []
    preferred_phrasing = {}

    if memory:
        # Use parallel memory lookup for better performance
        successful_patterns, preferred_phrasing = await _fetch_memory_context_parallel(
            memory, metadata, components
        )
        logger.debug(
            "memory_context_fetched",
            patterns_count=len(successful_patterns),
            phrasing_keys=list(preferred_phrasing.keys()),
        )

    # Build context strings
    metadata_context = _build_metadata_context(metadata)
    structure_context = _build_structure_context(components, proposal_template)
    coverage_context = _build_coverage_context(gap_analysis)
    research_context = _build_research_context(effective_research)
    reference_context = _build_reference_context(reference_content)

    # Build prompt
    prompt = SYNTHESIS_PROMPT.format(
        metadata_context=metadata_context,
        structure_context=structure_context,
        coverage_context=coverage_context,
        research_context=research_context,
        reference_context=reference_context,
    )

    # Add memory context if available
    if successful_patterns or preferred_phrasing:
        memory_context = _build_memory_context(successful_patterns, preferred_phrasing)
        prompt += f"\n\n## Learning Context (from past syntheses)\n{memory_context}"

    # Call AI
    client = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    try:
        response = await client.messages.create(
            model=MODEL_NAME,
            max_tokens=MAX_TOKENS,
            messages=[{"role": "user", "content": prompt}]
        )
    except anthropic.APIError as e:
        logger.error("synthesis_api_error", error=str(e))
        raise ValidationError(f"AI synthesis failed: {e}")

    response_text = response.content[0].text
    outline_data = _parse_synthesis_response(response_text)

    # Extract token usage
    input_tokens = response.usage.input_tokens
    output_tokens = response.usage.output_tokens
    estimated_cost = calculate_cost(input_tokens, output_tokens)

    # Log token usage
    log_token_usage(
        agent_name="synthesis",
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        pursuit_id=pursuit_id
    )

    # Validate and enhance outline
    outline = _validate_and_enhance_outline(outline_data, components)

    # Calculate processing time
    processing_time_ms = int((time.time() - start_time) * 1000)

    result = SynthesisResult(
        outline=outline,
        processing_time_ms=processing_time_ms,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        estimated_cost_usd=estimated_cost
    )

    # Store episode in episodic memory
    if memory and pursuit_id:
        await memory.store_synthesis_episode(
            pursuit_id=pursuit_id,
            outline=outline,
            metadata=metadata,
            quality_score=0.5  # Default score, updated by user feedback
        )

    logger.info(
        "synthesis_complete",
        pursuit_id=pursuit_id,
        section_count=len(outline["sections"]),
        gap_count=outline["metadata"]["total_gaps"],
        processing_time_ms=processing_time_ms
    )

    return result


async def _synthesis_agent_streaming(
    gap_analysis: dict,
    research_findings: dict,
    reference_content: list[dict],
    metadata: dict,
    proposal_template: Optional[dict] = None,
    selected_components: Optional[list[str]] = None,
    memory: Optional[SynthesisMemory] = None,
    session_id: Optional[str] = None,
    pursuit_id: Optional[str] = None,
    edit_tracking: Optional[Any] = None,
) -> AsyncGenerator[StreamChunk, None]:
    """Streaming implementation of synthesis agent."""
    start_time = time.time()

    # Validate inputs
    if gap_analysis is None:
        raise ValidationError("Gap analysis is required")

    # Yield thinking indicator
    yield StreamChunk(type="thinking", content="Analyzing sources...", outline=None)

    # HITL Integration: Apply any human-reviewed corrections to research findings
    effective_research = await apply_research_corrections(
        research_findings, edit_tracking, pursuit_id
    )

    # Store context if available
    if memory and session_id:
        await memory.store_current_context(
            session_id,
            {
                "gap_count": len(gap_analysis.get("gaps", [])),
                "research_count": len(effective_research.get("findings", [])),
                "reference_count": len(reference_content),
            }
        )

    # Determine structure early (needed for parallel memory lookup)
    components = _determine_components(proposal_template, selected_components)

    # Get learning context (OPTIMIZED: parallel lookups)
    successful_patterns = []
    preferred_phrasing = {}

    if memory:
        # Use parallel memory lookup for better performance
        successful_patterns, preferred_phrasing = await _fetch_memory_context_parallel(
            memory, metadata, components
        )

    # Build context strings
    metadata_context = _build_metadata_context(metadata)
    structure_context = _build_structure_context(components, proposal_template)
    coverage_context = _build_coverage_context(gap_analysis)
    research_context = _build_research_context(effective_research)
    reference_context = _build_reference_context(reference_content)

    # Build prompt
    prompt = SYNTHESIS_PROMPT.format(
        metadata_context=metadata_context,
        structure_context=structure_context,
        coverage_context=coverage_context,
        research_context=research_context,
        reference_context=reference_context,
    )

    if successful_patterns or preferred_phrasing:
        memory_context = _build_memory_context(successful_patterns, preferred_phrasing)
        prompt += f"\n\n## Learning Context\n{memory_context}"

    # Call AI with streaming
    client = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    try:
        collected_text = ""
        async with client.messages.stream(
            model=MODEL_NAME,
            max_tokens=MAX_TOKENS,
            messages=[{"role": "user", "content": prompt}]
        ) as stream:
            async for text in stream.text_stream:
                collected_text += text

                # Yield section indicators when we detect them
                if '"heading":' in text:
                    yield StreamChunk(type="section", content=text, outline=None)
                elif '"text":' in text:
                    yield StreamChunk(type="bullet", content=text, outline=None)

        # Parse final response
        outline_data = _parse_synthesis_response(collected_text)
        outline = _validate_and_enhance_outline(outline_data, components)

        processing_time_ms = int((time.time() - start_time) * 1000)

        # Store in memory
        if memory and pursuit_id:
            await memory.store_synthesis_episode(
                pursuit_id=pursuit_id,
                outline=outline,
                metadata=metadata,
                quality_score=0.5
            )

        # Yield final result
        yield StreamChunk(
            type="done",
            content=None,
            outline=outline
        )

    except anthropic.APIError as e:
        logger.error("synthesis_streaming_error", error=str(e))
        raise ValidationError(f"AI synthesis failed: {e}")


def _determine_components(
    proposal_template: Optional[dict],
    selected_components: Optional[list[str]]
) -> list[str]:
    """Determine which components to use for the outline."""
    if selected_components:
        return selected_components

    if proposal_template and "sections" in proposal_template:
        return [s.get("name", str(s)) for s in proposal_template["sections"]]

    return DEFAULT_COMPONENTS


def _build_metadata_context(metadata: dict) -> str:
    """Build metadata context string for prompt."""
    if not metadata:
        return "No metadata provided."

    parts = []
    if metadata.get("entity_name"):
        parts.append(f"Client: {metadata['entity_name']}")
    if metadata.get("industry"):
        parts.append(f"Industry: {metadata['industry']}")
    if metadata.get("service_types"):
        services = metadata["service_types"]
        if isinstance(services, list):
            parts.append(f"Service Types: {', '.join(services)}")
        else:
            parts.append(f"Service Types: {services}")
    if metadata.get("technologies"):
        tech = metadata["technologies"]
        if isinstance(tech, list):
            parts.append(f"Technologies: {', '.join(tech)}")
        else:
            parts.append(f"Technologies: {tech}")
    if metadata.get("geography"):
        parts.append(f"Geography: {metadata['geography']}")

    return "\n".join(parts) if parts else "No metadata provided."


def _build_structure_context(components: list[str], proposal_template: Optional[dict]) -> str:
    """Build structure context string for prompt."""
    parts = [f"**Required Sections ({len(components)}):**"]

    for i, component in enumerate(components, 1):
        parts.append(f"{i}. {component}")

    if proposal_template:
        parts.append(f"\nTemplate: {proposal_template.get('name', 'Custom')}")

    return "\n".join(parts)


def _build_coverage_context(gap_analysis: dict) -> str:
    """Build coverage context from gap analysis.

    OPTIMIZED: Uses MAX_COVERAGE_ITEMS to limit context size.
    """
    parts = []

    overall = gap_analysis.get("overall_coverage", 0)
    parts.append(f"**Overall Coverage: {overall:.0%}**")

    # Coverage matrix - OPTIMIZED: limit to MAX_COVERAGE_ITEMS
    matrix = gap_analysis.get("coverage_matrix", [])
    if matrix:
        # Sort by coverage score to prioritize most relevant items
        sorted_matrix = sorted(matrix, key=lambda x: x.get("coverage_score", 0))
        parts.append("\n**Requirement Coverage:**")
        for item in sorted_matrix[:MAX_COVERAGE_ITEMS]:
            req = item.get("requirement", "")[:80]  # Reduced from 100
            score = item.get("coverage_score", 0)
            sources = item.get("sources", [])
            # Limit source names to save tokens
            source_str = ", ".join([s.get("pursuit_name", s.get("pursuit_id", ""))[:20] for s in sources[:2]])
            parts.append(f"- {req} ({score:.0%}) [{source_str or 'None'}]")

    # Gaps - prioritize high priority gaps
    gaps = gap_analysis.get("gaps", [])
    if gaps:
        # Sort by priority: critical > high > medium > low
        priority_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
        sorted_gaps = sorted(gaps, key=lambda x: priority_order.get(x.get("priority", "medium"), 2))
        parts.append("\n**Identified Gaps:**")
        for gap in sorted_gaps[:MAX_COVERAGE_ITEMS]:
            req = gap.get("requirement", "")[:80]  # Reduced from 100
            priority = gap.get("priority", "medium")
            parts.append(f"- [{priority.upper()}] {req}")

    return "\n".join(parts)


def _build_research_context(research_findings: dict) -> str:
    """Build research context from research agent output.

    OPTIMIZED: Uses MAX_RESEARCH_FINDINGS and MAX_BULLETS_PER_FINDING to limit context.
    """
    findings = research_findings.get("findings", [])

    if not findings:
        return "No research findings available."

    # OPTIMIZED: Limit to MAX_RESEARCH_FINDINGS, prioritize by confidence
    sorted_findings = sorted(findings, key=lambda x: x.get("confidence", 0), reverse=True)
    limited_findings = sorted_findings[:MAX_RESEARCH_FINDINGS]

    parts = [f"**Research Findings ({len(limited_findings)}/{len(findings)} shown):**"]

    for finding in limited_findings:
        gap = finding.get("gap", "Unknown gap")[:80]  # Reduced from 100
        confidence = finding.get("confidence", 0)
        sources = finding.get("sources", [])

        parts.append(f"\n### {gap} ({confidence:.0%})")

        # Add extracted information - OPTIMIZED: limit bullets
        for info in finding.get("findings", [])[:MAX_BULLETS_PER_FINDING]:
            content = info.get("content", "")[:150]  # Reduced from 200
            parts.append(f"- {content}")

        # Add sources - compact format
        if sources:
            source_refs = [f"[{s.get('title', '')[:30]}]" for s in sources[:2]]
            parts.append(f"  Sources: {', '.join(source_refs)}")

    return "\n".join(parts)


def _build_reference_context(reference_content: list[dict]) -> str:
    """Build reference context from past pursuits.

    OPTIMIZED: Uses MAX_REFERENCE_PURSUITS and MAX_REFERENCE_CONTENT_CHARS to limit context.
    """
    if not reference_content:
        return "No reference pursuits provided."

    # OPTIMIZED: Limit to MAX_REFERENCE_PURSUITS
    limited_pursuits = reference_content[:MAX_REFERENCE_PURSUITS]

    parts = [f"**Reference Pursuits ({len(limited_pursuits)}/{len(reference_content)} shown):**"]

    for pursuit in limited_pursuits:
        pursuit_id = pursuit.get("pursuit_id", "unknown")
        name = pursuit.get("pursuit_name", "Unnamed Pursuit")[:50]  # Limit name length

        parts.append(f"\n### {name} ({pursuit_id})")

        sections = pursuit.get("sections", {})
        if sections:
            # Limit to 3 most important sections per pursuit
            section_items = list(sections.items())[:3]
            for section_name, content in section_items:
                # OPTIMIZED: Use MAX_REFERENCE_CONTENT_CHARS
                truncated = content[:MAX_REFERENCE_CONTENT_CHARS] + "..." if len(content) > MAX_REFERENCE_CONTENT_CHARS else content
                parts.append(f"**{section_name[:30]}:** {truncated}")

    return "\n".join(parts)


def _build_memory_context(
    successful_patterns: list[dict],
    preferred_phrasing: dict
) -> str:
    """Build memory context from past syntheses."""
    parts = []

    if successful_patterns:
        parts.append("### Successful Outline Patterns")
        for pattern in successful_patterns[:3]:
            score = pattern.get("quality_score", 0)
            industry = pattern.get("industry", "")
            pattern_data = pattern.get("pattern", {})

            parts.append(f"- {industry} pattern (quality: {score:.0%})")

            # Include specific pattern requirements
            if pattern_data.get("must_include_toc"):
                parts.append("  - MUST include Table of Contents as first section")
            if pattern_data.get("must_include_human_review"):
                parts.append("  - MUST include human review statement in closing section")

    if preferred_phrasing:
        parts.append("\n### Preferred Phrasing and Requirements")
        for section, phrasing in preferred_phrasing.items():
            style = phrasing.get('style', 'Standard')
            parts.append(f"\n**{section}** (Style: {style})")

            # Include specific requirements from memory
            requirements = phrasing.get('requirements', [])
            for req in requirements:
                parts.append(f"  - {req}")

            # Include example if available
            example = phrasing.get('example', '')
            if example:
                parts.append(f"  Example: {example[:200]}")

    return "\n".join(parts) if parts else ""


def _parse_synthesis_response(response_text: str) -> dict:
    """Parse JSON outline from AI response."""
    # Try to extract JSON from markdown code blocks
    json_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', response_text)
    if json_match:
        json_str = json_match.group(1)
    else:
        json_str = response_text

    try:
        return json.loads(json_str)
    except json.JSONDecodeError:
        # Try to find JSON object in response
        json_match = re.search(r'\{[\s\S]*\}', response_text)
        if json_match:
            try:
                return json.loads(json_match.group(0))
            except json.JSONDecodeError as e:
                logger.warning("synthesis_json_parse_error", error=str(e))

    # Return empty structure if parsing fails
    logger.warning("synthesis_response_parse_failed", response_preview=response_text[:500])
    return {
        "sections": [],
        "metadata": {
            "generated_at": "",
            "total_sections": 0,
            "total_gaps": 0,
            "agents_used": []
        }
    }


def _validate_and_enhance_outline(outline_data: dict, components: list[str]) -> Outline:
    """Validate and enhance the parsed outline."""
    sections = outline_data.get("sections", [])

    # Generate IDs if missing
    for section in sections:
        if not section.get("id"):
            section["id"] = str(uuid.uuid4())

        for bullet in section.get("bullets", []):
            if not bullet.get("id"):
                bullet["id"] = str(uuid.uuid4())

            # Ensure required fields
            if "is_gap" not in bullet:
                bullet["is_gap"] = False
            if "gap_explanation" not in bullet:
                bullet["gap_explanation"] = None
            if "citations" not in bullet:
                bullet["citations"] = []

            # Generate citation IDs
            for citation in bullet["citations"]:
                if not citation.get("id"):
                    citation["id"] = str(uuid.uuid4())

    # Ensure metadata
    metadata = outline_data.get("metadata", {})

    # Count gaps
    total_gaps = sum(
        1 for section in sections
        for bullet in section.get("bullets", [])
        if bullet.get("is_gap", False)
    )

    from datetime import datetime

    outline = Outline(
        sections=sections,
        metadata=OutlineMetadata(
            generated_at=metadata.get("generated_at", datetime.utcnow().isoformat() + "Z"),
            total_sections=len(sections),
            total_gaps=total_gaps,
            agents_used=metadata.get("agents_used", ["gap_analysis", "research", "synthesis"])
        )
    )

    return outline


# Learning functions
async def update_synthesis_quality(
    memory: SynthesisMemory,
    pursuit_id: str,
    quality_score: float,
    feedback: Optional[str] = None
) -> None:
    """Update synthesis quality based on user feedback."""
    await memory.update_synthesis_quality(
        pursuit_id=pursuit_id,
        quality_score=quality_score,
        feedback=feedback
    )
