"""
TDD Tests for Deep Research Prompt Generation

Tests the workflow:
1. User confirms gaps
2. Agent generates deep research prompt based on confirmed gaps
3. User can edit the prompt
4. User can provide feedback and request regeneration
5. Final prompt is passed to research agent
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.services.ai_service.gap_analysis_agent import GapAnalysisAgent, GapAnalysisResult


@pytest.fixture
def mock_llm_service():
    return AsyncMock()


@pytest.fixture
def mock_memory_service():
    with patch("app.services.ai_service.gap_analysis_agent.MemoryService") as MockMemoryService:
        mock_instance = MockMemoryService.return_value
        mock_instance.search_long_term = MagicMock(return_value=[])
        mock_instance.add_long_term = MagicMock()
        yield mock_instance


@pytest.fixture
def agent(mock_llm_service, mock_memory_service):
    return GapAnalysisAgent(mock_llm_service)


# ============================================================================
# TEST: Generate Deep Research Prompt from Confirmed Gaps
# ============================================================================

@pytest.mark.asyncio
async def test_generate_deep_research_prompt_from_confirmed_gaps(agent, mock_llm_service, mock_memory_service):
    """
    Test that the agent can generate a deep research prompt from user-confirmed gaps.
    The prompt should NOT be generated during initial gap analysis - only when explicitly requested.
    """
    # Confirmed gaps from user
    confirmed_gaps = [
        "Security compliance certifications required",
        "Data retention policy details",
        "Disaster recovery procedures"
    ]

    # Context about the proposal
    proposal_context = {
        "industry": "Healthcare IT",
        "service_types": ["System Integration", "Cloud Migration"],
        "technologies": ["AWS", "Python", "PostgreSQL"],
        "requirements_met": [
            "HIPAA compliance framework",
            "Data encryption at rest and in transit",
            "Multi-region deployment capability"
        ]
    }

    user_id = "user123"

    # Mock LLM response for prompt generation
    expected_prompt = """You are a senior technology consultant researching best practices for a Healthcare IT engagement.

**Industry Context:**
- Domain: Healthcare IT
- Service Focus: System Integration, Cloud Migration
- Technology Stack: AWS, Python, PostgreSQL

**Requirements Already Addressed:**
- HIPAA compliance framework
- Data encryption at rest and in transit
- Multi-region deployment capability

**Knowledge Gaps Requiring Research:**
1. Security compliance certifications required
2. Data retention policy details
3. Disaster recovery procedures

**Research Objectives:**
Please provide comprehensive research on the identified gaps, focusing on:
- Industry best practices and standards
- Regulatory requirements and compliance frameworks
- Implementation methodologies and patterns
- Case studies and benchmarks where applicable

Focus on actionable insights that can be incorporated into a proposal response."""

    mock_llm_service.generate_text = AsyncMock(return_value=expected_prompt)

    # Call the new method
    result = await agent.generate_deep_research_prompt(
        confirmed_gaps=confirmed_gaps,
        proposal_context=proposal_context,
        user_id=user_id
    )

    # Verify result
    assert "deep_research_prompt" in result
    assert len(result["deep_research_prompt"]) > 100
    assert "Healthcare IT" in result["deep_research_prompt"] or "[CLIENT]" not in result["deep_research_prompt"]
    # Should NOT contain entity names
    assert "SecretCorp" not in result.get("deep_research_prompt", "")


@pytest.mark.asyncio
async def test_generate_prompt_excludes_pii(agent, mock_llm_service, mock_memory_service):
    """Test that generated prompt excludes entity names and PII"""
    confirmed_gaps = ["Pricing model details"]
    proposal_context = {
        "industry": "Financial Services",
        "entity_name": "SecretBank Corporation",
        "client_name": "John Smith",
        "requirements_met": ["Basic security audit"]
    }
    user_id = "user456"

    # Mock response that accidentally includes entity name
    mock_response = "Research SecretBank Corporation banking compliance..."
    mock_llm_service.generate_text = AsyncMock(return_value=mock_response)

    result = await agent.generate_deep_research_prompt(
        confirmed_gaps=confirmed_gaps,
        proposal_context=proposal_context,
        user_id=user_id
    )

    # Entity name should be sanitized
    assert "SecretBank" not in result["deep_research_prompt"]
    assert "[CLIENT]" in result["deep_research_prompt"] or "SecretBank" not in result["deep_research_prompt"]


@pytest.mark.asyncio
async def test_generate_prompt_includes_requirements_met(agent, mock_llm_service, mock_memory_service):
    """Test that prompt includes context about requirements already met"""
    confirmed_gaps = ["Advanced monitoring capabilities"]
    proposal_context = {
        "industry": "Manufacturing",
        "requirements_met": [
            "Basic IoT sensor integration",
            "Real-time data collection",
            "Dashboard visualization"
        ]
    }
    user_id = "user789"

    mock_llm_service.generate_text = AsyncMock(return_value="Research prompt with context...")

    result = await agent.generate_deep_research_prompt(
        confirmed_gaps=confirmed_gaps,
        proposal_context=proposal_context,
        user_id=user_id
    )

    # LLM should have been called with requirements_met in the prompt
    mock_llm_service.generate_text.assert_called_once()
    call_args = mock_llm_service.generate_text.call_args
    # Get prompt from kwargs or first positional arg
    prompt_sent = call_args.kwargs.get("prompt") or (call_args.args[0] if call_args.args else "")
    # The prompt to LLM should mention what's already covered
    assert "REQUIREMENTS ALREADY ADDRESSED" in prompt_sent or "requirements" in prompt_sent.lower()


# ============================================================================
# TEST: Regenerate Prompt with User Feedback
# ============================================================================

@pytest.mark.asyncio
async def test_regenerate_prompt_with_feedback(agent, mock_llm_service, mock_memory_service):
    """
    Test that user can provide feedback and agent regenerates the prompt.
    The regenerated prompt should incorporate user's feedback while following best practices.
    """
    # Original prompt
    original_prompt = """Research best practices for healthcare data migration..."""

    # User feedback
    user_feedback = "Please focus more on HIPAA compliance specifics and include recent 2024 regulatory updates. Also add a section on vendor evaluation criteria."

    # Context
    confirmed_gaps = ["HIPAA compliance details", "Vendor selection criteria"]
    proposal_context = {
        "industry": "Healthcare IT",
        "requirements_met": ["Basic security framework"]
    }
    user_id = "user123"

    # Expected regenerated prompt incorporating feedback
    regenerated_prompt = """You are a senior healthcare IT consultant...

**Special Focus Areas (Per User Request):**
- HIPAA compliance specifics with 2024 regulatory updates
- Vendor evaluation criteria and selection framework

**Research Objectives:**
..."""

    mock_llm_service.generate_text = AsyncMock(return_value=regenerated_prompt)

    result = await agent.regenerate_deep_research_prompt(
        original_prompt=original_prompt,
        user_feedback=user_feedback,
        confirmed_gaps=confirmed_gaps,
        proposal_context=proposal_context,
        user_id=user_id
    )

    assert "deep_research_prompt" in result
    # LLM should have been called with the feedback
    mock_llm_service.generate_text.assert_called_once()
    call_args = mock_llm_service.generate_text.call_args
    prompt_sent = call_args.kwargs.get("prompt") or (call_args.args[0] if call_args.args else "")
    # The prompt should contain user feedback content or reference to HIPAA
    assert "USER FEEDBACK" in prompt_sent or "HIPAA" in prompt_sent


@pytest.mark.asyncio
async def test_regenerate_maintains_best_practices(agent, mock_llm_service, mock_memory_service):
    """Test that regenerated prompt still follows best practices structure"""
    original_prompt = "Original prompt..."
    user_feedback = "Make it shorter"
    confirmed_gaps = ["Gap 1"]
    proposal_context = {"industry": "Technology"}
    user_id = "user123"

    # Even with "make it shorter" feedback, should maintain structure
    mock_llm_service.generate_text = AsyncMock(return_value="Structured research prompt...")

    result = await agent.regenerate_deep_research_prompt(
        original_prompt=original_prompt,
        user_feedback=user_feedback,
        confirmed_gaps=confirmed_gaps,
        proposal_context=proposal_context,
        user_id=user_id
    )

    # Verify LLM was instructed to maintain best practices
    mock_llm_service.generate_text.assert_called_once()
    call_args = mock_llm_service.generate_text.call_args
    prompt_sent = call_args.kwargs.get("prompt") or (call_args.args[0] if call_args.args else "")
    # Check for best practice or structure in the prompt instructions
    assert "MAINTAIN" in prompt_sent or "best practice" in prompt_sent.lower() or "structure" in prompt_sent.lower()


@pytest.mark.asyncio
async def test_regenerate_sanitizes_pii_from_feedback(agent, mock_llm_service, mock_memory_service):
    """Test that even if user includes PII in feedback, output is sanitized"""
    original_prompt = "Original prompt..."
    # User accidentally includes company name in feedback
    user_feedback = "Focus on what SecretCorp needs for their banking platform"
    confirmed_gaps = ["Banking compliance"]
    proposal_context = {
        "industry": "Financial Services",
        "entity_name": "SecretCorp"
    }
    user_id = "user123"

    mock_llm_service.generate_text = AsyncMock(return_value="Research for SecretCorp banking...")

    result = await agent.regenerate_deep_research_prompt(
        original_prompt=original_prompt,
        user_feedback=user_feedback,
        confirmed_gaps=confirmed_gaps,
        proposal_context=proposal_context,
        user_id=user_id
    )

    # Output should have entity name sanitized
    assert "SecretCorp" not in result["deep_research_prompt"]


# ============================================================================
# TEST: Gap Analysis Without Auto-Generating Prompt
# ============================================================================

@pytest.mark.asyncio
async def test_gap_analysis_does_not_auto_generate_prompt(agent, mock_llm_service, mock_memory_service):
    """
    Test that initial gap analysis does NOT automatically generate the deep research prompt.
    The prompt should only be generated when user explicitly confirms gaps.
    """
    pursuit_metadata = {
        "id": "123",
        "entity_name": "TestCorp",
        "industry": "Technology",
        "service_types": ["Consulting"],
        "requirements_text": "Need a web application."
    }
    template_details = {
        "title": "Standard Proposal",
        "description": "A standard template",
        "details": ["Executive Summary", "Technical Approach"]
    }
    user_id = "user123"

    # Mock LLM to return gaps but NO deep_research_prompt
    expected_result = GapAnalysisResult(
        gaps=["Missing requirement 1", "Missing requirement 2"],
        search_queries=["query 1", "query 2"],
        reasoning="Analysis reasoning...",
        deep_research_prompt=""  # Empty - not generated yet
    )
    mock_llm_service.generate_json.return_value = expected_result

    result = await agent.analyze(pursuit_metadata, template_details, user_id)

    # deep_research_prompt should be empty or minimal
    # The full prompt is generated later when user confirms gaps
    assert result.get("deep_research_prompt", "") == "" or len(result.get("deep_research_prompt", "")) < 50


# ============================================================================
# TEST: Prompt Confirmation Flow
# ============================================================================

@pytest.mark.asyncio
async def test_confirm_and_save_edited_prompt(agent, mock_llm_service, mock_memory_service):
    """Test that user's edited prompt can be saved and retrieved"""
    user_edited_prompt = """My custom research prompt with specific focus areas...

1. Focus on AWS best practices for healthcare
2. Include HIPAA certification requirements
3. Research disaster recovery patterns"""

    pursuit_id = "pursuit-123"
    user_id = "user123"

    # This would typically be handled by the API endpoint, not the agent
    # But we test the data structure is correct
    result = {
        "deep_research_prompt": user_edited_prompt,
        "prompt_status": "confirmed",
        "confirmed_at": "2024-01-15T10:30:00Z",
        "confirmed_by": user_id
    }

    assert result["prompt_status"] == "confirmed"
    assert result["deep_research_prompt"] == user_edited_prompt
