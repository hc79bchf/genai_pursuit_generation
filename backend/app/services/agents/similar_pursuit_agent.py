"""
Similar Pursuit Identification Agent

Searches past pursuits using vector embeddings and ranks results using a
weighted scoring algorithm. Supports granular slide/section selection
for Human-in-the-Loop (HITL) content curation.

Memory Types Used:
- Short-term (Redis): Current search context, session filters
- Long-term (PostgreSQL): Search patterns, successful component matches
- Episodic (ChromaDB): Past search results and user selections
"""

import os
import time
import json
import hashlib
from datetime import datetime, timedelta
from typing import TypedDict, Any, Optional, Union
from uuid import uuid4

import anthropic
import openai
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
EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIMENSIONS = 1536

# Scoring weights (must sum to 1.0)
# Semantic similarity is the primary factor - content match is most important
# This ensures that high semantic match beats perfect metadata match
WEIGHT_SEMANTIC = 0.60
WEIGHT_METADATA = 0.12
WEIGHT_COMPONENT = 0.10
WEIGHT_QUALITY = 0.08
WEIGHT_WIN_STATUS = 0.05
WEIGHT_RECENCY = 0.05

# Minimum results
MIN_RESULTS = 5
MAX_RESULTS = 10


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


# =============================================================================
# TYPE DEFINITIONS
# =============================================================================


class ComponentDetail(TypedDict):
    """Details for a single component in a pursuit."""
    word_count: int
    relevance_score: float
    preview: str


class SlideMapping(TypedDict):
    """Mapping of component to slide range for PPTX files."""
    start_slide: int
    end_slide: int


class SectionMapping(TypedDict):
    """Mapping of component to section for DOCX files."""
    heading: str
    start_page: int
    end_page: Optional[int]


class SimilarPursuitItem(TypedDict):
    """A single similar pursuit in the results."""
    pursuit_id: str
    pursuit_name: str
    similarity_score: float
    match_explanation: str
    industry: str
    service_types: list[str]
    technologies: list[str]
    win_status: str
    quality_tag: Optional[str]
    created_at: str
    estimated_fees: Optional[float]
    available_components: list[str]
    component_details: dict[str, ComponentDetail]
    content_preview: dict[str, str]
    key_matching_content: list[str]
    component_coverage_score: float
    document_type: Optional[str]
    slide_mappings: Optional[dict[str, SlideMapping]]
    section_mappings: Optional[dict[str, SectionMapping]]


class SearchSummary(TypedDict):
    """Summary of the search operation."""
    total_pursuits_searched: int
    total_pursuits_returned: int
    filters_applied: dict[str, Any]
    search_method: str


class SimilarPursuitResult(TypedDict):
    """Complete result from similar pursuit identification."""
    similar_pursuits: list[SimilarPursuitItem]
    search_summary: SearchSummary
    processing_time_ms: int
    input_tokens: int
    output_tokens: int
    estimated_cost_usd: float


# =============================================================================
# SCORING FUNCTIONS
# =============================================================================


def calculate_recency_score(created_date: Union[datetime, str, None]) -> float:
    """
    Calculate recency score (0.0-1.0) based on creation date.

    More recent pursuits get higher scores.
    - Within 6 months: 0.8-1.0
    - 6-12 months: 0.6-0.8
    - 1-2 years: 0.3-0.6
    - 2+ years: 0.0-0.3

    Args:
        created_date: The creation date as datetime or ISO string

    Returns:
        Recency score between 0.0 and 1.0
    """
    if created_date is None:
        return 0.5  # Default for unknown dates

    if isinstance(created_date, str):
        try:
            created_date = datetime.fromisoformat(created_date.replace("Z", "+00:00"))
        except (ValueError, TypeError):
            return 0.5

    now = datetime.now(created_date.tzinfo) if created_date.tzinfo else datetime.now()
    age_days = (now - created_date).days

    if age_days < 0:
        return 1.0  # Future date (shouldn't happen, but handle gracefully)

    # Linear decay from 1.0 to 0.0 over 3 years (1095 days)
    max_age_days = 1095
    score = max(0.0, 1.0 - (age_days / max_age_days))

    return round(score, 4)


def calculate_metadata_score(pursuit: dict, rfp_metadata: dict) -> float:
    """
    Calculate metadata match score based on exact field matches.

    Args:
        pursuit: Pursuit metadata dict
        rfp_metadata: RFP metadata to match against

    Returns:
        Metadata match score between 0.0 and 1.0
    """
    score = 0.0
    max_score = 0.0

    # Industry match (highest weight)
    if rfp_metadata.get("industry"):
        max_score += 0.4
        if pursuit.get("industry") == rfp_metadata.get("industry"):
            score += 0.4

    # Service type overlap
    rfp_services = set(rfp_metadata.get("service_types", []))
    pursuit_services = set(pursuit.get("service_types", []))
    if rfp_services:
        max_score += 0.3
        if pursuit_services:
            overlap = len(rfp_services & pursuit_services) / len(rfp_services)
            score += 0.3 * overlap

    # Technology match
    rfp_tech = set(rfp_metadata.get("technologies", []))
    pursuit_tech = set(pursuit.get("technologies", []))
    if rfp_tech:
        max_score += 0.2
        if pursuit_tech:
            overlap = len(rfp_tech & pursuit_tech) / len(rfp_tech)
            score += 0.2 * overlap

    # Geography match
    if rfp_metadata.get("geography"):
        max_score += 0.1
        if pursuit.get("geography") == rfp_metadata.get("geography"):
            score += 0.1

    # Normalize to 0-1 range
    if max_score > 0:
        return round(score / max_score, 4)
    return 0.0


def calculate_component_score(
    pursuit: dict,
    selected_components: Optional[list[str]]
) -> float:
    """
    Calculate component coverage score.

    Args:
        pursuit: Pursuit data with available_components
        selected_components: User's selected components (or None)

    Returns:
        Component coverage score between 0.0 and 1.0
    """
    if not selected_components:
        return 0.5  # Neutral when no components selected

    available = set(pursuit.get("available_components", []))
    selected = set(selected_components)

    if not selected:
        return 0.5

    # Calculate overlap
    overlap = len(available & selected)
    score = overlap / len(selected)

    return round(score, 4)


def calculate_quality_boost(quality_tag: Optional[str]) -> float:
    """
    Calculate quality boost based on user quality tags.

    Args:
        quality_tag: Quality tag ("high", "medium", or None)

    Returns:
        Quality boost between 0.0 and 1.0
    """
    if quality_tag == "high":
        return 1.0
    elif quality_tag == "medium":
        return 0.5
    else:
        return 0.0


def calculate_win_boost(win_status: Optional[str]) -> float:
    """
    Calculate win status boost.

    Args:
        win_status: Win status ("won", "lost", "submitted", etc.)

    Returns:
        Win boost between 0.0 and 1.0
    """
    if win_status == "won":
        return 1.0
    elif win_status == "submitted":
        return 0.5
    elif win_status == "lost":
        return 0.25
    else:
        return 0.0


def calculate_weighted_score(pursuit: dict, rfp_metadata: dict) -> float:
    """
    Calculate final weighted score combining all factors.

    Weights (must sum to 1.0):
    - Semantic similarity: 45%
    - Metadata match: 20%
    - Component coverage: 15%
    - Quality boost: 10%
    - Win status: 5%
    - Recency: 5%

    Args:
        pursuit: Pursuit dict with all scoring fields
        rfp_metadata: RFP metadata to match against

    Returns:
        Final weighted score between 0.0 and 1.0
    """
    # Get individual scores
    semantic = pursuit.get("semantic_similarity", 0.5)
    metadata = calculate_metadata_score(pursuit, rfp_metadata)
    component = pursuit.get("component_coverage_score", 0.5)
    quality = calculate_quality_boost(pursuit.get("quality_tag"))
    win = calculate_win_boost(pursuit.get("win_status"))
    recency = pursuit.get("recency_score", 0.5)

    # Calculate weighted sum
    score = (
        WEIGHT_SEMANTIC * semantic +
        WEIGHT_METADATA * metadata +
        WEIGHT_COMPONENT * component +
        WEIGHT_QUALITY * quality +
        WEIGHT_WIN_STATUS * win +
        WEIGHT_RECENCY * recency
    )

    return round(score, 4)


def combine_scores(
    vector_score: float,
    metadata_score: float,
    component_score: float,
    quality_boost: float
) -> float:
    """
    Combine multiple score factors into final score.

    This is a simplified version for direct score combination.

    Args:
        vector_score: Semantic similarity score
        metadata_score: Metadata match score
        component_score: Component coverage score
        quality_boost: Quality tag boost

    Returns:
        Combined score between 0.0 and 1.0
    """
    # Weights for this simplified combination
    combined = (
        0.50 * vector_score +
        0.25 * metadata_score +
        0.15 * component_score +
        0.10 * quality_boost
    )
    return round(min(1.0, combined), 4)


# =============================================================================
# MEMORY SERVICE
# =============================================================================


class SimilarPursuitMemory:
    """Memory services for Similar Pursuit Identification Agent.

    Memory Types:
    - Short-term (Redis): Current search context, session filters
    - Long-term (PostgreSQL): Search patterns, successful component matches
    - Episodic (ChromaDB): Past search results and user selections
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
            collection_name="similar_pursuit_episodes"
        )

    async def store_search_context(
        self,
        session_id: str,
        context: dict
    ) -> None:
        """Store current search context in short-term memory."""
        key = f"similar_pursuit:context:{session_id}"
        await self.short_term.store(key, context, ttl_seconds=7200)  # 2 hours

    async def get_search_context(self, session_id: str) -> Optional[dict]:
        """Retrieve search context from short-term memory."""
        key = f"similar_pursuit:context:{session_id}"
        return await self.short_term.retrieve(key)

    async def get_search_patterns(
        self,
        industry: Optional[str] = None,
        service_types: Optional[list[str]] = None
    ) -> dict:
        """Get successful search patterns from long-term memory."""
        key = f"search_patterns:{industry or 'all'}"
        patterns = await self.long_term.retrieve(
            agent_type="similar_pursuit_identification",
            memory_type="search_patterns",
            key=key
        )
        return patterns or {}

    async def store_search_patterns(
        self,
        industry: str,
        patterns: dict
    ) -> None:
        """Store successful search patterns in long-term memory."""
        key = f"search_patterns:{industry}"
        await self.long_term.store(
            agent_type="similar_pursuit_identification",
            memory_type="search_patterns",
            key=key,
            value=patterns
        )

    async def store_search_episode(
        self,
        pursuit_id: str,
        search_results: list[dict],
        user_selections: Optional[list[str]] = None,
        metadata: Optional[dict] = None
    ) -> str:
        """Store search episode in episodic memory for learning."""
        episode_id = str(uuid4())

        episode_data = {
            "pursuit_id": pursuit_id,
            "search_results": [p["pursuit_id"] for p in search_results[:10]],
            "user_selections": user_selections or [],
            "timestamp": datetime.utcnow().isoformat(),
            "metadata": metadata or {}
        }

        # Create searchable text for the episode
        search_text = f"Search for {metadata.get('industry', '')} {' '.join(metadata.get('service_types', []))}"

        await self.episodic.store(
            document_id=episode_id,
            text=search_text,
            metadata=episode_data
        )

        return episode_id

    async def get_similar_searches(
        self,
        query_text: str,
        limit: int = 5
    ) -> list[dict]:
        """Find similar past searches from episodic memory."""
        results = await self.episodic.search(
            query_text=query_text,
            n_results=limit
        )
        return results


# =============================================================================
# MOCK DATA (for initial implementation)
# =============================================================================


def _get_mock_pursuits() -> list[dict]:
    """Return mock pursuit data for initial testing."""
    return [
        {
            "pursuit_id": "pursuit-001",
            "pursuit_name": "Healthcare Cloud Migration - Acme Medical",
            "industry": "Healthcare",
            "service_types": ["Data", "Engineering"],
            "technologies": ["Microsoft Azure", "Power BI"],
            "win_status": "won",
            "quality_tag": "high",
            "created_at": "2024-09-15",
            "estimated_fees": 750000,
            "geography": "North America",
            "available_components": [
                "Executive Summary",
                "Technical Approach",
                "Team Qualifications",
                "Project Timeline",
                "Pricing"
            ],
            "document_type": "pptx",
            "content_preview": {
                "Executive Summary": "Comprehensive cloud migration for 500-bed hospital...",
                "Technical Approach": "Phased Azure migration with Hub-Spoke architecture...",
                "Team Qualifications": "15 Azure-certified architects with healthcare experience...",
            }
        },
        {
            "pursuit_id": "pursuit-002",
            "pursuit_name": "Financial Analytics Platform - Beta Bank",
            "industry": "Financial Services",
            "service_types": ["Data", "Engineering", "Risk"],
            "technologies": ["Microsoft Azure", "Power BI", "Databricks"],
            "win_status": "won",
            "quality_tag": "high",
            "created_at": "2024-06-01",
            "estimated_fees": 1200000,
            "geography": "North America",
            "available_components": [
                "Executive Summary",
                "Technical Approach",
                "Risk Management",
                "Team Qualifications",
                "Pricing"
            ],
            "document_type": "pptx",
            "content_preview": {
                "Executive Summary": "Real-time analytics platform for risk management...",
                "Technical Approach": "Lakehouse architecture with Delta Lake...",
            }
        },
        {
            "pursuit_id": "pursuit-003",
            "pursuit_name": "Healthcare Data Warehouse - Regional Health",
            "industry": "Healthcare",
            "service_types": ["Data"],
            "technologies": ["Microsoft Azure", "Synapse"],
            "win_status": "submitted",
            "quality_tag": "medium",
            "created_at": "2024-11-01",
            "estimated_fees": 450000,
            "geography": "North America",
            "available_components": [
                "Executive Summary",
                "Technical Approach",
                "Project Timeline"
            ],
            "document_type": "docx",
            "content_preview": {
                "Executive Summary": "Modern data warehouse for healthcare analytics...",
            }
        },
        {
            "pursuit_id": "pursuit-004",
            "pursuit_name": "Government Cloud Assessment - DOD Agency",
            "industry": "Government",
            "service_types": ["Engineering", "Risk"],
            "technologies": ["AWS GovCloud", "Terraform"],
            "win_status": "lost",
            "quality_tag": None,
            "created_at": "2023-08-15",
            "estimated_fees": 320000,
            "geography": "North America",
            "available_components": [
                "Executive Summary",
                "Technical Approach",
                "Security Framework",
                "Team Qualifications"
            ],
            "document_type": "pptx",
            "content_preview": {
                "Executive Summary": "FedRAMP-compliant cloud migration assessment...",
            }
        },
        {
            "pursuit_id": "pursuit-005",
            "pursuit_name": "Pharma Analytics - BioGen Inc",
            "industry": "Healthcare",
            "service_types": ["Data", "Engineering"],
            "technologies": ["Microsoft Azure", "Power BI", "M365 Copilot"],
            "win_status": "won",
            "quality_tag": "high",
            "created_at": "2024-08-20",
            "estimated_fees": 890000,
            "geography": "North America",
            "available_components": [
                "Executive Summary",
                "Technical Approach",
                "Team Qualifications",
                "Project Timeline",
                "Pricing",
                "Case Studies"
            ],
            "document_type": "pptx",
            "content_preview": {
                "Executive Summary": "AI-powered drug discovery analytics platform...",
                "Technical Approach": "Machine learning pipeline with Azure ML...",
                "Case Studies": "Successfully delivered 3 similar pharma projects...",
            }
        },
        {
            "pursuit-006": "pursuit-006",
            "pursuit_name": "Manufacturing IoT Platform - AutoMfg Corp",
            "industry": "Manufacturing",
            "service_types": ["Engineering", "Data"],
            "technologies": ["AWS", "IoT Core", "Kinesis"],
            "win_status": "won",
            "quality_tag": "medium",
            "created_at": "2024-03-10",
            "estimated_fees": 650000,
            "geography": "North America",
            "available_components": [
                "Executive Summary",
                "Technical Approach",
                "Team Qualifications"
            ],
            "document_type": "pptx",
            "content_preview": {}
        },
        {
            "pursuit_id": "pursuit-007",
            "pursuit_name": "Healthcare EHR Integration - Metro Hospital",
            "industry": "Healthcare",
            "service_types": ["Engineering", "Risk"],
            "technologies": ["Microsoft Azure", "FHIR", "Epic Integration"],
            "win_status": "won",
            "quality_tag": "high",
            "created_at": "2024-07-12",
            "estimated_fees": 520000,
            "geography": "North America",
            "available_components": [
                "Executive Summary",
                "Technical Approach",
                "Team Qualifications",
                "Pricing"
            ],
            "document_type": "pptx",
            "content_preview": {
                "Executive Summary": "HIPAA-compliant EHR integration with Epic...",
                "Technical Approach": "FHIR API implementation with secure data exchange...",
            }
        },
    ]


def _calculate_mock_semantic_similarity(
    pursuit: dict,
    rfp_requirements: str,
    rfp_metadata: dict
) -> float:
    """
    Calculate mock semantic similarity score.

    In production, this would use embeddings from OpenAI/ChromaDB.
    """
    score = 0.5  # Base score

    # Boost for industry match
    if pursuit.get("industry") == rfp_metadata.get("industry"):
        score += 0.2

    # Boost for service type overlap
    rfp_services = set(rfp_metadata.get("service_types", []))
    pursuit_services = set(pursuit.get("service_types", []))
    if rfp_services & pursuit_services:
        score += 0.1 * len(rfp_services & pursuit_services) / max(len(rfp_services), 1)

    # Boost for technology overlap
    rfp_tech = set(rfp_metadata.get("technologies", []))
    pursuit_tech = set(pursuit.get("technologies", []))
    if rfp_tech & pursuit_tech:
        score += 0.1 * len(rfp_tech & pursuit_tech) / max(len(rfp_tech), 1)

    # Add some variation based on content keywords
    rfp_lower = rfp_requirements.lower()
    if pursuit.get("industry", "").lower() in rfp_lower:
        score += 0.05
    if "azure" in rfp_lower and "Azure" in str(pursuit.get("technologies", [])):
        score += 0.05
    if "hipaa" in rfp_lower and pursuit.get("industry") == "Healthcare":
        score += 0.05

    return min(1.0, score)


def _generate_match_explanation(pursuit: dict, rfp_metadata: dict) -> str:
    """Generate human-readable explanation for why this pursuit matches."""
    reasons = []

    # Industry match
    if pursuit.get("industry") == rfp_metadata.get("industry"):
        reasons.append(f"Same industry ({pursuit['industry']})")

    # Service type overlap
    rfp_services = set(rfp_metadata.get("service_types", []))
    pursuit_services = set(pursuit.get("service_types", []))
    overlap = rfp_services & pursuit_services
    if overlap:
        reasons.append(f"Matching services: {', '.join(overlap)}")

    # Technology overlap
    rfp_tech = set(rfp_metadata.get("technologies", []))
    pursuit_tech = set(pursuit.get("technologies", []))
    tech_overlap = rfp_tech & pursuit_tech
    if tech_overlap:
        reasons.append(f"Shared technologies: {', '.join(tech_overlap)}")

    # Win status
    if pursuit.get("win_status") == "won":
        reasons.append("Won pursuit with proven approach")
    elif pursuit.get("win_status") == "submitted":
        reasons.append("Recently submitted, current content")

    # Quality tag
    if pursuit.get("quality_tag") == "high":
        reasons.append("Tagged as high quality by reviewers")

    if not reasons:
        reasons.append("Similar project scope and requirements")

    return ". ".join(reasons) + "."


def _generate_key_matching_content(pursuit: dict, rfp_requirements: str) -> list[str]:
    """Generate list of key content points that match the RFP."""
    content = []

    # Add component-based content
    for component, preview in pursuit.get("content_preview", {}).items():
        if preview:
            content.append(f"{component}: {preview[:100]}...")

    if not content:
        content.append(f"Available sections: {', '.join(pursuit.get('available_components', []))}")

    return content[:5]  # Limit to 5 items


def _apply_filters(pursuits: list[dict], filters: Optional[dict]) -> list[dict]:
    """Apply user filters to pursuit list."""
    if not filters:
        return pursuits

    filtered = pursuits

    # Industry filter
    if "industries" in filters and filters["industries"]:
        filtered = [p for p in filtered if p.get("industry") in filters["industries"]]

    # Service type filter
    if "service_types" in filters and filters["service_types"]:
        filter_services = set(filters["service_types"])
        filtered = [
            p for p in filtered
            if set(p.get("service_types", [])) & filter_services
        ]

    # Technology filter
    if "technologies" in filters and filters["technologies"]:
        filter_tech = set(filters["technologies"])
        filtered = [
            p for p in filtered
            if set(p.get("technologies", [])) & filter_tech
        ]

    # Win status filter
    if "win_status" in filters and filters["win_status"]:
        filtered = [p for p in filtered if p.get("win_status") in filters["win_status"]]

    # Fee range filter
    if "min_fees" in filters:
        filtered = [
            p for p in filtered
            if p.get("estimated_fees") and p["estimated_fees"] >= filters["min_fees"]
        ]
    if "max_fees" in filters:
        filtered = [
            p for p in filtered
            if p.get("estimated_fees") and p["estimated_fees"] <= filters["max_fees"]
        ]

    # Date range filter
    if "date_range" in filters:
        date_range = filters["date_range"]
        start = date_range.get("start")
        end = date_range.get("end")

        if start:
            filtered = [
                p for p in filtered
                if p.get("created_at") and p["created_at"] >= start
            ]
        if end:
            filtered = [
                p for p in filtered
                if p.get("created_at") and p["created_at"] <= end
            ]

    return filtered


# =============================================================================
# MAIN AGENT FUNCTION
# =============================================================================


async def similar_pursuit_agent(
    rfp_metadata: dict,
    rfp_requirements_text: str,
    selected_components: Optional[list[str]] = None,
    user_filters: Optional[dict] = None,
    require_all_components: bool = False,
    memory: Optional[SimilarPursuitMemory] = None,
    edit_tracking: Optional[Any] = None,
    session_id: Optional[str] = None,
    pursuit_id: Optional[str] = None,
) -> SimilarPursuitResult:
    """
    Search for similar past pursuits using vector similarity and weighted scoring.

    Args:
        rfp_metadata: Metadata extracted from the RFP (industry, services, etc.)
        rfp_requirements_text: Full text of RFP requirements
        selected_components: Optional list of proposal components to prioritize
        user_filters: Optional filters to apply (industry, service_types, etc.)
        require_all_components: If True, only return pursuits with ALL selected components
        memory: Optional memory service for context and learning
        edit_tracking: Optional EditTrackingMemory for HITL integration
        session_id: Optional session ID for memory tracking
        pursuit_id: Optional pursuit ID for memory and HITL tracking

    Returns:
        SimilarPursuitResult with ranked pursuits and metadata

    Raises:
        ValidationError: If requirements text is empty
    """
    start_time = time.time()
    input_tokens = 0
    output_tokens = 0

    # Validate input
    if not rfp_requirements_text or not rfp_requirements_text.strip():
        raise ValidationError("RFP requirements text cannot be empty")

    # Check for HITL corrections from metadata extraction stage
    effective_metadata = rfp_metadata.copy()
    if edit_tracking and pursuit_id:
        try:
            # Check if there's a human-reviewed metadata output
            has_review = await edit_tracking.has_review(
                pursuit_id=pursuit_id,
                stage=PipelineStage.metadata_extraction
            )

            if has_review:
                reviewed_output = await edit_tracking.get_corrected_output(
                    pursuit_id=pursuit_id,
                    stage=PipelineStage.metadata_extraction
                )
                if reviewed_output:
                    corrected = extract_metadata_from_review(reviewed_output)
                    effective_metadata = merge_metadata(rfp_metadata, corrected)
                    logger.info(
                        "Using human-reviewed metadata",
                        pursuit_id=pursuit_id,
                        corrected_fields=list(corrected.keys())
                    )
        except Exception as e:
            logger.warning(
                "Failed to get HITL corrections, using original metadata",
                error=str(e)
            )

    # Store search context in memory
    if memory and session_id:
        await memory.store_search_context(
            session_id=session_id,
            context={
                "metadata": effective_metadata,
                "components": selected_components,
                "filters": user_filters,
                "timestamp": datetime.utcnow().isoformat()
            }
        )

    # Get mock pursuits (in production, this would query ChromaDB)
    all_pursuits = _get_mock_pursuits()
    total_searched = len(all_pursuits)

    # Apply user filters
    filtered_pursuits = _apply_filters(all_pursuits, user_filters)

    # Calculate scores for each pursuit
    scored_pursuits = []
    for pursuit in filtered_pursuits:
        # Calculate semantic similarity (mock for now)
        semantic_sim = _calculate_mock_semantic_similarity(
            pursuit, rfp_requirements_text, effective_metadata
        )
        pursuit["semantic_similarity"] = semantic_sim

        # Calculate recency score
        recency = calculate_recency_score(pursuit.get("created_at"))
        pursuit["recency_score"] = recency

        # Calculate component coverage
        component_score = calculate_component_score(pursuit, selected_components)
        pursuit["component_coverage_score"] = component_score

        # Filter by component requirement if requested
        if require_all_components and selected_components:
            available = set(pursuit.get("available_components", []))
            required = set(selected_components)
            if not required.issubset(available):
                continue

        # Calculate final weighted score
        final_score = calculate_weighted_score(pursuit, effective_metadata)
        pursuit["similarity_score"] = final_score

        # Generate explanation and key content
        pursuit["match_explanation"] = _generate_match_explanation(pursuit, effective_metadata)
        pursuit["key_matching_content"] = _generate_key_matching_content(
            pursuit, rfp_requirements_text
        )

        # Add component details
        pursuit["component_details"] = {}
        for component in pursuit.get("available_components", []):
            preview = pursuit.get("content_preview", {}).get(component, "")
            pursuit["component_details"][component] = {
                "word_count": len(preview.split()) if preview else 100,
                "relevance_score": 0.8 if component in (selected_components or []) else 0.5,
                "preview": preview[:200] if preview else ""
            }

        # Add slide/section mappings based on document type
        if pursuit.get("document_type") == "pptx":
            pursuit["slide_mappings"] = {}
            for i, component in enumerate(pursuit.get("available_components", [])):
                pursuit["slide_mappings"][component] = {
                    "start_slide": i * 2 + 1,
                    "end_slide": i * 2 + 2
                }
            pursuit["section_mappings"] = None
        elif pursuit.get("document_type") == "docx":
            pursuit["section_mappings"] = {}
            for i, component in enumerate(pursuit.get("available_components", [])):
                pursuit["section_mappings"][component] = {
                    "heading": component,
                    "start_page": i * 3 + 1,
                    "end_page": i * 3 + 3
                }
            pursuit["slide_mappings"] = None

        scored_pursuits.append(pursuit)

    # Sort by similarity score (descending)
    scored_pursuits.sort(key=lambda x: x["similarity_score"], reverse=True)

    # Take top results (5-10)
    num_results = min(MAX_RESULTS, max(MIN_RESULTS, len(scored_pursuits)))
    top_pursuits = scored_pursuits[:num_results]

    # Build result items
    similar_pursuits: list[SimilarPursuitItem] = []
    for p in top_pursuits:
        item: SimilarPursuitItem = {
            "pursuit_id": p.get("pursuit_id", ""),
            "pursuit_name": p.get("pursuit_name", ""),
            "similarity_score": p.get("similarity_score", 0.0),
            "match_explanation": p.get("match_explanation", ""),
            "industry": p.get("industry", ""),
            "service_types": p.get("service_types", []),
            "technologies": p.get("technologies", []),
            "win_status": p.get("win_status", ""),
            "quality_tag": p.get("quality_tag"),
            "created_at": p.get("created_at", ""),
            "estimated_fees": p.get("estimated_fees"),
            "available_components": p.get("available_components", []),
            "component_details": p.get("component_details", {}),
            "content_preview": p.get("content_preview", {}),
            "key_matching_content": p.get("key_matching_content", []),
            "component_coverage_score": p.get("component_coverage_score", 0.0),
            "document_type": p.get("document_type"),
            "slide_mappings": p.get("slide_mappings"),
            "section_mappings": p.get("section_mappings"),
        }
        similar_pursuits.append(item)

    # Build search summary
    search_summary: SearchSummary = {
        "total_pursuits_searched": total_searched,
        "total_pursuits_returned": len(similar_pursuits),
        "filters_applied": user_filters or {},
        "search_method": "vector_search + metadata_filtering + weighted_scoring"
    }

    # Calculate processing time
    processing_time_ms = int((time.time() - start_time) * 1000)

    # Store search episode in memory for learning
    if memory and pursuit_id:
        await memory.store_search_episode(
            pursuit_id=pursuit_id,
            search_results=similar_pursuits,
            metadata=effective_metadata
        )

    # Calculate estimated cost (minimal for mock, real cost would come from embeddings API)
    estimated_cost = 0.001  # Placeholder

    # Build final result
    result: SimilarPursuitResult = {
        "similar_pursuits": similar_pursuits,
        "search_summary": search_summary,
        "processing_time_ms": processing_time_ms,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "estimated_cost_usd": estimated_cost
    }

    logger.info(
        "Similar pursuit search completed",
        pursuit_id=pursuit_id,
        total_searched=total_searched,
        total_returned=len(similar_pursuits),
        processing_time_ms=processing_time_ms
    )

    return result
