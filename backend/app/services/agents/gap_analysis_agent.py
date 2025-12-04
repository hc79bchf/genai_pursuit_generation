"""
Gap Analysis Agent

Analyzes coverage gaps between RFP requirements and selected past pursuits.
Generates research queries for uncovered requirements.

Memory Types Used:
- Short-term (Redis): Current RFP requirements, selected reference materials
- Long-term (PostgreSQL): Common gap patterns by industry/service type
- Episodic (ChromaDB): Past gap analyses and their accuracy, successful coverage matches
"""

import os
import re
import time
import json
import hashlib
from typing import TypedDict, Any, Optional

import anthropic
import structlog

from app.core.exceptions import ValidationError
from app.services.memory.short_term import ShortTermMemoryService
from app.services.memory.long_term import LongTermMemoryService
from app.services.memory.episodic import EpisodicMemoryService
from app.services.agents.token_tracking import calculate_cost, log_token_usage
from app.schemas.stage_review import PipelineStage

logger = structlog.get_logger(__name__)


# Constants
MODEL_NAME = "claude-sonnet-4-5-20250929"
MAX_TOKENS = 8192
GAP_THRESHOLD = 0.5  # Coverage below this is considered a gap


# =============================================================================
# HITL Helper Functions
# =============================================================================


def extract_metadata_from_review(reviewed_output: Optional[dict]) -> dict:
    """
    Extract metadata values from a human-reviewed metadata extraction output.

    Args:
        reviewed_output: The corrected output from EditTrackingMemory.get_corrected_output()

    Returns:
        Dict with extracted metadata fields (entity_name, industry, etc.)
    """
    if not reviewed_output:
        return {}

    extracted_fields = reviewed_output.get("extracted_fields", {})
    if not extracted_fields:
        return {}

    metadata = {}
    for field_name, field_data in extracted_fields.items():
        if isinstance(field_data, dict) and "value" in field_data:
            metadata[field_name] = field_data["value"]

    return metadata


def merge_metadata(original: dict, corrected: Optional[dict]) -> dict:
    """
    Merge corrected metadata fields with original metadata.

    Corrected fields override original values. Original fields are preserved
    when not present in the correction.

    Args:
        original: Original metadata dict
        corrected: Corrected metadata dict (may be None or partial)

    Returns:
        Merged metadata dict
    """
    if not corrected:
        return original.copy()

    # Start with original, then override with corrections
    merged = original.copy()
    merged.update(corrected)
    return merged


class SourceItem(TypedDict):
    """Reference to a source pursuit."""
    pursuit_id: str
    pursuit_name: str
    section: str
    relevance: float


class CoverageItem(TypedDict):
    """Coverage assessment for a single requirement."""
    requirement: str
    sources: list
    coverage_score: float


class GapItem(TypedDict):
    """An identified gap in coverage."""
    requirement: str
    priority: str  # "high", "medium", "low"
    reason: str
    section: Optional[str]


class ResearchQuery(TypedDict):
    """A generated research query for a gap."""
    query: str
    target_gap: str


class GapAnalysisResult(TypedDict):
    """Complete result from gap analysis."""
    coverage_matrix: list
    overall_coverage: float
    gaps: list
    research_queries: list
    processing_time_ms: int
    input_tokens: int
    output_tokens: int
    estimated_cost_usd: float


class GapAnalysisMemory:
    """Memory services for Gap Analysis Agent.

    Memory Types:
    - Short-term (Redis): Current RFP requirements, selected reference materials
    - Long-term (PostgreSQL): Common gap patterns by industry/service type
    - Episodic (ChromaDB): Past gap analyses and their accuracy
    - Working (In-memory): Current coverage matrix calculations, gap prioritization
    - Procedural (PostgreSQL): Gap identification heuristics, coverage scoring methods
    - Semantic (PostgreSQL + ChromaDB): Requirement categories, service capability mappings
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
            collection_name="gap_analysis_episodes"
        )

        # Working memory (in-memory, task duration only)
        self._working_memory: dict = {}

        # Semantic memory collection for requirement/capability mappings
        self.semantic = EpisodicMemoryService(
            persist_directory=chroma_persist_dir,
            collection_name="gap_analysis_semantic"
        )

    # ===================
    # WORKING MEMORY
    # ===================

    def store_working(self, key: str, value: Any) -> None:
        """Store data in working memory (in-memory, task duration)."""
        self._working_memory[key] = {
            "value": value,
            "timestamp": time.time()
        }

    def get_working(self, key: str) -> Optional[Any]:
        """Retrieve data from working memory."""
        item = self._working_memory.get(key)
        return item["value"] if item else None

    def clear_working(self) -> None:
        """Clear all working memory (call after task completion)."""
        self._working_memory = {}

    def store_coverage_calculation(
        self,
        pursuit_id: str,
        coverage_matrix: list,
        intermediate_scores: dict
    ) -> None:
        """Store current coverage matrix calculation in working memory."""
        self.store_working(f"coverage:{pursuit_id}", {
            "matrix": coverage_matrix,
            "scores": intermediate_scores,
            "calculated_at": time.time()
        })

    def get_coverage_calculation(self, pursuit_id: str) -> Optional[dict]:
        """Get current coverage calculation from working memory."""
        return self.get_working(f"coverage:{pursuit_id}")

    def store_gap_prioritization(
        self,
        pursuit_id: str,
        gaps: list,
        priority_factors: dict
    ) -> None:
        """Store gap prioritization reasoning in working memory."""
        self.store_working(f"prioritization:{pursuit_id}", {
            "gaps": gaps,
            "factors": priority_factors,
            "prioritized_at": time.time()
        })

    def get_gap_prioritization(self, pursuit_id: str) -> Optional[dict]:
        """Get gap prioritization from working memory."""
        return self.get_working(f"prioritization:{pursuit_id}")

    # ===================
    # PROCEDURAL MEMORY
    # ===================

    async def get_gap_heuristics(self, industry: str = None) -> list[dict]:
        """Get gap identification heuristics from procedural memory."""
        key = f"procedural:gap_heuristics:{industry}" if industry else "procedural:gap_heuristics:default"
        memory = await self.long_term.retrieve(key)
        if memory:
            return memory.value

        # Return default heuristics if none stored
        return [
            {
                "name": "keyword_emphasis",
                "description": "Prioritize requirements with MUST, CRITICAL, ESSENTIAL",
                "weight": 1.5
            },
            {
                "name": "coverage_threshold",
                "description": "Mark as gap if coverage < 0.5",
                "threshold": 0.5
            },
            {
                "name": "section_matching",
                "description": "Map requirements to template sections by keyword",
                "enabled": True
            }
        ]

    async def store_gap_heuristic(
        self,
        name: str,
        heuristic: dict,
        industry: str = None
    ) -> None:
        """Store a gap identification heuristic in procedural memory."""
        key = f"procedural:gap_heuristics:{industry}" if industry else "procedural:gap_heuristics:default"
        existing = await self.long_term.retrieve(key)
        heuristics = existing.value if existing else []

        # Update existing or add new
        updated = False
        for h in heuristics:
            if h.get("name") == name:
                h.update(heuristic)
                updated = True
                break

        if not updated:
            heuristics.append({"name": name, **heuristic})

        await self.long_term.store(
            key,
            heuristics,
            metadata={
                "agent_type": "gap_analysis",
                "memory_type": "procedural"
            }
        )

    async def get_coverage_scoring_method(self) -> dict:
        """Get the coverage scoring method from procedural memory."""
        memory = await self.long_term.retrieve("procedural:coverage_scoring")
        if memory:
            return memory.value

        # Return default scoring method
        return {
            "method": "weighted_average",
            "weights": {
                "content_match": 0.4,
                "metadata_match": 0.3,
                "recency": 0.2,
                "quality_tags": 0.1
            },
            "normalization": "min_max"
        }

    async def update_coverage_scoring_method(self, method: dict) -> None:
        """Update the coverage scoring method in procedural memory."""
        await self.long_term.store(
            "procedural:coverage_scoring",
            method,
            metadata={
                "agent_type": "gap_analysis",
                "memory_type": "procedural"
            }
        )

    # ===================
    # SEMANTIC MEMORY
    # ===================

    async def get_requirement_categories(self) -> list[dict]:
        """Get requirement category taxonomy from semantic memory."""
        memory = await self.long_term.retrieve("semantic:requirement_categories")
        if memory:
            return memory.value

        # Return default taxonomy
        return [
            {"category": "technical", "keywords": ["system", "platform", "integration", "api", "database"]},
            {"category": "security", "keywords": ["security", "compliance", "audit", "encryption", "access"]},
            {"category": "performance", "keywords": ["performance", "scalability", "availability", "latency"]},
            {"category": "methodology", "keywords": ["approach", "methodology", "process", "framework"]},
            {"category": "team", "keywords": ["team", "experience", "qualifications", "resources"]},
            {"category": "timeline", "keywords": ["timeline", "schedule", "milestone", "delivery"]},
            {"category": "cost", "keywords": ["cost", "pricing", "budget", "fees"]}
        ]

    async def store_requirement_category(self, category: str, keywords: list[str]) -> None:
        """Store or update a requirement category in semantic memory."""
        categories = await self.get_requirement_categories()

        # Update existing or add new
        updated = False
        for cat in categories:
            if cat["category"] == category:
                cat["keywords"] = list(set(cat["keywords"] + keywords))
                updated = True
                break

        if not updated:
            categories.append({"category": category, "keywords": keywords})

        await self.long_term.store(
            "semantic:requirement_categories",
            categories,
            metadata={
                "agent_type": "gap_analysis",
                "memory_type": "semantic"
            }
        )

    async def get_service_capability_mappings(self, service_type: str = None) -> list[dict]:
        """Get service-to-capability mappings from semantic memory."""
        key = f"semantic:capabilities:{service_type}" if service_type else "semantic:capabilities:all"
        memory = await self.long_term.retrieve(key)
        if memory:
            return memory.value

        # Return default mappings
        return [
            {
                "service": "Engineering",
                "capabilities": ["system design", "development", "integration", "testing", "deployment"]
            },
            {
                "service": "Data",
                "capabilities": ["analytics", "data migration", "ETL", "warehousing", "visualization"]
            },
            {
                "service": "Risk",
                "capabilities": ["assessment", "compliance", "audit", "controls", "governance"]
            },
            {
                "service": "Cloud",
                "capabilities": ["migration", "architecture", "infrastructure", "devops", "security"]
            }
        ]

    async def store_service_capability(
        self,
        service_type: str,
        capabilities: list[str]
    ) -> None:
        """Store service-to-capability mapping in semantic memory."""
        key = f"semantic:capabilities:{service_type}"
        await self.long_term.store(
            key,
            {"service": service_type, "capabilities": capabilities},
            metadata={
                "agent_type": "gap_analysis",
                "memory_type": "semantic"
            }
        )

    async def search_similar_requirements(
        self,
        requirement_text: str,
        n_results: int = 5
    ) -> list[dict]:
        """Search for semantically similar requirements from past analyses."""
        return await self.semantic.search_similar(
            query_text=requirement_text,
            n_results=n_results,
            filter_metadata={"type": "requirement"}
        )

    async def store_requirement_embedding(
        self,
        requirement_id: str,
        requirement_text: str,
        category: str,
        metadata: dict = None
    ) -> None:
        """Store a requirement with its embedding for semantic search."""
        await self.semantic.store(
            f"req:{requirement_id}",
            {"text": requirement_text, "category": category},
            metadata={
                "type": "requirement",
                "category": category,
                **(metadata or {})
            }
        )

    async def store_analysis_context(
        self,
        session_id: str,
        rfp_text: str,
        selected_pursuits: list,
        metadata: dict
    ) -> None:
        """Store current analysis context in short-term memory."""
        key = f"gap_analysis:{session_id}:context"
        await self.short_term.store(
            key,
            {
                "rfp_text_preview": rfp_text[:2000],
                "pursuit_count": len(selected_pursuits),
                "pursuit_ids": [p.get("id", "") for p in selected_pursuits],
                "metadata": metadata
            },
            ttl_seconds=3600  # 1 hour
        )

    async def get_gap_patterns(self, industry: str, service_types: list) -> list[dict]:
        """Get common gap patterns for industry/service from long-term memory."""
        memory = await self.long_term.retrieve(f"gap_patterns:{industry}")
        if not memory:
            return []

        patterns = memory.value
        # Filter by service types if available
        if service_types:
            patterns = [
                p for p in patterns
                if any(st in p.get("service_types", []) for st in service_types)
            ]
        return patterns

    async def store_gap_pattern(
        self,
        industry: str,
        service_types: list,
        pattern: dict
    ) -> None:
        """Store a new gap pattern in long-term memory."""
        key = f"gap_patterns:{industry}"
        existing = await self.long_term.retrieve(key)
        patterns = existing.value if existing else []

        patterns.append({
            "service_types": service_types,
            "pattern": pattern,
            "created_at": time.time(),
            "usage_count": 1
        })

        await self.long_term.store(
            key,
            patterns,
            metadata={
                "agent_type": "gap_analysis",
                "memory_type": "gap_patterns"
            }
        )

    async def get_similar_analyses(
        self,
        rfp_text: str,
        industry: Optional[str] = None,
        n_results: int = 5
    ) -> list[dict]:
        """Find similar past gap analyses from episodic memory."""
        filter_metadata = {"episode_type": "gap_analysis"}
        if industry:
            filter_metadata["industry"] = industry

        return await self.episodic.search_similar(
            query_text=rfp_text[:1000],
            n_results=n_results,
            filter_metadata=filter_metadata
        )

    async def store_analysis_episode(
        self,
        pursuit_id: str,
        rfp_text: str,
        result: "GapAnalysisResult",
        metadata: dict
    ) -> str:
        """Store a complete gap analysis episode for learning."""
        key = f"gap_analysis:{pursuit_id}:{hashlib.md5(rfp_text[:500].encode()).hexdigest()[:8]}"

        episode_data = {
            "rfp_text_preview": rfp_text[:1000],
            "overall_coverage": result["overall_coverage"],
            "gap_count": len(result["gaps"]),
            "gaps": result["gaps"],
            "research_query_count": len(result["research_queries"]),
            "pursuit_id": pursuit_id
        }

        chroma_metadata = {
            "episode_type": "gap_analysis",
            "pursuit_id": pursuit_id,
            "overall_coverage": result["overall_coverage"],
            "gap_count": len(result["gaps"]),
            "industry": metadata.get("industry", "")
        }

        await self.episodic.store(key, episode_data, chroma_metadata)
        return key

    async def get_high_coverage_analyses(
        self,
        min_coverage: float = 0.7,
        industry: Optional[str] = None,
        n_results: int = 10
    ) -> list[dict]:
        """Get past analyses with high coverage for learning."""
        collection = self.episodic._get_collection()

        where_clause = {
            "episode_type": "gap_analysis",
            "overall_coverage": {"$gte": min_coverage}
        }
        if industry:
            where_clause["industry"] = industry

        results = collection.get(
            where=where_clause,
            include=["documents", "metadatas"],
            limit=n_results
        )

        items = []
        for i, id_ in enumerate(results["ids"]):
            doc = results["documents"][i]
            try:
                value = json.loads(doc)
            except (json.JSONDecodeError, TypeError):
                value = doc

            items.append({
                "key": id_,
                "value": value,
                "metadata": results["metadatas"][i] if results["metadatas"] else {}
            })

        return items

    async def update_pattern_from_feedback(
        self,
        industry: str,
        gap_requirement: str,
        was_accurate: bool
    ) -> None:
        """Update gap pattern based on user feedback."""
        key = f"gap_patterns:{industry}"
        existing = await self.long_term.retrieve(key)
        if not existing:
            return

        patterns = existing.value
        for pattern in patterns:
            if gap_requirement in str(pattern.get("pattern", {})):
                if was_accurate:
                    pattern["usage_count"] = pattern.get("usage_count", 0) + 1
                else:
                    pattern["usage_count"] = max(0, pattern.get("usage_count", 1) - 1)

        await self.long_term.store(
            key,
            patterns,
            metadata={
                "agent_type": "gap_analysis",
                "memory_type": "gap_patterns"
            }
        )

    async def close(self) -> None:
        """Close all memory service connections."""
        await self.short_term.close()
        await self.long_term.close()
        await self.episodic.close()
        await self.semantic.close()
        self.clear_working()


GAP_ANALYSIS_PROMPT = """You are a Gap Analysis Agent for proposal responses. Analyze the coverage between RFP requirements and selected past pursuits.

## Your Task
1. Extract key requirements from the RFP
2. Analyze how well each requirement is covered by the provided past pursuits
3. Identify gaps (requirements with low or no coverage)
4. Generate research queries for gaps

## Metadata Context
{metadata_context}

## Template/Components
{template_context}

## Past Pursuits
{pursuits_context}

## RFP Document
{rfp_text}

## Response Format
Return a JSON object with this exact structure:
{{{{
  "coverage_matrix": [
    {{{{
      "requirement": "Description of the requirement",
      "sources": [
        {{{{
          "pursuit_id": "id of the pursuit",
          "pursuit_name": "name of the pursuit",
          "section": "which section covers this",
          "relevance": 0.85
        }}}}
      ],
      "coverage_score": 0.85
    }}}}
  ],
  "gaps": [
    {{{{
      "requirement": "Description of the uncovered requirement",
      "priority": "high|medium|low",
      "reason": "Why this is a gap",
      "section": "Template section if applicable or null"
    }}}}
  ],
  "research_queries": [
    {{{{
      "query": "Search query including industry/technology context",
      "target_gap": "Which gap this query addresses"
    }}}}
  ]
}}}}

## Guidelines
- Extract 3-10 key requirements from the RFP
- Coverage score: 0.0 (no coverage) to 1.0 (fully covered)
- Priority based on RFP emphasis (words like "MUST", "CRITICAL", "ESSENTIAL" = high)
- Research queries should be search-engine friendly (under 200 chars, no special chars)
- Include industry/technology context in queries (e.g., "healthcare Azure cloud migration best practices")
- Generate exactly one research query for each identified gap (1:1 mapping)
- If template sections provided, map gaps to sections
"""


async def gap_analysis_agent(
    rfp_text: str,
    metadata: dict,
    selected_pursuits: list,
    proposal_template: Optional[dict] = None,
    selected_components: Optional[list] = None,
    memory: Optional[GapAnalysisMemory] = None,
    session_id: Optional[str] = None,
    pursuit_id: Optional[str] = None,
    edit_tracking: Optional[Any] = None,
) -> GapAnalysisResult:
    """
    Analyze coverage gaps between RFP requirements and past pursuits.

    Args:
        rfp_text: The raw RFP text to analyze.
        metadata: Extracted metadata from the RFP.
        selected_pursuits: List of past pursuit documents to compare against.
        proposal_template: Optional template defining proposal sections.
        selected_components: Optional list of selected component types.
        memory: Optional memory service for learning and context.
        session_id: Optional session ID for short-term memory.
        pursuit_id: Optional pursuit ID for episodic memory storage.
        edit_tracking: Optional EditTrackingMemory for HITL integration.

    Returns:
        GapAnalysisResult with coverage matrix, gaps, and research queries.

    Raises:
        ValidationError: If input is invalid.
    """
    start_time = time.time()

    # Validate input
    if not rfp_text or not rfp_text.strip():
        raise ValidationError("Input RFP text is empty")

    # ===================
    # HITL Integration: Check for human-reviewed metadata
    # ===================
    effective_metadata = metadata
    if edit_tracking and pursuit_id:
        # Check if there's a human-reviewed metadata extraction output
        has_review = await edit_tracking.has_review(
            pursuit_id=pursuit_id,
            stage=PipelineStage.metadata_extraction,
        )

        if has_review:
            # Get the corrected output
            corrected_output = await edit_tracking.get_corrected_output(
                pursuit_id=pursuit_id,
                stage=PipelineStage.metadata_extraction,
            )

            if corrected_output:
                # Extract metadata from the reviewed output
                corrected_metadata = extract_metadata_from_review(corrected_output)

                # Merge corrected fields with original
                effective_metadata = merge_metadata(metadata, corrected_metadata)

                logger.info(
                    "using_human_reviewed_metadata",
                    pursuit_id=pursuit_id,
                    corrected_fields=list(corrected_metadata.keys()),
                )

    # Store context in short-term memory if available
    if memory and session_id:
        await memory.store_analysis_context(
            session_id, rfp_text, selected_pursuits, effective_metadata
        )

    # Get similar past analyses for learning
    similar_analyses = []
    gap_patterns = []
    gap_heuristics = []
    requirement_categories = []
    service_capabilities = []

    if memory:
        industry = effective_metadata.get("industry", "")
        service_types = effective_metadata.get("service_types", [])

        # Episodic memory
        similar_analyses = await memory.get_similar_analyses(
            rfp_text, industry=industry, n_results=3
        )

        # Long-term memory
        gap_patterns = await memory.get_gap_patterns(industry, service_types)

        # Procedural memory
        gap_heuristics = await memory.get_gap_heuristics(industry)

        # Semantic memory
        requirement_categories = await memory.get_requirement_categories()
        service_capabilities = await memory.get_service_capability_mappings()

    # Build context strings
    metadata_context = _build_metadata_context(effective_metadata)
    template_context = _build_template_context(proposal_template, selected_components)
    pursuits_context = _build_pursuits_context(selected_pursuits)

    # Add memory context to prompt if available
    memory_context = _build_memory_context(
        similar_analyses, gap_patterns, gap_heuristics,
        requirement_categories, service_capabilities
    )

    # Build prompt
    prompt = GAP_ANALYSIS_PROMPT.format(
        metadata_context=metadata_context,
        template_context=template_context,
        pursuits_context=pursuits_context,
        rfp_text=rfp_text,
    )

    # Append memory context if available
    if memory_context:
        prompt += f"\n\n## Learning Context (from past analyses)\n{memory_context}"

    # Call AI
    try:
        client = anthropic.Anthropic(
            api_key=os.getenv("ANTHROPIC_API_KEY")
        )

        message = client.messages.create(
            model=MODEL_NAME,
            max_tokens=MAX_TOKENS,
            messages=[
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        )
    except anthropic.APIError as e:
        raise ValidationError(f"AI analysis failed: {e}")

    # Parse response
    response_text = message.content[0].text
    analysis_result = _parse_analysis_response(response_text)

    # Extract token usage
    input_tokens = message.usage.input_tokens
    output_tokens = message.usage.output_tokens
    estimated_cost = calculate_cost(input_tokens, output_tokens)

    # Log token usage
    log_token_usage(
        agent_name="gap_analysis",
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        pursuit_id=pursuit_id
    )

    # Calculate overall coverage
    coverage_matrix = analysis_result.get("coverage_matrix", [])
    overall_coverage = _calculate_overall_coverage(coverage_matrix)

    # Ensure gaps are identified for low coverage items
    gaps = analysis_result.get("gaps", [])
    if not gaps and coverage_matrix:
        gaps = _identify_gaps_from_matrix(coverage_matrix, proposal_template)

    # Ensure research queries exist for gaps
    research_queries = analysis_result.get("research_queries", [])
    if gaps and not research_queries:
        research_queries = _generate_default_queries(gaps, effective_metadata)

    # Calculate processing time
    processing_time_ms = int((time.time() - start_time) * 1000)

    result = GapAnalysisResult(
        coverage_matrix=coverage_matrix,
        overall_coverage=overall_coverage,
        gaps=gaps,
        research_queries=research_queries,
        processing_time_ms=processing_time_ms,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        estimated_cost_usd=estimated_cost
    )

    # Store working memory calculations (for debugging/tracing)
    if memory and pursuit_id:
        memory.store_coverage_calculation(
            pursuit_id,
            coverage_matrix,
            {"overall_coverage": overall_coverage, "requirement_count": len(coverage_matrix)}
        )
        memory.store_gap_prioritization(
            pursuit_id,
            gaps,
            {"gap_count": len(gaps), "high_priority": sum(1 for g in gaps if g.get("priority") == "high")}
        )

    # Store episode in episodic memory for learning
    if memory and pursuit_id:
        await memory.store_analysis_episode(
            pursuit_id, rfp_text, result, effective_metadata
        )

        # Store new gap patterns if significant gaps found
        if gaps and effective_metadata.get("industry"):
            for gap in gaps:
                if gap.get("priority") == "high":
                    await memory.store_gap_pattern(
                        effective_metadata["industry"],
                        effective_metadata.get("service_types", []),
                        {
                            "requirement": gap.get("requirement"),
                            "reason": gap.get("reason"),
                            "section": gap.get("section")
                        }
                    )

    return result


def _build_memory_context(
    similar_analyses: list,
    gap_patterns: list,
    gap_heuristics: list = None,
    requirement_categories: list = None,
    service_capabilities: list = None
) -> str:
    """Build context string from memory for the prompt."""
    parts = []

    # Episodic memory: Similar past analyses
    if similar_analyses:
        parts.append("### Similar Past Analyses")
        for i, analysis in enumerate(similar_analyses[:3], 1):
            value = analysis.get("value", {})
            coverage = value.get("overall_coverage", 0)
            gap_count = value.get("gap_count", 0)
            gaps = value.get("gaps", [])

            parts.append(f"\n**Analysis {i}** (Coverage: {coverage:.0%}, Gaps: {gap_count})")
            if gaps:
                gap_summaries = [g.get("requirement", "")[:100] for g in gaps[:3]]
                parts.append(f"  Common gaps: {'; '.join(gap_summaries)}")

    # Long-term memory: Gap patterns
    if gap_patterns:
        parts.append("\n### Known Gap Patterns for this Industry")
        for pattern in gap_patterns[:5]:
            req = pattern.get("pattern", {}).get("requirement", "Unknown")
            usage = pattern.get("usage_count", 0)
            parts.append(f"- {req[:100]} (seen {usage} times)")

    # Procedural memory: Gap identification heuristics
    if gap_heuristics:
        parts.append("\n### Gap Identification Heuristics")
        for heuristic in gap_heuristics[:3]:
            name = heuristic.get("name", "Unknown")
            desc = heuristic.get("description", "")
            parts.append(f"- **{name}**: {desc}")

    # Semantic memory: Requirement categories
    if requirement_categories:
        parts.append("\n### Requirement Categories")
        categories_str = ", ".join([c.get("category", "") for c in requirement_categories[:7]])
        parts.append(f"Categories: {categories_str}")

    # Semantic memory: Service capabilities
    if service_capabilities:
        parts.append("\n### Service Capability Mappings")
        for svc in service_capabilities[:4]:
            service = svc.get("service", "Unknown")
            caps = ", ".join(svc.get("capabilities", [])[:5])
            parts.append(f"- {service}: {caps}")

    return "\n".join(parts) if parts else ""


def _build_metadata_context(metadata: dict) -> str:
    """Build metadata context string for prompt."""
    if not metadata:
        return "No metadata provided."

    parts = []
    if metadata.get("industry"):
        parts.append(f"Industry: {metadata['industry']}")
    if metadata.get("technologies"):
        tech = metadata["technologies"]
        if isinstance(tech, list):
            parts.append(f"Technologies: {', '.join(tech)}")
        else:
            parts.append(f"Technologies: {tech}")
    if metadata.get("service_types"):
        services = metadata["service_types"]
        if isinstance(services, list):
            parts.append(f"Service Types: {', '.join(services)}")
        else:
            parts.append(f"Service Types: {services}")
    if metadata.get("geography"):
        parts.append(f"Geography: {metadata['geography']}")
    if metadata.get("entity_name"):
        parts.append(f"Client: {metadata['entity_name']}")

    return "\n".join(parts) if parts else "No metadata provided."


def _build_template_context(
    proposal_template: Optional[dict],
    selected_components: Optional[list]
) -> str:
    """Build template/components context string for prompt."""
    parts = []

    if proposal_template:
        sections = proposal_template.get("sections", [])
        if sections:
            section_names = [s.get("name", str(s)) for s in sections]
            parts.append(f"Template sections: {', '.join(section_names)}")

    if selected_components:
        parts.append(f"Selected components: {', '.join(selected_components)}")

    return "\n".join(parts) if parts else "No template or components specified."


def _build_pursuits_context(selected_pursuits: list) -> str:
    """Build past pursuits context string for prompt."""
    if not selected_pursuits:
        return "No past pursuits provided. All requirements will be gaps."

    parts = []
    for i, pursuit in enumerate(selected_pursuits, 1):
        pursuit_id = pursuit.get("id", f"pursuit-{i}")
        name = pursuit.get("name", f"Pursuit {i}")
        industry = pursuit.get("industry", "Unknown")
        content = pursuit.get("content", "")

        # Truncate long content
        if len(content) > 2000:
            content = content[:2000] + "..."

        parts.append(f"""
### Pursuit {i}: {name}
ID: {pursuit_id}
Industry: {industry}
Content:
{content}
""")

    return "\n".join(parts)


def _parse_analysis_response(response_text: str) -> dict:
    """Parse JSON analysis data from AI response."""
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
            except json.JSONDecodeError:
                pass

    # Return empty structure if parsing fails
    return {
        "coverage_matrix": [],
        "gaps": [],
        "research_queries": []
    }


def _calculate_overall_coverage(coverage_matrix: list) -> float:
    """Calculate overall coverage percentage from matrix."""
    if not coverage_matrix:
        return 0.0

    scores = [item.get("coverage_score", 0.0) for item in coverage_matrix]
    return sum(scores) / len(scores)


def _identify_gaps_from_matrix(
    coverage_matrix: list,
    proposal_template: Optional[dict]
) -> list:
    """Identify gaps from coverage matrix items with low scores."""
    gaps = []
    sections = []

    if proposal_template:
        sections = [s.get("name") for s in proposal_template.get("sections", [])]

    for item in coverage_matrix:
        score = item.get("coverage_score", 0.0)
        if score < GAP_THRESHOLD:
            requirement = item.get("requirement", "Unknown requirement")

            # Determine priority based on score
            if score < 0.2:
                priority = "high"
            elif score < 0.35:
                priority = "medium"
            else:
                priority = "low"

            # Try to map to template section
            section = None
            if sections:
                # Simple heuristic: match keywords
                req_lower = requirement.lower()
                for s in sections:
                    if any(word in req_lower for word in s.lower().split()):
                        section = s
                        break

            gaps.append({
                "requirement": requirement,
                "priority": priority,
                "reason": f"Coverage score {score:.2f} below threshold",
                "section": section
            })

    return gaps


def _generate_default_queries(gaps: list, metadata: dict) -> list:
    """Generate default research queries for gaps."""
    queries = []
    industry = metadata.get("industry", "")
    technologies = metadata.get("technologies", [])

    if isinstance(technologies, list) and technologies:
        tech_str = technologies[0]
    elif isinstance(technologies, str):
        tech_str = technologies
    else:
        tech_str = ""

    for gap in gaps:  # Generate query for each gap
        requirement = gap.get("requirement", "")

        # Build search-friendly query
        query_parts = []
        if industry:
            query_parts.append(industry.lower())
        if tech_str:
            query_parts.append(tech_str.lower())

        # Extract key terms from requirement
        key_terms = _extract_key_terms(requirement)
        query_parts.extend(key_terms)

        query = " ".join(query_parts)

        # Ensure query is search-engine friendly
        query = re.sub(r'[<>{}]', '', query)
        query = query[:200]  # Max 200 chars

        queries.append({
            "query": query,
            "target_gap": requirement
        })

    return queries


def _extract_key_terms(text: str) -> list:
    """Extract key terms from text for search queries."""
    # Remove common words and extract meaningful terms
    stopwords = {
        'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
        'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
        'would', 'could', 'should', 'may', 'might', 'must', 'shall',
        'of', 'in', 'to', 'for', 'with', 'on', 'at', 'by', 'from',
        'and', 'or', 'but', 'if', 'then', 'else', 'when', 'where',
        'this', 'that', 'these', 'those', 'it', 'its'
    }

    words = re.findall(r'\b[a-zA-Z]{3,}\b', text.lower())
    key_terms = [w for w in words if w not in stopwords]

    # Return top 3-5 terms
    return key_terms[:5]
