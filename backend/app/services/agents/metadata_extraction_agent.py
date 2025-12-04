"""
Metadata Extraction Agent

Extracts structured metadata from RFP documents using Claude AI.
Leverages three memory types for continuous improvement:
- Short-term (Redis): Current RFP text, session corrections
- Long-term (PostgreSQL): Naming conventions, client patterns
- Episodic (ChromaDB): Past extractions, accuracy scores, corrections history
"""

import os
import re
import time
import json
from datetime import datetime
from typing import TypedDict, Any, Optional

import anthropic
import structlog

from app.core.exceptions import ValidationError, ExtractionError
from app.services.memory.short_term import ShortTermMemoryService
from app.services.memory.long_term import LongTermMemoryService
from app.services.memory.episodic import EpisodicMemoryService
from app.services.agents.token_tracking import calculate_cost, log_token_usage

logger = structlog.get_logger(__name__)


# Constants
MODEL_NAME = "claude-sonnet-4-5-20250929"
MAX_TOKENS = 4096
REQUIRED_FIELDS = ["entity_name", "industry"]
MIN_CONFIDENCE_THRESHOLD = 0.5


class FieldResult(TypedDict):
    """Result for a single extracted field."""
    value: Any
    confidence: float
    source: str


class ValidationResults(TypedDict):
    """Validation results for extracted metadata."""
    status: str  # "valid", "warning", or "error"
    errors: list[dict[str, str]]
    warnings: list[str]
    fields_requiring_review: list[str]


class MetadataExtractionResult(TypedDict):
    """Complete result from metadata extraction."""
    extracted_fields: dict[str, FieldResult]
    validation_results: ValidationResults
    processing_time_ms: int
    memory_enhanced: bool  # Whether memories were used to improve extraction
    input_tokens: int
    output_tokens: int
    estimated_cost_usd: float


class MemoryContext(TypedDict):
    """Context gathered from memories to enhance extraction."""
    naming_conventions: dict[str, str]
    client_patterns: list[dict]
    similar_extractions: list[dict]
    session_corrections: list[dict]


EXTRACTION_PROMPT = """You are a metadata extraction agent. Extract structured metadata from the following RFP (Request for Proposal) document.

Extract the following fields:
1. entity_name - The company/organization issuing the RFP
2. client_pursuit_owner_name - Contact person name
3. client_pursuit_owner_email - Contact email address
4. industry - Industry sector (e.g., Healthcare, Finance, Technology)
5. service_types - Array of service types requested (e.g., Data, Engineering, Risk, Advisory)
6. technologies - Array of technologies mentioned
7. geography - Geographic scope/region
8. submission_due_date - Deadline in ISO format (YYYY-MM-DD)
9. estimated_fees - Numeric value (midpoint if range given)
10. proposal_objectives - Array of key objectives/goals the client wants to achieve, each with a citation showing where it was found in the document
11. requirements - Array of specific requirements, deliverables, or capabilities requested, each with a citation showing where it was found in the document
12. output_format - The required proposal document format. Must be either "pptx" (PowerPoint) or "docx" (Word). Look for explicit format requirements in the RFP (e.g., "submit as PowerPoint", "Word document required", "presentation format"). If not specified, default to "pptx" for executive/board presentations or when slides are mentioned, otherwise default to "docx"

For each standard field, provide:
- value: The extracted value
- confidence: A score between 0.0 and 1.0 indicating how confident you are
- source: Brief description of where in the text you found this (e.g., "explicitly stated", "inferred from context")

For proposal_objectives and requirements, provide an array of items where each item has:
- text: The objective or requirement text
- citation: The specific quote or section reference from the RFP document (e.g., "Section 3.2: 'The vendor must provide 24/7 support'")
- confidence: A score between 0.0 and 1.0

Confidence scoring guidelines:
- 0.95-1.0: Explicitly labeled (e.g., "Company Name: X")
- 0.85-0.94: Clearly stated but not labeled
- 0.70-0.84: Strongly implied or partial match
- 0.50-0.69: Inferred from context
- Below 0.50: Very uncertain, educated guess

Return your response as a JSON object with this structure:
{{
  "extracted_fields": {{
    "field_name": {{
      "value": "extracted value",
      "confidence": 0.95,
      "source": "explicitly stated in header"
    }},
    "proposal_objectives": {{
      "value": [
        {{"text": "Reduce operational costs by 20%", "citation": "Section 1.2: 'Our goal is to reduce operational costs by at least 20%'", "confidence": 0.95}},
        {{"text": "Improve customer satisfaction", "citation": "Executive Summary: 'enhance customer experience and satisfaction scores'", "confidence": 0.85}}
      ],
      "confidence": 0.90,
      "source": "multiple sections"
    }},
    "requirements": {{
      "value": [
        {{"text": "24/7 technical support", "citation": "Section 4.1 Requirements: 'Vendor must provide round-the-clock support'", "confidence": 0.95}},
        {{"text": "SOC 2 Type II compliance", "citation": "Security Requirements: 'Must maintain SOC 2 Type II certification'", "confidence": 0.95}}
      ],
      "confidence": 0.92,
      "source": "requirements section"
    }}
  }}
}}

If a field cannot be found, still include it with null value and confidence 0.0.

{memory_context}

RFP Document:
"""


def _build_memory_context_prompt(memory_context: Optional[MemoryContext]) -> str:
    """Build additional prompt context from memories."""
    if not memory_context:
        return ""

    sections = []

    # Add naming conventions
    if memory_context.get("naming_conventions"):
        conventions = memory_context["naming_conventions"]
        conv_text = "\n".join([f"- {field}: prefer '{conv}'" for field, conv in conventions.items()])
        sections.append(f"""
ORGANIZATION NAMING CONVENTIONS:
Use these field naming preferences learned from past corrections:
{conv_text}
""")

    # Add relevant client patterns
    if memory_context.get("client_patterns"):
        patterns = memory_context["client_patterns"][:3]  # Top 3 patterns
        pattern_text = "\n".join([
            f"- {p.get('industry', 'Unknown')} industry: {p.get('pattern_type', '')}: {json.dumps(p.get('pattern', {}))}"
            for p in patterns
        ])
        sections.append(f"""
COMMON CLIENT PATTERNS:
These patterns have been observed in similar extractions:
{pattern_text}
""")

    # Add similar past extractions for learning
    if memory_context.get("similar_extractions"):
        examples = memory_context["similar_extractions"][:2]  # Top 2 similar
        example_text = "\n".join([
            f"- Similar RFP extracted: {json.dumps(ex.get('value', {}).get('extracted_fields', {}), indent=2)[:500]}"
            for ex in examples
        ])
        sections.append(f"""
SIMILAR PAST EXTRACTIONS:
Learn from these similar RFPs that were previously extracted:
{example_text}
""")

    # Add session corrections to avoid repeating mistakes
    if memory_context.get("session_corrections"):
        corrections = memory_context["session_corrections"]
        corr_text = "\n".join([
            f"- Field '{c.get('field')}': user corrected '{c.get('original')}' to '{c.get('corrected')}'"
            for c in corrections
        ])
        sections.append(f"""
SESSION CORRECTIONS:
The user has made these corrections in this session - apply these learnings:
{corr_text}
""")

    return "\n".join(sections)


async def metadata_extraction_agent(
    rfp_text: str,
    pursuit_id: Optional[str] = None,
    session_id: Optional[str] = None,
    redis_url: Optional[str] = None,
    database_url: Optional[str] = None,
    chroma_persist_dir: Optional[str] = None
) -> MetadataExtractionResult:
    """
    Extract metadata from RFP text using AI with memory-enhanced learning.

    Args:
        rfp_text: The raw RFP text to extract metadata from.
        pursuit_id: Optional pursuit ID for tracking and memory storage.
        session_id: Optional session ID for short-term memory.
        redis_url: Redis URL for short-term memory.
        database_url: PostgreSQL URL for long-term memory.
        chroma_persist_dir: ChromaDB directory for episodic memory.

    Returns:
        MetadataExtractionResult with extracted fields, validation, and timing.

    Raises:
        ValidationError: If input is empty or invalid.
        ExtractionError: If AI extraction fails.
    """
    start_time = time.time()

    # Validate input
    if not rfp_text or not rfp_text.strip():
        raise ValidationError("Input text is empty")

    # Initialize memory services if URLs provided
    short_term = None
    long_term = None
    episodic = None
    memory_context: Optional[MemoryContext] = None
    memory_enhanced = False

    try:
        # Set up memory services
        if redis_url:
            short_term = ShortTermMemoryService(redis_url)
        if database_url:
            long_term = LongTermMemoryService(database_url)
        if chroma_persist_dir:
            episodic = EpisodicMemoryService(chroma_persist_dir)

        # Gather memory context for enhanced extraction
        memory_context = await _gather_memory_context(
            rfp_text=rfp_text,
            session_id=session_id,
            short_term=short_term,
            long_term=long_term,
            episodic=episodic
        )

        if memory_context and any(memory_context.values()):
            memory_enhanced = True

        # Store RFP text in short-term memory for session
        if short_term and pursuit_id:
            await short_term.store_rfp_text(pursuit_id, rfp_text)

        # Build prompt with memory context
        memory_prompt = _build_memory_context_prompt(memory_context)
        full_prompt = EXTRACTION_PROMPT.format(memory_context=memory_prompt) + rfp_text

        # Call AI for extraction
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
                        "content": full_prompt
                    }
                ]
            )
        except anthropic.APIError as e:
            raise ExtractionError(f"AI extraction failed: {e}")

        # Parse response
        response_text = message.content[0].text
        extracted_fields = _parse_extraction_response(response_text)

        # Extract token usage
        input_tokens = message.usage.input_tokens
        output_tokens = message.usage.output_tokens
        estimated_cost = calculate_cost(input_tokens, output_tokens)

        # Log token usage
        log_token_usage(
            agent_name="metadata_extraction",
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            pursuit_id=pursuit_id
        )

        # Validate results
        validation_results = _validate_extraction(extracted_fields, rfp_text)

        # Calculate processing time
        processing_time_ms = int((time.time() - start_time) * 1000)

        # Store extraction in episodic memory for future learning
        if episodic and pursuit_id:
            await episodic.store_extraction_episode(
                pursuit_id=pursuit_id,
                rfp_text=rfp_text,
                extracted_fields=extracted_fields,
                accuracy_score=None,  # Will be updated after user review
                user_corrections=None
            )

        return MetadataExtractionResult(
            extracted_fields=extracted_fields,
            validation_results=validation_results,
            processing_time_ms=processing_time_ms,
            memory_enhanced=memory_enhanced,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            estimated_cost_usd=estimated_cost
        )

    finally:
        # Clean up memory service connections
        if short_term:
            await short_term.close()
        if long_term:
            await long_term.close()
        if episodic:
            await episodic.close()


async def _gather_memory_context(
    rfp_text: str,
    session_id: Optional[str],
    short_term: Optional[ShortTermMemoryService],
    long_term: Optional[LongTermMemoryService],
    episodic: Optional[EpisodicMemoryService]
) -> MemoryContext:
    """Gather relevant memories to enhance extraction."""
    context: MemoryContext = {
        "naming_conventions": {},
        "client_patterns": [],
        "similar_extractions": [],
        "session_corrections": []
    }

    try:
        # Get session corrections from short-term memory
        if short_term and session_id:
            context["session_corrections"] = await short_term.get_session_corrections(session_id)

        # Get naming conventions and client patterns from long-term memory
        if long_term:
            context["naming_conventions"] = await long_term.get_naming_conventions()
            context["client_patterns"] = await long_term.get_client_patterns()

        # Get similar past extractions from episodic memory
        if episodic:
            context["similar_extractions"] = await episodic.get_similar_extractions(
                rfp_text=rfp_text,
                n_results=3
            )

    except Exception as e:
        # Log but don't fail extraction if memory retrieval fails
        import logging
        logging.warning(f"Failed to gather memory context: {e}")

    return context


async def update_extraction_with_corrections(
    pursuit_id: str,
    session_id: str,
    field_name: str,
    original_value: Any,
    corrected_value: Any,
    redis_url: Optional[str] = None,
    database_url: Optional[str] = None,
    chroma_persist_dir: Optional[str] = None
) -> None:
    """
    Update memories when user corrects an extracted field.

    This enables continuous learning by:
    1. Storing correction in session (short-term)
    2. Updating naming conventions if pattern detected (long-term)
    3. Updating episodic memory with correction (episodic)
    """
    short_term = None
    long_term = None
    episodic = None

    try:
        # Initialize services
        if redis_url:
            short_term = ShortTermMemoryService(redis_url)
        if database_url:
            long_term = LongTermMemoryService(database_url)
        if chroma_persist_dir:
            episodic = EpisodicMemoryService(chroma_persist_dir)

        # Store in session corrections (short-term)
        if short_term:
            await short_term.store_session_correction(
                session_id=session_id,
                field_name=field_name,
                original_value=original_value,
                corrected_value=corrected_value
            )

        # Update naming conventions if this is a naming pattern (long-term)
        if long_term and field_name in ["entity_name", "industry", "geography"]:
            # Learn from repeated corrections
            conventions = await long_term.get_naming_conventions()
            if field_name not in conventions or conventions[field_name] != corrected_value:
                await long_term.update_naming_conventions(field_name, str(corrected_value))

        # Update episodic memory with correction
        if episodic:
            # Find the extraction episode and add correction
            similar = await episodic.get_similar_extractions(
                rfp_text=f"pursuit:{pursuit_id}",
                n_results=1
            )
            if similar:
                episode = similar[0]
                corrections = episode["value"].get("user_corrections", [])
                corrections.append({
                    "field": field_name,
                    "original": original_value,
                    "corrected": corrected_value,
                    "timestamp": datetime.utcnow().isoformat()
                })
                await episodic.update(
                    episode["key"],
                    {**episode["value"], "user_corrections": corrections},
                    {"had_corrections": True}
                )

    finally:
        if short_term:
            await short_term.close()
        if long_term:
            await long_term.close()
        if episodic:
            await episodic.close()


async def update_extraction_accuracy(
    pursuit_id: str,
    accuracy_score: float,
    chroma_persist_dir: Optional[str] = None
) -> None:
    """
    Update the accuracy score for an extraction after user review.

    This enables learning from high-accuracy extractions.
    """
    if not chroma_persist_dir:
        return

    episodic = EpisodicMemoryService(chroma_persist_dir)

    try:
        similar = await episodic.get_similar_extractions(
            rfp_text=f"pursuit:{pursuit_id}",
            n_results=1
        )
        if similar:
            episode = similar[0]
            await episodic.update(
                episode["key"],
                {**episode["value"], "accuracy_score": accuracy_score},
                {"accuracy_score": accuracy_score}
            )
    finally:
        await episodic.close()


def _parse_extraction_response(response_text: str) -> dict[str, FieldResult]:
    """
    Parse JSON extraction data from AI response.

    Args:
        response_text: Raw response text from AI.

    Returns:
        Dictionary of extracted fields.

    Raises:
        ValidationError: If response cannot be parsed.
    """
    # Try to extract JSON from markdown code blocks
    json_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', response_text)
    if json_match:
        json_str = json_match.group(1)
    else:
        json_str = response_text

    def try_parse_json(text: str) -> dict | None:
        """Attempt to parse JSON with various cleanup strategies."""
        # Strategy 1: Direct parse
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # Strategy 2: Fix common issues - trailing commas, unescaped quotes
        cleaned = text.strip()
        # Remove trailing commas before closing braces/brackets
        cleaned = re.sub(r',(\s*[}\]])', r'\1', cleaned)
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            pass

        # Strategy 3: Find the outermost balanced braces
        brace_count = 0
        start_idx = None
        end_idx = None
        for i, char in enumerate(text):
            if char == '{':
                if start_idx is None:
                    start_idx = i
                brace_count += 1
            elif char == '}':
                brace_count -= 1
                if brace_count == 0 and start_idx is not None:
                    end_idx = i + 1
                    break

        if start_idx is not None and end_idx is not None:
            json_substr = text[start_idx:end_idx]
            # Clean trailing commas
            json_substr = re.sub(r',(\s*[}\]])', r'\1', json_substr)
            try:
                return json.loads(json_substr)
            except json.JSONDecodeError:
                pass

        return None

    extraction_data = try_parse_json(json_str)

    if extraction_data is None:
        # Try to find JSON object in response
        json_match = re.search(r'\{[\s\S]*\}', response_text)
        if json_match:
            extraction_data = try_parse_json(json_match.group(0))

    if extraction_data is None:
        raise ValidationError("Failed to parse extraction response")

    return extraction_data.get("extracted_fields", {})


def _validate_extraction(
    extracted_fields: dict[str, FieldResult],
    rfp_text: str
) -> ValidationResults:
    """
    Validate extracted metadata and generate warnings/errors.

    Args:
        extracted_fields: Dictionary of extracted field results.
        rfp_text: Original RFP text for context validation.

    Returns:
        ValidationResults with status, errors, warnings, and fields requiring review.
    """
    errors: list[dict[str, str]] = []
    warnings: list[str] = []
    fields_requiring_review: list[str] = []

    # Validate required fields
    for field in REQUIRED_FIELDS:
        if field not in extracted_fields:
            errors.append({
                "field": field,
                "message": f"Required field '{field}' is missing"
            })
        elif extracted_fields[field].get("value") is None:
            errors.append({
                "field": field,
                "message": f"Required field '{field}' has no value"
            })
        elif extracted_fields[field].get("confidence", 0) < MIN_CONFIDENCE_THRESHOLD:
            errors.append({
                "field": field,
                "message": f"Required field '{field}' has low confidence"
            })

    # Validate email format
    _validate_email_field(extracted_fields, rfp_text, fields_requiring_review)

    # Validate submission date
    _validate_date_field(extracted_fields, warnings, fields_requiring_review)

    # Check for multiple entities
    _check_multiple_entities(rfp_text, fields_requiring_review)

    # Determine overall status
    if errors:
        status = "error"
    elif warnings or fields_requiring_review:
        status = "warning"
    else:
        status = "valid"

    return ValidationResults(
        status=status,
        errors=errors,
        warnings=warnings,
        fields_requiring_review=fields_requiring_review
    )


def _validate_email_field(
    extracted_fields: dict[str, FieldResult],
    rfp_text: str,
    fields_requiring_review: list[str]
) -> None:
    """Validate email field format and flag suspicious patterns."""
    email_field = extracted_fields.get("client_pursuit_owner_email", {})
    email_value = email_field.get("value")

    if not email_value:
        return

    if not _is_valid_email(email_value):
        fields_requiring_review.append("client_pursuit_owner_email")
    elif "[at]" in rfp_text or "(at)" in rfp_text:
        # Flag if original text had malformed email patterns
        fields_requiring_review.append("client_pursuit_owner_email")


def _validate_date_field(
    extracted_fields: dict[str, FieldResult],
    warnings: list[str],
    fields_requiring_review: list[str]
) -> None:
    """Validate submission date is in the future."""
    date_field = extracted_fields.get("submission_due_date", {})
    date_value = date_field.get("value")

    if not date_value:
        return

    try:
        parsed_date = datetime.fromisoformat(date_value)
        if parsed_date.date() < datetime.now().date():
            warnings.append("Submission date is in the past")
    except (ValueError, TypeError):
        fields_requiring_review.append("submission_due_date")


def _check_multiple_entities(
    rfp_text: str,
    fields_requiring_review: list[str]
) -> None:
    """Check if multiple company entities are mentioned in the RFP."""
    company_names = re.findall(
        r'\b([A-Z][A-Za-z]*(?:\s+[A-Z][A-Za-z]*)*)\s+(?:Corp|Inc|Ltd|LLC|Company|Corporation)\b',
        rfp_text
    )
    if len(set(company_names)) > 1:
        fields_requiring_review.append("entity_name")


def _is_valid_email(email: str) -> bool:
    """Check if email has valid format."""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))
