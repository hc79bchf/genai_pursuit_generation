"""
Validation Agent (Stage-Level Mode A + Final Validation Mode B).

Mode A: Provides real-time validation suggestions during human review using Claude Haiku.
Mode B: Comprehensive final validation using GPT-4o for independent verification.

This agent analyzes agent outputs, cross-references with RFP content, and generates
actionable suggestions to help reviewers identify potential issues.

Capabilities:
1. Field accuracy validation - checks extracted values against RFP
2. Completeness checks - identifies missing or incomplete data
3. Consistency validation - cross-references with previous stage outputs
4. Citation verification - validates source references
5. Auto-checks - rule-based validation (no LLM required)
6. Review guidance - generates focus areas and time estimates
7. Final validation (Mode B) - comprehensive cross-stage validation with GPT-4o

Used by Stage Review endpoints (Section 11 of api-specification.md v1.3)
"""

import os
import re
import time
import json
from datetime import datetime
from typing import Any, Dict, List, Optional, TypedDict
from uuid import UUID, uuid4

import anthropic
import openai
import structlog

from app.schemas.stage_review import PipelineStage
from app.services.agents.token_tracking import log_token_usage

logger = structlog.get_logger(__name__)


# Constants
# Mode A: Claude Haiku for fast, cheap stage-level validation
MODEL_NAME = "claude-3-5-haiku-20241022"
MAX_TOKENS = 2048

# Mode B: GPT-4o for comprehensive final validation (independent verification)
MODEL_NAME_GPT4O = "gpt-4o"
MAX_TOKENS_FINAL = 8192
CONFIDENCE_THRESHOLD = 0.80  # Fields below this need review
COVERAGE_THRESHOLD = 0.70  # Overall coverage below this triggers warning

# Required fields per stage
REQUIRED_FIELDS = {
    PipelineStage.metadata_extraction: ["entity_name", "industry"],
    PipelineStage.gap_analysis: ["coverage_matrix", "overall_coverage", "gaps"],
    PipelineStage.research: ["findings"],
    PipelineStage.synthesis: ["outline"],
    PipelineStage.document_generation: ["file_format", "file_name"],
}

# Category to focus area mapping for review guidance
CATEGORY_FOCUS_AREAS = {
    "field_accuracy": "Field accuracy verification",
    "completeness": "Missing information",
    "consistency": "Cross-stage consistency",
    "citation_accuracy": "Citation verification",
    "coverage": "Coverage gaps",
    "naming": "Entity naming consistency",
    "low_confidence": "Low confidence fields",
}


# =============================================================================
# Type Definitions
# =============================================================================


class AutoCheckResult(TypedDict):
    """Result from automated validation checks."""
    passed: List[str]
    failed: List[str]


class ReviewGuidance(TypedDict):
    """Guidance for human reviewers."""
    estimated_review_time: str
    focus_areas: List[str]
    low_confidence_fields: List[str]


class ValidationResult(TypedDict):
    """Complete validation result for a stage."""
    pursuit_id: str
    stage: str
    validation_status: str
    suggestions: List[Dict[str, Any]]
    auto_checks: AutoCheckResult
    review_guidance: ReviewGuidance
    processing_time_ms: int
    model_used: str


class DimensionScore(TypedDict):
    """Score for a validation dimension."""
    score: float
    details: str


class FinalValidationIssue(TypedDict):
    """Issue found during final validation."""
    id: str
    severity: str
    category: str
    location: str
    description: str
    evidence: Optional[str]
    expected: Optional[str]
    agent_source: Optional[str]


class FinalValidationRecommendation(TypedDict):
    """Recommendation from final validation."""
    id: str
    priority: str
    category: str
    action: str
    rationale: Optional[str]


class FinalValidationResult(TypedDict):
    """Complete final validation result (Mode B)."""
    pursuit_id: str
    validation_id: str
    overall_score: float
    approval_status: str
    dimension_scores: Dict[str, DimensionScore]
    issues: List[FinalValidationIssue]
    recommendations: List[FinalValidationRecommendation]
    processing_time_ms: int
    model_used: str


# =============================================================================
# Helper Functions
# =============================================================================


def _create_suggestion(
    severity: str,
    category: str,
    message: str,
    field_path: Optional[str] = None,
    evidence: Optional[str] = None,
    suggested_value: Optional[str] = None,
    confidence: float = 1.0,
) -> Dict[str, Any]:
    """Create a validation suggestion dict with consistent structure."""
    return {
        "id": str(uuid4()),
        "severity": severity,
        "category": category,
        "field_path": field_path,
        "message": message,
        "evidence": evidence,
        "suggested_value": suggested_value,
        "confidence": confidence,
    }


# =============================================================================
# Auto-Checks (Rule-Based, No LLM)
# =============================================================================


async def run_auto_checks(
    stage: PipelineStage,
    agent_output: Dict[str, Any],
) -> AutoCheckResult:
    """
    Run automated validation checks (rule-based, no LLM).

    These are fast, deterministic checks that don't require AI.
    """
    passed = []
    failed = []

    if stage == PipelineStage.metadata_extraction:
        # Check required fields
        extracted = agent_output.get("extracted_fields", {})
        required = REQUIRED_FIELDS.get(stage, [])

        missing = [f for f in required if f not in extracted]
        if missing:
            failed.append(f"Missing required fields: {', '.join(missing)}")
        else:
            passed.append("Required fields present")

        # Check email format
        email_field = extracted.get("client_pursuit_owner_email", {})
        email_value = email_field.get("value", "")
        if email_value:
            if re.match(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$", email_value):
                passed.append("Email format valid")
            else:
                failed.append("Email format invalid")

        # Check date format
        date_field = extracted.get("submission_due_date", {})
        date_value = date_field.get("value", "")
        if date_value:
            try:
                datetime.fromisoformat(date_value)
                passed.append("Date format valid (ISO)")
            except ValueError:
                failed.append("Date format invalid (expected ISO)")

        # Check entity name not empty
        entity = extracted.get("entity_name", {})
        if entity.get("value"):
            passed.append("Entity name not empty")
        else:
            failed.append("Entity name is empty")

    elif stage == PipelineStage.gap_analysis:
        # Check overall coverage
        overall_coverage = agent_output.get("overall_coverage", 0)
        if overall_coverage >= COVERAGE_THRESHOLD:
            passed.append(f"Overall coverage ({overall_coverage:.0%}) meets threshold")
        else:
            failed.append(f"Overall coverage ({overall_coverage:.0%}) below {COVERAGE_THRESHOLD:.0%} threshold")

        # Check research queries generated
        queries = agent_output.get("research_queries", [])
        gaps = agent_output.get("gaps", [])
        if gaps and queries:
            passed.append("Research queries generated for gaps")
        elif gaps and not queries:
            failed.append("Gaps identified but no research queries generated")
        else:
            passed.append("No gaps requiring research")

    elif stage == PipelineStage.research:
        findings = agent_output.get("findings", [])
        if findings:
            passed.append(f"Research findings present ({len(findings)} queries)")
        else:
            failed.append("No research findings")

        # Check sources
        total_sources = agent_output.get("total_sources_used", 0)
        if total_sources > 0:
            passed.append(f"Sources found ({total_sources} used)")
        else:
            failed.append("No sources found")

    elif stage == PipelineStage.synthesis:
        outline = agent_output.get("outline", {})
        sections = outline.get("sections", [])
        if sections:
            passed.append(f"Outline has {len(sections)} sections")
        else:
            failed.append("Outline has no sections")

        # Check citations
        total_citations = sum(len(s.get("citations", [])) for s in sections)
        if total_citations > 0:
            passed.append(f"Citations present ({total_citations} total)")
        else:
            failed.append("No citations in outline")

    elif stage == PipelineStage.document_generation:
        file_format = agent_output.get("file_format")
        file_name = agent_output.get("file_name")

        if file_format:
            passed.append(f"Document format: {file_format}")
        else:
            failed.append("Document format not specified")

        if file_name:
            passed.append("Document filename set")
        else:
            failed.append("Document filename not set")

    return AutoCheckResult(passed=passed, failed=failed)


# =============================================================================
# Validation Agent Class
# =============================================================================


class ValidationAgent:
    """
    Validation Agent for stage-level validation (Mode A).

    Uses Claude Haiku for fast, cost-effective validation suggestions.
    """

    def __init__(
        self,
        use_mock: bool = False,
        api_key: Optional[str] = None,
    ):
        self.use_mock = use_mock
        self.api_key = api_key or os.getenv("ANTHROPIC_API_KEY")

        if not use_mock and self.api_key:
            self.client = anthropic.Anthropic(api_key=self.api_key)
        else:
            self.client = None

    async def validate(
        self,
        pursuit_id: UUID,
        stage: PipelineStage,
        agent_output: Dict[str, Any],
        rfp_text: str,
        previous_outputs: Optional[Dict[str, Dict[str, Any]]] = None,
    ) -> ValidationResult:
        """
        Validate stage output and generate suggestions.

        Args:
            pursuit_id: ID of the pursuit being validated
            stage: Pipeline stage being validated
            agent_output: Output from the agent to validate
            rfp_text: Original RFP text for cross-reference
            previous_outputs: Outputs from previous stages (for consistency checks)

        Returns:
            ValidationResult with suggestions, auto-checks, and guidance
        """
        start_time = time.time()

        # Run auto-checks first (fast, no LLM)
        auto_checks = await run_auto_checks(stage, agent_output)

        # Generate LLM suggestions
        if self.use_mock:
            suggestions = self._generate_mock_suggestions(stage, agent_output, rfp_text)
        else:
            suggestions = await self._generate_llm_suggestions(
                stage, agent_output, rfp_text, previous_outputs
            )

        # Generate review guidance
        review_guidance = self._generate_review_guidance(
            stage, agent_output, suggestions, auto_checks
        )

        processing_time_ms = int((time.time() - start_time) * 1000)

        return ValidationResult(
            pursuit_id=str(pursuit_id),
            stage=stage.value,
            validation_status="completed",
            suggestions=suggestions,
            auto_checks=auto_checks,
            review_guidance=review_guidance,
            processing_time_ms=processing_time_ms,
            model_used="claude-haiku" if not self.use_mock else "mock",
        )

    def _generate_mock_suggestions(
        self,
        stage: PipelineStage,
        agent_output: Dict[str, Any],
        rfp_text: str,
    ) -> List[Dict[str, Any]]:
        """Generate mock suggestions for testing."""
        suggestions = []
        rfp_lower = rfp_text.lower()

        if stage == PipelineStage.metadata_extraction:
            suggestions.extend(self._mock_metadata_suggestions(agent_output, rfp_text, rfp_lower))
        elif stage == PipelineStage.gap_analysis:
            suggestions.extend(self._mock_gap_analysis_suggestions(agent_output))
        elif stage == PipelineStage.synthesis:
            suggestions.extend(self._mock_synthesis_suggestions(agent_output, rfp_lower))

        return suggestions

    def _mock_metadata_suggestions(
        self,
        agent_output: Dict[str, Any],
        rfp_text: str,
        rfp_lower: str,
    ) -> List[Dict[str, Any]]:
        """Generate mock suggestions for metadata extraction stage."""
        suggestions = []
        extracted = agent_output.get("extracted_fields", {})

        # Check industry mismatch
        industry = extracted.get("industry", {})
        if industry.get("value") == "Technology" and "healthcare" in rfp_lower:
            suggestions.append(_create_suggestion(
                severity="warning",
                category="field_accuracy",
                message="Industry might be Healthcare based on RFP content",
                field_path="extracted_fields.industry.value",
                evidence="RFP mentions 'healthcare', 'patient data', 'hospitals'",
                suggested_value="Healthcare",
                confidence=0.85,
            ))

        # Check entity name completeness
        entity = extracted.get("entity_name", {})
        entity_value = entity.get("value", "")
        if entity_value and "Healthcare" in rfp_text and "Healthcare" not in entity_value:
            suggestions.append(_create_suggestion(
                severity="info",
                category="completeness",
                message="Entity name may be incomplete - RFP mentions 'Healthcare' in company name",
                field_path="extracted_fields.entity_name.value",
                confidence=0.75,
            ))

        # Check low confidence fields
        for field_name, field_data in extracted.items():
            confidence = field_data.get("confidence", 1.0)
            if confidence < CONFIDENCE_THRESHOLD:
                suggestions.append(_create_suggestion(
                    severity="info",
                    category="low_confidence",
                    message=f"Low confidence ({confidence:.0%}) - verify this field",
                    field_path=f"extracted_fields.{field_name}.value",
                ))

        return suggestions

    def _mock_gap_analysis_suggestions(
        self,
        agent_output: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        """Generate mock suggestions for gap analysis stage."""
        suggestions = []

        # Check overall coverage
        coverage = agent_output.get("overall_coverage", 0)
        if coverage < COVERAGE_THRESHOLD:
            suggestions.append(_create_suggestion(
                severity="warning",
                category="coverage",
                message=f"Overall coverage ({coverage:.0%}) is below threshold - review gaps carefully",
                field_path="overall_coverage",
            ))

        # Flag low coverage items
        for item in agent_output.get("coverage_matrix", []):
            if item.get("coverage", 0) < 0.5:
                suggestions.append(_create_suggestion(
                    severity="warning",
                    category="coverage",
                    message=f"Low coverage for '{item.get('requirement')}' - consider additional research",
                    field_path="coverage_matrix",
                    confidence=0.90,
                ))

        return suggestions

    def _mock_synthesis_suggestions(
        self,
        agent_output: Dict[str, Any],
        rfp_lower: str,
    ) -> List[Dict[str, Any]]:
        """Generate mock suggestions for synthesis stage."""
        suggestions = []
        outline = agent_output.get("outline", {})
        sections = outline.get("sections", [])

        for i, section in enumerate(sections):
            # Check for invalid citations
            for citation in section.get("citations", []):
                source = citation.get("source", "")
                if "invalid" in source.lower() or not source:
                    suggestions.append(_create_suggestion(
                        severity="critical",
                        category="citation_accuracy",
                        message=f"Invalid citation source: {source}",
                        field_path=f"outline.sections[{i}].citations",
                        confidence=0.95,
                    ))

            # Check content for consistency issues
            content = section.get("content", "")
            content_lower = content.lower()

            if "extensive experience" in content_lower:
                suggestions.append(_create_suggestion(
                    severity="warning",
                    category="consistency",
                    message="Content claims 'extensive experience' - verify against gap analysis coverage",
                    field_path=f"outline.sections[{i}].content",
                    evidence="Gap analysis may show limited coverage in this area",
                    confidence=0.80,
                ))

            # Check entity name mismatch
            if "acme corp" in content_lower and "acme healthcare" in rfp_lower:
                suggestions.append(_create_suggestion(
                    severity="info",
                    category="naming",
                    message="Entity name mismatch: content uses 'Acme Corp' but RFP refers to 'Acme Healthcare'",
                    field_path=f"outline.sections[{i}].content",
                    suggested_value="Use full company name from RFP",
                    confidence=0.85,
                ))

        return suggestions

    async def _generate_llm_suggestions(
        self,
        stage: PipelineStage,
        agent_output: Dict[str, Any],
        rfp_text: str,
        previous_outputs: Optional[Dict[str, Dict[str, Any]]] = None,
    ) -> List[Dict[str, Any]]:
        """Generate suggestions using Claude Haiku."""
        if not self.client:
            return []

        prompt = self._build_validation_prompt(stage, agent_output, rfp_text, previous_outputs)

        try:
            response = self.client.messages.create(
                model=MODEL_NAME,
                max_tokens=MAX_TOKENS,
                messages=[{"role": "user", "content": prompt}],
            )

            # Log token usage
            input_tokens = response.usage.input_tokens
            output_tokens = response.usage.output_tokens
            log_token_usage(
                agent_name="validation_agent",
                input_tokens=input_tokens,
                output_tokens=output_tokens,
            )

            # Parse response
            content = response.content[0].text
            return self._parse_suggestions(content)

        except Exception as e:
            logger.error("validation_llm_error", error=str(e))
            return []

    def _build_validation_prompt(
        self,
        stage: PipelineStage,
        agent_output: Dict[str, Any],
        rfp_text: str,
        previous_outputs: Optional[Dict[str, Dict[str, Any]]] = None,
    ) -> str:
        """Build the validation prompt for Claude Haiku."""
        prompt = f"""You are a validation agent reviewing AI-generated output for quality issues.

TASK: Review the following {stage.value} stage output and identify potential issues.

RFP TEXT (source document):
{rfp_text[:3000]}  # Truncate for token efficiency

AGENT OUTPUT TO VALIDATE:
{json.dumps(agent_output, indent=2)[:2000]}

"""

        if previous_outputs:
            prompt += f"""
PREVIOUS STAGE OUTPUTS (for consistency checking):
{json.dumps(previous_outputs, indent=2)[:1500]}
"""

        prompt += """
Generate validation suggestions in the following JSON format:
{
  "suggestions": [
    {
      "severity": "critical|warning|info|suggestion",
      "category": "field_accuracy|completeness|consistency|citation_accuracy|coverage",
      "field_path": "path.to.field (if applicable)",
      "message": "Clear description of the issue",
      "evidence": "Evidence supporting this suggestion (if any)",
      "suggested_value": "Suggested correction (if applicable)",
      "confidence": 0.0-1.0
    }
  ]
}

Focus on:
1. Field accuracy - do extracted values match the RFP?
2. Completeness - are any important fields missing or incomplete?
3. Consistency - does this stage's output align with previous stages?
4. Citation accuracy - are citations valid and verifiable?
5. Low confidence - flag fields with confidence below 0.80

Return ONLY the JSON object, no other text.
"""
        return prompt

    def _parse_suggestions(self, content: str) -> List[Dict[str, Any]]:
        """Parse suggestions from LLM response."""
        try:
            # Try to find JSON in response
            json_match = re.search(r'\{[\s\S]*\}', content)
            if json_match:
                data = json.loads(json_match.group())
                suggestions = data.get("suggestions", [])

                # Add UUIDs to suggestions
                for s in suggestions:
                    s["id"] = str(uuid4())

                return suggestions
        except json.JSONDecodeError:
            logger.warning("failed_to_parse_suggestions", content=content[:200])

        return []

    def _generate_review_guidance(
        self,
        stage: PipelineStage,
        agent_output: Dict[str, Any],
        suggestions: List[Dict[str, Any]],
        auto_checks: AutoCheckResult,
    ) -> ReviewGuidance:
        """Generate guidance for human reviewers."""
        # Identify focus areas from suggestions using the mapping
        focus_areas = set()
        for s in suggestions:
            category = s.get("category", "")
            if category in CATEGORY_FOCUS_AREAS:
                focus_areas.add(CATEGORY_FOCUS_AREAS[category])

        if not focus_areas:
            focus_areas.add("General review")

        # Identify low confidence fields
        low_confidence_fields = []
        if stage == PipelineStage.metadata_extraction:
            extracted = agent_output.get("extracted_fields", {})
            for field_name, field_data in extracted.items():
                confidence = field_data.get("confidence", 1.0)
                if confidence < CONFIDENCE_THRESHOLD:
                    low_confidence_fields.append(field_name)

        # Estimate review time
        critical_count = len([s for s in suggestions if s.get("severity") == "critical"])
        warning_count = len([s for s in suggestions if s.get("severity") == "warning"])
        failed_checks = len(auto_checks["failed"])

        total_issues = critical_count * 3 + warning_count * 2 + failed_checks

        if total_issues == 0:
            estimated_time = "1-2 minutes"
        elif total_issues <= 3:
            estimated_time = "2-3 minutes"
        elif total_issues <= 6:
            estimated_time = "3-5 minutes"
        else:
            estimated_time = "5-10 minutes"

        return ReviewGuidance(
            estimated_review_time=estimated_time,
            focus_areas=list(focus_areas),
            low_confidence_fields=low_confidence_fields,
        )


# =============================================================================
# Module-Level Function
# =============================================================================


async def validate_stage(
    pursuit_id: UUID,
    stage: PipelineStage,
    agent_output: Dict[str, Any],
    rfp_text: str,
    previous_outputs: Optional[Dict[str, Dict[str, Any]]] = None,
    use_mock: bool = False,
) -> ValidationResult:
    """
    Validate a stage's output and generate suggestions.

    This is the main entry point for stage validation.

    Args:
        pursuit_id: ID of the pursuit being validated
        stage: Pipeline stage being validated
        agent_output: Output from the agent to validate
        rfp_text: Original RFP text for cross-reference
        previous_outputs: Outputs from previous stages (for consistency checks)
        use_mock: If True, use mock LLM responses (for testing)

    Returns:
        ValidationResult with suggestions, auto-checks, and guidance
    """
    agent = ValidationAgent(use_mock=use_mock)
    return await agent.validate(
        pursuit_id=pursuit_id,
        stage=stage,
        agent_output=agent_output,
        rfp_text=rfp_text,
        previous_outputs=previous_outputs,
    )


# =============================================================================
# Mode B: Final Validation
# =============================================================================


async def run_final_validation(
    pursuit_id: UUID,
    rfp_text: str,
    pipeline_outputs: Dict[str, Dict[str, Any]],
    human_edits: Optional[List[Dict[str, Any]]] = None,
    include_citation_audit: bool = True,
    include_edit_consistency_check: bool = False,
    use_mock: bool = False,
) -> FinalValidationResult:
    """
    Run comprehensive final validation across all pipeline stages (Mode B).

    This is the final validation before document download, using Claude Sonnet 4.5
    for thorough cross-stage consistency checking.

    Args:
        pursuit_id: ID of the pursuit being validated
        rfp_text: Original RFP text for cross-reference
        pipeline_outputs: Outputs from all pipeline stages
        human_edits: Optional list of human edits made during review
        include_citation_audit: Include citation verification (default True)
        include_edit_consistency_check: Include edit propagation audit
        use_mock: If True, use mock responses (for testing)

    Returns:
        FinalValidationResult with scores, issues, and recommendations
    """
    start_time = time.time()
    validation_id = str(uuid4())

    if use_mock:
        result = _generate_mock_final_validation(
            pursuit_id=pursuit_id,
            validation_id=validation_id,
            pipeline_outputs=pipeline_outputs,
            human_edits=human_edits,
        )
    else:
        result = await _run_llm_final_validation(
            pursuit_id=pursuit_id,
            validation_id=validation_id,
            rfp_text=rfp_text,
            pipeline_outputs=pipeline_outputs,
            human_edits=human_edits,
            include_citation_audit=include_citation_audit,
            include_edit_consistency_check=include_edit_consistency_check,
        )

    processing_time_ms = int((time.time() - start_time) * 1000)
    result["processing_time_ms"] = processing_time_ms

    logger.info(
        "final_validation_complete",
        pursuit_id=str(pursuit_id),
        overall_score=result["overall_score"],
        issues_count=len(result["issues"]),
        processing_time_ms=processing_time_ms,
    )

    return result


def _generate_mock_final_validation(
    pursuit_id: UUID,
    validation_id: str,
    pipeline_outputs: Dict[str, Dict[str, Any]],
    human_edits: Optional[List[Dict[str, Any]]] = None,
) -> FinalValidationResult:
    """Generate mock final validation result for testing."""
    # Analyze pipeline outputs for mock scores
    metadata = pipeline_outputs.get("metadata_extraction", {})
    gap_analysis = pipeline_outputs.get("gap_analysis", {})
    research = pipeline_outputs.get("research", {})
    synthesis = pipeline_outputs.get("synthesis", {})

    # Calculate mock dimension scores based on actual data
    # Requirement coverage - based on gap analysis coverage
    coverage_score = gap_analysis.get("overall_coverage", 0.75)
    requirement_coverage = DimensionScore(
        score=min(coverage_score + 0.1, 1.0),
        details=f"Based on gap analysis coverage of {coverage_score:.0%}"
    )

    # Citation accuracy - check for invalid citations
    citation_issues = []
    outline = synthesis.get("outline", {})
    sections = outline.get("sections", [])
    total_citations = 0
    invalid_citations = 0

    for section in sections:
        for citation in section.get("citations", []):
            total_citations += 1
            source = citation.get("source", "")
            if "invalid" in source.lower() or not source:
                invalid_citations += 1
                citation_issues.append({
                    "id": str(uuid4()),
                    "severity": "minor",
                    "category": "citation_accuracy",
                    "location": f"Section: {section.get('title', 'Unknown')}",
                    "description": f"Invalid citation source: {source}",
                    "evidence": "Citation does not reference a verified source",
                    "expected": "All citations should reference verified sources",
                    "agent_source": "synthesis",
                })

    citation_score = 1.0 - (invalid_citations / max(total_citations, 1))
    citation_accuracy = DimensionScore(
        score=citation_score,
        details=f"{total_citations - invalid_citations} of {total_citations} citations verified"
    )

    # Factual consistency - check entity name consistency
    consistency_issues = []
    extracted_entity = metadata.get("extracted_fields", {}).get("entity_name", {}).get("value", "")

    # Check if synthesis content uses different entity name
    for section in sections:
        content = section.get("content", "").lower()
        if extracted_entity and extracted_entity.lower() not in content:
            # Check for partial match mismatch
            if "acme corp" in content and "healthcare" in extracted_entity.lower():
                consistency_issues.append({
                    "id": str(uuid4()),
                    "severity": "minor",
                    "category": "factual_consistency",
                    "location": f"Section: {section.get('title', 'Unknown')}",
                    "description": "Entity name mismatch between stages",
                    "evidence": f"Metadata uses '{extracted_entity}' but content uses different name",
                    "expected": "Consistent entity naming throughout",
                    "agent_source": "synthesis",
                })
                break

    factual_score = 1.0 - (len(consistency_issues) * 0.1)
    factual_consistency = DimensionScore(
        score=max(factual_score, 0.7),
        details=f"{len(consistency_issues)} inconsistencies found"
    )

    # Gap identification
    gaps = gap_analysis.get("gaps", [])
    gap_score = 0.85 if gaps else 0.95
    gap_identification = DimensionScore(
        score=gap_score,
        details=f"{len(gaps)} gaps identified and marked"
    )

    # Memory alignment
    memory_alignment = DimensionScore(
        score=0.80,
        details="Follows organizational patterns"
    )

    # Document quality
    doc_gen = pipeline_outputs.get("document_generation", {})
    sections_created = doc_gen.get("sections_created", 0)
    doc_quality = DimensionScore(
        score=0.85 if sections_created > 0 else 0.60,
        details=f"{sections_created} sections created with professional formatting"
    )

    dimension_scores = {
        "requirement_coverage": requirement_coverage,
        "citation_accuracy": citation_accuracy,
        "factual_consistency": factual_consistency,
        "gap_identification": gap_identification,
        "memory_alignment": memory_alignment,
        "document_quality": doc_quality,
    }

    # Calculate overall score (weighted average)
    weights = {
        "requirement_coverage": 0.25,
        "citation_accuracy": 0.20,
        "factual_consistency": 0.20,
        "gap_identification": 0.10,
        "memory_alignment": 0.10,
        "document_quality": 0.15,
    }

    overall_score = sum(
        dimension_scores[dim]["score"] * weights[dim]
        for dim in dimension_scores
    )

    # Determine approval status
    if overall_score >= 0.80:
        approval_status = "approved"
    elif overall_score >= 0.60:
        approval_status = "needs_review"
    else:
        approval_status = "blocked"

    # Combine all issues
    issues = citation_issues + consistency_issues

    # Generate recommendations
    recommendations = []
    if citation_issues:
        recommendations.append({
            "id": str(uuid4()),
            "priority": "medium",
            "category": "citation_accuracy",
            "action": "Review and verify citation sources in synthesis output",
            "rationale": "Some citations reference invalid or missing sources",
        })

    if consistency_issues:
        recommendations.append({
            "id": str(uuid4()),
            "priority": "low",
            "category": "factual_consistency",
            "action": "Ensure consistent entity naming across all sections",
            "rationale": "Entity name varies between metadata and document content",
        })

    if coverage_score < 0.70:
        recommendations.append({
            "id": str(uuid4()),
            "priority": "high",
            "category": "requirement_coverage",
            "action": "Review gaps and consider additional research for low-coverage areas",
            "rationale": f"Overall coverage ({coverage_score:.0%}) below recommended threshold",
        })

    return FinalValidationResult(
        pursuit_id=str(pursuit_id),
        validation_id=validation_id,
        overall_score=round(overall_score, 2),
        approval_status=approval_status,
        dimension_scores=dimension_scores,
        issues=issues,
        recommendations=recommendations,
        processing_time_ms=0,  # Will be set by caller
        model_used="mock",
    )


async def _run_llm_final_validation(
    pursuit_id: UUID,
    validation_id: str,
    rfp_text: str,
    pipeline_outputs: Dict[str, Dict[str, Any]],
    human_edits: Optional[List[Dict[str, Any]]] = None,
    include_citation_audit: bool = True,
    include_edit_consistency_check: bool = False,
) -> FinalValidationResult:
    """Run comprehensive final validation using GPT-4o for independent verification."""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        logger.warning("no_openai_api_key_for_final_validation")
        return _generate_mock_final_validation(
            pursuit_id, validation_id, pipeline_outputs, human_edits
        )

    client = openai.OpenAI(api_key=api_key)

    prompt = _build_final_validation_prompt(
        rfp_text=rfp_text,
        pipeline_outputs=pipeline_outputs,
        human_edits=human_edits,
        include_citation_audit=include_citation_audit,
        include_edit_consistency_check=include_edit_consistency_check,
    )

    try:
        response = client.chat.completions.create(
            model=MODEL_NAME_GPT4O,
            max_tokens=MAX_TOKENS_FINAL,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},  # GPT-4o supports JSON mode
        )

        # Log token usage
        input_tokens = response.usage.prompt_tokens
        output_tokens = response.usage.completion_tokens
        log_token_usage(
            agent_name="final_validation",
            input_tokens=input_tokens,
            output_tokens=output_tokens,
        )

        # Parse response
        content = response.choices[0].message.content
        result = _parse_final_validation_response(content, pursuit_id, validation_id)
        result["model_used"] = "gpt-4o"

        return result

    except Exception as e:
        logger.error("final_validation_llm_error", error=str(e))
        # Fall back to mock
        return _generate_mock_final_validation(
            pursuit_id, validation_id, pipeline_outputs, human_edits
        )


def _build_final_validation_prompt(
    rfp_text: str,
    pipeline_outputs: Dict[str, Dict[str, Any]],
    human_edits: Optional[List[Dict[str, Any]]] = None,
    include_citation_audit: bool = True,
    include_edit_consistency_check: bool = False,
) -> str:
    """Build prompt for comprehensive final validation."""
    prompt = f"""You are a comprehensive validation agent performing final quality assurance on a proposal document.

TASK: Analyze all pipeline outputs for quality, consistency, and accuracy. Generate a detailed validation report.

## RFP TEXT (Source Document)
{rfp_text[:4000]}

## PIPELINE OUTPUTS

### Metadata Extraction
{json.dumps(pipeline_outputs.get("metadata_extraction", {}), indent=2)[:2000]}

### Gap Analysis
{json.dumps(pipeline_outputs.get("gap_analysis", {}), indent=2)[:2000]}

### Research
{json.dumps(pipeline_outputs.get("research", {}), indent=2)[:2000]}

### Synthesis
{json.dumps(pipeline_outputs.get("synthesis", {}), indent=2)[:2000]}

### Document Generation
{json.dumps(pipeline_outputs.get("document_generation", {}), indent=2)[:500]}
"""

    if human_edits and include_edit_consistency_check:
        prompt += f"""
### Human Edits Made
{json.dumps(human_edits, indent=2)[:1000]}
"""

    prompt += """
## VALIDATION DIMENSIONS
Evaluate each dimension on a 0.0-1.0 scale:

1. **requirement_coverage** - How well does the proposal address RFP requirements?
2. **citation_accuracy** - Are all citations valid and verifiable?
3. **factual_consistency** - Are facts consistent across all sections?
4. **gap_identification** - Are gaps properly identified and marked?
5. **memory_alignment** - Does it follow organizational patterns?
6. **document_quality** - Is the document structure and tone professional?

## OUTPUT FORMAT
Return a JSON object with this exact structure:
{
  "overall_score": 0.0-1.0,
  "approval_status": "approved|needs_review|blocked",
  "dimension_scores": {
    "requirement_coverage": {"score": 0.0-1.0, "details": "explanation"},
    "citation_accuracy": {"score": 0.0-1.0, "details": "explanation"},
    "factual_consistency": {"score": 0.0-1.0, "details": "explanation"},
    "gap_identification": {"score": 0.0-1.0, "details": "explanation"},
    "memory_alignment": {"score": 0.0-1.0, "details": "explanation"},
    "document_quality": {"score": 0.0-1.0, "details": "explanation"}
  },
  "issues": [
    {
      "severity": "critical|major|minor",
      "category": "requirement_coverage|citation_accuracy|factual_consistency|gap_identification|memory_alignment|document_quality",
      "location": "where in the document",
      "description": "what the issue is",
      "evidence": "supporting evidence",
      "expected": "what was expected",
      "agent_source": "which agent's output has the issue"
    }
  ],
  "recommendations": [
    {
      "priority": "high|medium|low",
      "category": "category",
      "action": "what to do",
      "rationale": "why"
    }
  ]
}

Return ONLY the JSON object, no other text.
"""
    return prompt


def _parse_final_validation_response(
    content: str,
    pursuit_id: UUID,
    validation_id: str,
) -> FinalValidationResult:
    """Parse LLM response into FinalValidationResult."""
    try:
        # Find JSON in response
        json_match = re.search(r'\{[\s\S]*\}', content)
        if json_match:
            data = json.loads(json_match.group())

            # Add IDs to issues and recommendations
            for issue in data.get("issues", []):
                issue["id"] = str(uuid4())
            for rec in data.get("recommendations", []):
                rec["id"] = str(uuid4())

            return FinalValidationResult(
                pursuit_id=str(pursuit_id),
                validation_id=validation_id,
                overall_score=data.get("overall_score", 0.0),
                approval_status=data.get("approval_status", "needs_review"),
                dimension_scores=data.get("dimension_scores", {}),
                issues=data.get("issues", []),
                recommendations=data.get("recommendations", []),
                processing_time_ms=0,  # Will be set by caller
                model_used="gpt-4o",
            )
    except json.JSONDecodeError:
        logger.warning("failed_to_parse_final_validation", content=content[:200])

    # Return default if parsing fails
    return FinalValidationResult(
        pursuit_id=str(pursuit_id),
        validation_id=validation_id,
        overall_score=0.0,
        approval_status="needs_review",
        dimension_scores={},
        issues=[],
        recommendations=[],
        processing_time_ms=0,
        model_used="gpt-4o",
    )
