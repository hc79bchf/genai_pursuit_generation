"""
Team Composition Agent

Analyzes RFP metadata to recommend team roles and match candidates from the database.
Provides availability calculations and match scoring for candidate-role assignments.

Memory Types Used:
- Short-term (Redis): Current session context, candidate filters
- Long-term (PostgreSQL): Role patterns by industry/service type
- Episodic (ChromaDB): Past team compositions and their outcomes
"""

import os
import time
import json
import hashlib
from datetime import date, timedelta
from typing import TypedDict, Any, Optional, Union

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


# =============================================================================
# TYPE DEFINITIONS
# =============================================================================


class CandidateAvailability(TypedDict):
    """Availability information for a candidate."""
    total_allocation: int  # Current total % allocated
    available_capacity: int  # Remaining % available
    active_engagements: list[dict]  # List of engagement summaries
    next_available_date: Optional[str]  # When significant capacity frees up (ISO date)
    can_support_pursuit: bool  # Has capacity for pursuit work
    can_support_delivery: bool  # Has long-term capacity for delivery


class RoleRecommendation(TypedDict):
    """A recommended role for the pursuit team."""
    role_id: str
    role_name: str
    role_category: str
    is_custom: bool
    reason: str
    priority: str  # "required", "recommended", "optional"


class CandidateMatch(TypedDict):
    """A candidate matched to a role."""
    candidate_id: str
    candidate_name: str
    match_score: float  # 0.0 to 1.0
    match_reasons: list[str]
    availability: CandidateAvailability
    skills_matched: list[str]


class RoleWithCandidates(TypedDict):
    """A role with its matched candidates."""
    role_id: str
    role_name: str
    role_category: str
    is_custom: bool
    priority: str
    reason: str
    candidates: list[CandidateMatch]


class TeamSummary(TypedDict):
    """Summary of the recommended team."""
    total_roles: int
    roles_with_candidates: int
    total_candidates_matched: int
    coverage_percentage: float


class TeamCompositionResult(TypedDict):
    """Complete result from team composition agent."""
    recommended_roles: list[RoleWithCandidates]
    team_summary: TeamSummary
    processing_time_ms: int
    input_tokens: int
    output_tokens: int
    estimated_cost_usd: float


class AvailabilityThresholds(TypedDict):
    """Configurable thresholds for availability calculation."""
    min_pursuit_capacity: int  # Default: 20%
    min_delivery_capacity: int  # Default: 50%
    min_delivery_months: int  # Default: 3 months


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================


def calculate_availability(
    engagements: list[dict],
    thresholds: dict,
    as_of_date: Optional[date] = None,
) -> CandidateAvailability:
    """
    Calculate candidate availability based on active engagements.

    Args:
        engagements: List of engagement dicts with allocation_percentage, status, dates
        thresholds: AvailabilityThresholds with min capacity requirements
        as_of_date: Date to calculate availability as of (default: today)

    Returns:
        CandidateAvailability with capacity and eligibility info
    """
    if as_of_date is None:
        as_of_date = date.today()

    # Get threshold values with defaults
    min_pursuit_capacity = thresholds.get("min_pursuit_capacity", 20)
    min_delivery_capacity = thresholds.get("min_delivery_capacity", 50)
    min_delivery_months = thresholds.get("min_delivery_months", 3)

    # Filter to active engagements that overlap with as_of_date
    active_engagements = []
    total_allocation = 0

    for eng in engagements:
        # Check status
        status = eng.get("status", "active")
        if status not in ("active",):
            continue

        # Check date range
        start_date = eng.get("start_date")
        end_date = eng.get("end_date")

        # Parse dates if they're strings
        if isinstance(start_date, str):
            start_date = date.fromisoformat(start_date)
        if isinstance(end_date, str):
            end_date = date.fromisoformat(end_date)

        # Check if engagement is active as of the given date
        if start_date and start_date > as_of_date:
            continue  # Hasn't started yet
        if end_date and end_date < as_of_date:
            continue  # Already ended

        allocation = eng.get("allocation_percentage", 0)
        total_allocation += allocation

        active_engagements.append({
            "client_name": eng.get("client_name", "Unknown"),
            "project_name": eng.get("project_name"),
            "role": eng.get("role"),
            "allocation_percentage": allocation,
            "start_date": start_date.isoformat() if start_date else None,
            "end_date": end_date.isoformat() if end_date else None,
        })

    # Calculate available capacity
    available_capacity = max(0, 100 - total_allocation)

    # Can support pursuit work?
    can_support_pursuit = available_capacity >= min_pursuit_capacity

    # Can support delivery? Need both capacity AND runway
    # Runway = the period for which we can reliably predict availability
    # If all engagements end soon, we can't guarantee availability beyond that
    can_support_delivery = False
    if available_capacity >= min_delivery_capacity:
        # Check if we have enough runway
        # We need to know their availability extends for min_delivery_months
        min_delivery_date = as_of_date + timedelta(days=min_delivery_months * 30)

        # Find the longest horizon we can predict availability for
        # If someone has no engagements, they're fully available (runway = infinite)
        # If all engagements end in 30 days, runway is only 30 days
        # (because after that, they might get reassigned)

        if not active_engagements:
            # No current engagements = fully available with infinite runway
            has_runway = True
        else:
            # Find the latest end date among active engagements
            # This tells us how far out we can predict their availability
            latest_end_date = None
            has_ongoing = False  # Any engagement without an end date

            for eng in active_engagements:
                end_date_str = eng.get("end_date")
                if end_date_str:
                    eng_end = date.fromisoformat(end_date_str)
                    if latest_end_date is None or eng_end > latest_end_date:
                        latest_end_date = eng_end
                else:
                    # Ongoing engagement = they're committed long-term
                    has_ongoing = True

            if has_ongoing:
                # They have an ongoing commitment, so we know their availability long-term
                has_runway = True
            elif latest_end_date:
                # Their visibility ends when their last engagement ends
                # They need runway extending to min_delivery_date
                has_runway = latest_end_date >= min_delivery_date
            else:
                # No end dates found but has active engagements - shouldn't happen
                has_runway = True

        can_support_delivery = has_runway

    # Calculate next available date (when significant capacity frees up)
    next_available_date = None
    if active_engagements and available_capacity < min_delivery_capacity:
        # Find the earliest end date that would free up enough capacity
        future_dates = []
        for eng in active_engagements:
            end_date_str = eng.get("end_date")
            if end_date_str:
                eng_end = date.fromisoformat(end_date_str)
                if eng_end > as_of_date:
                    future_dates.append((eng_end, eng.get("allocation_percentage", 0)))

        # Sort by date
        future_dates.sort(key=lambda x: x[0])

        # Find when we'd have enough capacity
        projected_capacity = available_capacity
        for end_date, freed_allocation in future_dates:
            projected_capacity += freed_allocation
            if projected_capacity >= min_delivery_capacity:
                next_available_date = end_date.isoformat()
                break

    return CandidateAvailability(
        total_allocation=total_allocation,
        available_capacity=available_capacity,
        active_engagements=active_engagements,
        next_available_date=next_available_date,
        can_support_pursuit=can_support_pursuit,
        can_support_delivery=can_support_delivery,
    )


def calculate_match_score(
    candidate: dict,
    role_requirements: dict,
    return_details: bool = False,
) -> Union[float, tuple[float, dict]]:
    """
    Calculate match score between a candidate and role requirements.

    Weights:
    - Skills match: 40%
    - Experience years: 25%
    - Certifications: 20%
    - Industry fit: 15%

    Args:
        candidate: Candidate dict with skills, certifications, experience, industries
        role_requirements: Role dict with required_skills, min_years_experience, etc.
        return_details: If True, return (score, details) tuple

    Returns:
        Float score (0.0-1.0) or tuple of (score, details dict)
    """
    details = {
        "skills_matched": [],
        "certifications_matched": [],
        "experience_score": 0.0,
        "industry_score": 0.0,
    }

    # Get candidate attributes
    candidate_skills = set(s.lower() for s in candidate.get("skills", []))
    candidate_certs = set(c.lower() for c in candidate.get("certifications", []))
    candidate_experience = candidate.get("years_of_experience", 0)
    candidate_industries = set(i.lower() for i in candidate.get("industries", []))

    # Get role requirements
    required_skills = [s.lower() for s in role_requirements.get("required_skills", [])]
    preferred_skills = [s.lower() for s in role_requirements.get("preferred_skills", [])]
    typical_skills = [s.lower() for s in role_requirements.get("typical_skills", [])]
    all_desired_skills = set(required_skills + preferred_skills + typical_skills)

    required_certs = [c.lower() for c in role_requirements.get("required_certifications", [])]
    min_experience = role_requirements.get("min_years_experience", 0)
    industry_pref = role_requirements.get("industry_preference", "").lower()

    # ===================
    # Skills Score (40%)
    # ===================
    skills_score = 0.0
    if all_desired_skills:
        matched_skills = candidate_skills & all_desired_skills
        skills_score = len(matched_skills) / len(all_desired_skills)
        details["skills_matched"] = list(matched_skills)
    elif candidate_skills:
        # No specific requirements, give partial credit for having skills
        skills_score = 0.5

    # ===================
    # Experience Score (25%)
    # ===================
    experience_score = 0.0
    if min_experience > 0:
        if candidate_experience >= min_experience:
            # Full credit if meets requirement
            experience_score = 1.0
        else:
            # Partial credit based on how close
            experience_score = candidate_experience / min_experience
    else:
        # No requirement, give credit based on experience level
        experience_score = min(1.0, candidate_experience / 10)  # Cap at 10 years

    details["experience_score"] = experience_score

    # ===================
    # Certifications Score (20%)
    # ===================
    cert_score = 0.0
    if required_certs:
        matched_certs = candidate_certs & set(required_certs)
        cert_score = len(matched_certs) / len(required_certs)
        details["certifications_matched"] = list(matched_certs)
    elif candidate_certs:
        # No specific requirements, give partial credit for having certs
        cert_score = 0.5

    # ===================
    # Industry Score (15%)
    # ===================
    industry_score = 0.0
    if industry_pref:
        if industry_pref in candidate_industries:
            industry_score = 1.0
        else:
            # Check for related industries (partial credit)
            industry_score = 0.2 if candidate_industries else 0.0
    else:
        # No preference, give credit for having industry experience
        industry_score = 0.7 if candidate_industries else 0.3

    details["industry_score"] = industry_score

    # ===================
    # Calculate Weighted Score
    # ===================
    total_score = (
        skills_score * 0.40 +
        experience_score * 0.25 +
        cert_score * 0.20 +
        industry_score * 0.15
    )

    # Ensure score is within bounds
    total_score = max(0.0, min(1.0, total_score))

    if return_details:
        return total_score, details
    return total_score


# =============================================================================
# HITL HELPER FUNCTIONS
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
        return original.copy() if original else {}

    merged = (original or {}).copy()
    merged.update(corrected)
    return merged


# =============================================================================
# MEMORY CLASS
# =============================================================================


class TeamCompositionMemory:
    """
    Memory services for Team Composition Agent.

    Memory Types:
    - Short-term (Redis): Current session context, candidate filters
    - Long-term (PostgreSQL): Role patterns by industry/service type
    - Episodic (ChromaDB): Past team compositions and their outcomes
    """

    def __init__(
        self,
        redis_url: str = "redis://localhost:6379/0",
        database_url: Optional[str] = None,
        chroma_persist_dir: str = "./chroma_data",
    ):
        self.short_term = ShortTermMemoryService(redis_url)
        self.long_term = LongTermMemoryService(
            database_url or os.getenv("DATABASE_URL", "postgresql+asyncpg://localhost/pursuit_db")
        )
        self.episodic = EpisodicMemoryService(
            persist_directory=chroma_persist_dir,
            collection_name="team_composition_episodes"
        )

    async def get_role_patterns(
        self,
        industry: str,
        service_types: list[str],
    ) -> list[dict]:
        """
        Get common role patterns for industry/service type from long-term memory.

        Args:
            industry: Industry name
            service_types: List of service types

        Returns:
            List of role pattern dicts
        """
        memory = await self.long_term.retrieve(f"role_patterns:{industry}")
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

    async def get_similar_compositions(
        self,
        metadata: dict,
        n_results: int = 5,
    ) -> list[dict]:
        """
        Find similar past team compositions from episodic memory.

        Args:
            metadata: Current pursuit metadata
            n_results: Number of results to return

        Returns:
            List of similar composition dicts
        """
        query_text = f"{metadata.get('industry', '')} {' '.join(metadata.get('service_types', []))}"

        filter_metadata = {"episode_type": "team_composition"}
        if metadata.get("industry"):
            filter_metadata["industry"] = metadata["industry"]

        return await self.episodic.search_similar(
            query_text=query_text,
            n_results=n_results,
            filter_metadata=filter_metadata,
        )

    async def store_composition_episode(
        self,
        pursuit_id: str,
        result: dict,
        metadata: dict,
    ) -> str:
        """
        Store a team composition episode for learning.

        Args:
            pursuit_id: Pursuit ID
            result: TeamCompositionResult
            metadata: Pursuit metadata

        Returns:
            Episode key
        """
        key = f"team_composition:{pursuit_id}:{hashlib.md5(str(metadata).encode()).hexdigest()[:8]}"

        episode_data = {
            "pursuit_id": pursuit_id,
            "industry": metadata.get("industry"),
            "service_types": metadata.get("service_types", []),
            "total_roles": result.get("team_summary", {}).get("total_roles", 0),
            "roles_with_candidates": result.get("team_summary", {}).get("roles_with_candidates", 0),
            "role_names": [r.get("role_name") for r in result.get("recommended_roles", [])],
        }

        chroma_metadata = {
            "episode_type": "team_composition",
            "pursuit_id": pursuit_id,
            "industry": metadata.get("industry", ""),
            "total_roles": result.get("team_summary", {}).get("total_roles", 0),
        }

        await self.episodic.store(key, episode_data, chroma_metadata)
        return key

    async def close(self) -> None:
        """Close all memory service connections."""
        await self.short_term.close()
        await self.long_term.close()
        await self.episodic.close()


# =============================================================================
# PROMPT TEMPLATE
# =============================================================================


TEAM_COMPOSITION_PROMPT = """You are a Team Composition Agent for proposal responses. Analyze the RFP metadata and recommend an appropriate team structure.

## Your Task
1. Analyze the RFP metadata to understand project requirements
2. Recommend appropriate team roles from the provided taxonomy (and custom roles if needed)
3. For each role, identify the best matching candidates based on skills and availability
4. Assign priority levels to each role (required, recommended, optional)

## RFP Metadata
{metadata_context}

## Available Role Taxonomy
{taxonomy_context}

## Available Candidates
{candidates_context}

## Memory Context (from past compositions)
{memory_context}

## Response Format
Return a JSON object with this exact structure:
{{
  "recommended_roles": [
    {{
      "role_id": "role_id from taxonomy or custom:name for custom roles",
      "role_name": "Human-readable role name",
      "role_category": "leadership|technical|functional|support",
      "is_custom": false,
      "priority": "required|recommended|optional",
      "reason": "Why this role is needed for this pursuit",
      "candidate_matches": [
        {{
          "candidate_id": "candidate UUID",
          "candidate_name": "Full name",
          "match_score": 0.85,
          "match_reasons": ["Skill X matches", "Industry experience"],
          "skills_matched": ["Python", "AWS"]
        }}
      ]
    }}
  ]
}}

## Guidelines
- Recommend 3-8 roles based on project complexity and budget
- Priority "required" for essential leadership/technical roles
- Priority "recommended" for roles that add significant value
- Priority "optional" for nice-to-have roles
- Only include candidates with available capacity (>0% available)
- Sort candidate matches by match_score descending
- Include up to 3 best matching candidates per role
- Use "custom:role_name" format for custom role IDs
- Consider industry and technology requirements when matching
"""


# =============================================================================
# MAIN AGENT FUNCTION
# =============================================================================


async def team_composition_agent(
    metadata: dict,
    available_candidates: list[dict],
    role_taxonomy: list[dict],
    memory: Optional[TeamCompositionMemory] = None,
    session_id: Optional[str] = None,
    pursuit_id: Optional[str] = None,
    edit_tracking: Optional[Any] = None,
    thresholds: Optional[dict] = None,
) -> TeamCompositionResult:
    """
    Analyze RFP metadata and recommend team composition with matched candidates.

    Args:
        metadata: Extracted metadata from the RFP (entity_name, industry, etc.)
        available_candidates: List of candidate dicts with skills, engagements, etc.
        role_taxonomy: List of role definitions from team_roles table
        memory: Optional memory service for learning and context
        session_id: Optional session ID for short-term memory
        pursuit_id: Optional pursuit ID for episodic memory storage
        edit_tracking: Optional EditTrackingMemory for HITL integration
        thresholds: Optional AvailabilityThresholds for capacity calculation

    Returns:
        TeamCompositionResult with recommended roles and matched candidates

    Raises:
        ValidationError: If input is invalid
    """
    start_time = time.time()

    # Validate input
    if metadata is None:
        raise ValidationError("Metadata cannot be None")

    # Default thresholds
    if thresholds is None:
        thresholds = {
            "min_pursuit_capacity": 20,
            "min_delivery_capacity": 50,
            "min_delivery_months": 3,
        }

    # ===================
    # HITL Integration: Check for human-reviewed metadata
    # ===================
    effective_metadata = metadata
    if edit_tracking and pursuit_id:
        try:
            has_review = await edit_tracking.has_review(
                pursuit_id=pursuit_id,
                stage=PipelineStage.metadata_extraction,
            )

            if has_review:
                corrected_output = await edit_tracking.get_corrected_output(
                    pursuit_id=pursuit_id,
                    stage=PipelineStage.metadata_extraction,
                )

                if corrected_output:
                    corrected_metadata = extract_metadata_from_review(corrected_output)
                    effective_metadata = merge_metadata(metadata, corrected_metadata)

                    logger.info(
                        "using_human_reviewed_metadata",
                        pursuit_id=pursuit_id,
                        corrected_fields=list(corrected_metadata.keys()),
                    )
        except Exception as e:
            logger.warning(
                "edit_tracking_check_failed",
                error=str(e),
                pursuit_id=pursuit_id,
            )

    # ===================
    # Calculate availability for all candidates
    # ===================
    candidates_with_availability = []
    for candidate in available_candidates:
        availability = calculate_availability(
            engagements=candidate.get("engagements", []),
            thresholds=thresholds,
        )

        # Only include candidates with some available capacity
        if availability["available_capacity"] > 0:
            candidates_with_availability.append({
                **candidate,
                "availability": availability,
            })

    # ===================
    # Get memory context if available
    # ===================
    similar_compositions = []
    role_patterns = []

    if memory:
        industry = effective_metadata.get("industry", "")
        service_types = effective_metadata.get("service_types", [])

        similar_compositions = await memory.get_similar_compositions(
            effective_metadata, n_results=3
        )
        role_patterns = await memory.get_role_patterns(industry, service_types)

    # ===================
    # Build prompt context
    # ===================
    metadata_context = _build_metadata_context(effective_metadata)
    taxonomy_context = _build_taxonomy_context(role_taxonomy)
    candidates_context = _build_candidates_context(candidates_with_availability, thresholds)
    memory_context = _build_memory_context(similar_compositions, role_patterns)

    prompt = TEAM_COMPOSITION_PROMPT.format(
        metadata_context=metadata_context,
        taxonomy_context=taxonomy_context,
        candidates_context=candidates_context,
        memory_context=memory_context,
    )

    # ===================
    # Call AI
    # ===================
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
                    "content": prompt,
                }
            ],
        )
    except anthropic.APIError as e:
        raise ValidationError(f"AI analysis failed: {e}")

    # ===================
    # Parse response
    # ===================
    response_text = message.content[0].text
    ai_result = _parse_composition_response(response_text)

    # Extract token usage
    input_tokens = message.usage.input_tokens
    output_tokens = message.usage.output_tokens
    estimated_cost = calculate_cost(input_tokens, output_tokens)

    # Log token usage
    log_token_usage(
        agent_name="team_composition",
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        pursuit_id=pursuit_id,
    )

    # ===================
    # Build final result with availability info
    # ===================
    recommended_roles = []
    total_candidates_matched = 0

    for role in ai_result.get("recommended_roles", []):
        role_candidates = []

        for match in role.get("candidate_matches", []):
            candidate_id = match.get("candidate_id")

            # Find the candidate and their availability
            candidate_info = next(
                (c for c in candidates_with_availability if c.get("id") == candidate_id),
                None
            )

            if candidate_info:
                role_candidates.append(CandidateMatch(
                    candidate_id=candidate_id,
                    candidate_name=match.get("candidate_name", "Unknown"),
                    match_score=match.get("match_score", 0.0),
                    match_reasons=match.get("match_reasons", []),
                    availability=candidate_info["availability"],
                    skills_matched=match.get("skills_matched", []),
                ))
                total_candidates_matched += 1

        recommended_roles.append(RoleWithCandidates(
            role_id=role.get("role_id", ""),
            role_name=role.get("role_name", ""),
            role_category=role.get("role_category", ""),
            is_custom=role.get("is_custom", False),
            priority=role.get("priority", "recommended"),
            reason=role.get("reason", ""),
            candidates=role_candidates,
        ))

    # Build team summary
    roles_with_candidates = sum(1 for r in recommended_roles if r["candidates"])
    coverage_pct = (roles_with_candidates / len(recommended_roles) * 100) if recommended_roles else 0

    team_summary = TeamSummary(
        total_roles=len(recommended_roles),
        roles_with_candidates=roles_with_candidates,
        total_candidates_matched=total_candidates_matched,
        coverage_percentage=coverage_pct,
    )

    processing_time_ms = int((time.time() - start_time) * 1000)

    result = TeamCompositionResult(
        recommended_roles=recommended_roles,
        team_summary=team_summary,
        processing_time_ms=processing_time_ms,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        estimated_cost_usd=estimated_cost,
    )

    # Store episode in episodic memory
    if memory and pursuit_id:
        await memory.store_composition_episode(pursuit_id, result, effective_metadata)

    return result


# =============================================================================
# HELPER FUNCTIONS FOR PROMPT BUILDING
# =============================================================================


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
    if metadata.get("estimated_fees"):
        parts.append(f"Estimated Fees: ${metadata['estimated_fees']:,}")
    if metadata.get("complexity"):
        parts.append(f"Complexity: {metadata['complexity']}")
    if metadata.get("specific_requirements"):
        parts.append(f"Specific Requirements: {metadata['specific_requirements']}")

    return "\n".join(parts) if parts else "No metadata provided."


def _build_taxonomy_context(role_taxonomy: list[dict]) -> str:
    """Build role taxonomy context string for prompt."""
    if not role_taxonomy:
        return "No role taxonomy provided. You may recommend custom roles."

    parts = []
    for role in role_taxonomy:
        role_id = role.get("id", "unknown")
        name = role.get("name", "Unknown Role")
        category = role.get("category", "")
        skills = role.get("typical_skills", [])
        min_exp = role.get("min_years_experience", 0)

        skills_str = f" (Skills: {', '.join(skills)})" if skills else ""
        exp_str = f" [Min {min_exp}+ years]" if min_exp else ""

        parts.append(f"- {role_id}: {name} [{category}]{skills_str}{exp_str}")

    return "\n".join(parts)


def _build_candidates_context(
    candidates: list[dict],
    thresholds: dict,
) -> str:
    """Build candidates context string for prompt."""
    if not candidates:
        return "No candidates available."

    parts = []
    for candidate in candidates[:20]:  # Limit to 20 candidates in prompt
        cid = candidate.get("id", "unknown")
        name = candidate.get("full_name", "Unknown")
        title = candidate.get("title", "")
        skills = candidate.get("skills", [])
        experience = candidate.get("years_of_experience", 0)
        industries = candidate.get("industries", [])
        availability = candidate.get("availability", {})

        avail_capacity = availability.get("available_capacity", 100)
        can_pursuit = availability.get("can_support_pursuit", True)
        can_delivery = availability.get("can_support_delivery", True)

        skills_str = ", ".join(skills[:5]) if skills else "None listed"
        industries_str = ", ".join(industries[:3]) if industries else "General"
        availability_str = f"{avail_capacity}% available"
        if can_delivery:
            availability_str += " (delivery OK)"
        elif can_pursuit:
            availability_str += " (pursuit only)"

        parts.append(
            f"- {cid}: {name}"
            f"\n  Title: {title}"
            f"\n  Experience: {experience} years"
            f"\n  Skills: {skills_str}"
            f"\n  Industries: {industries_str}"
            f"\n  Availability: {availability_str}"
        )

    return "\n".join(parts)


def _build_memory_context(
    similar_compositions: list[dict],
    role_patterns: list[dict],
) -> str:
    """Build memory context string from past compositions."""
    parts = []

    if similar_compositions:
        parts.append("### Similar Past Team Compositions")
        for i, comp in enumerate(similar_compositions[:3], 1):
            value = comp.get("value", {})
            industry = value.get("industry", "Unknown")
            roles = value.get("role_names", [])
            parts.append(f"\n**Composition {i}** ({industry})")
            if roles:
                parts.append(f"  Roles: {', '.join(roles[:5])}")

    if role_patterns:
        parts.append("\n### Known Role Patterns for this Industry")
        for pattern in role_patterns[:5]:
            role_name = pattern.get("role_name", "Unknown")
            frequency = pattern.get("frequency", 0)
            parts.append(f"- {role_name} (used {frequency} times)")

    return "\n".join(parts) if parts else "No prior compositions found for reference."


def _parse_composition_response(response_text: str) -> dict:
    """Parse JSON composition data from AI response."""
    import re

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
    return {"recommended_roles": []}
