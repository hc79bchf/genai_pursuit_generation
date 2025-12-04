import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.services.ai_service.gap_analysis_agent import GapAnalysisAgent, GapAnalysisResult
from app.services.ai_service.llm_service import LLMService

@pytest.fixture
def mock_llm_service():
    return AsyncMock(spec=LLMService)

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

@pytest.mark.asyncio
async def test_analyze_success(agent, mock_llm_service, mock_memory_service):
    # Setup inputs
    pursuit_metadata = {
        "id": "123",
        "entity_name": "Acme Corp",
        "industry": "Technology",
        "service_types": ["Software Development"],
        "requirements_text": "Need a web app."
    }
    template_details = {
        "title": "Standard Proposal",
        "description": "A standard proposal template",
        "details": ["Executive Summary", "Technical Approach", "Pricing"]
    }
    user_id = "user123"

    # Setup mocks
    expected_result = GapAnalysisResult(
        gaps=["Pricing Model", "Team Structure"],
        search_queries=["Acme Corp pricing model", "Acme Corp team structure"],
        reasoning="Missing pricing and team info."
    )
    mock_llm_service.generate_json.return_value = expected_result
    
    # Mock memory retrieval to return some context
    mock_memory_service.search_long_term.return_value = [
        {"memory": "Past analysis for Acme Corp showed need for security compliance."}
    ]

    # Execute
    result = await agent.analyze(pursuit_metadata, template_details, user_id)

    # Verify
    assert result["gaps"] == ["Pricing Model", "Team Structure"]
    assert result["search_queries"] == ["Acme Corp pricing model", "Acme Corp team structure"]
    
    # Verify LLM call
    mock_llm_service.generate_json.assert_called_once()
    call_args = mock_llm_service.generate_json.call_args
    # Entity names should be sanitized to [CLIENT] in the prompt
    assert "[CLIENT]" in call_args.kwargs["prompt"]
    assert "Acme Corp" not in call_args.kwargs["prompt"]  # Entity name sanitized
    assert "Standard Proposal" in call_args.kwargs["prompt"]
    assert "Past analysis for [CLIENT]" in call_args.kwargs["prompt"]  # Verify RAG context is sanitized

    # Verify Memory storage
    mock_memory_service.add_long_term.assert_called_once()
    
@pytest.mark.asyncio
async def test_analyze_no_memory(agent, mock_llm_service, mock_memory_service):
    # Setup inputs
    pursuit_metadata = {"entity_name": "Startup Inc"}
    template_details = {"title": "Simple Template"}
    user_id = "user456"

    # Setup mocks
    expected_result = GapAnalysisResult(
        gaps=["Gap 1"],
        search_queries=["Query 1"],
        reasoning="Reasoning 1"
    )
    mock_llm_service.generate_json.return_value = expected_result
    mock_memory_service.search_long_term.return_value = [] # No memory found

    # Execute
    result = await agent.analyze(pursuit_metadata, template_details, user_id)

    # Verify
    assert result["gaps"] == ["Gap 1"]
    
    # Verify LLM call prompt doesn't have memory context section populated with items
    call_args = mock_llm_service.generate_json.call_args
    assert "Relevant past analyses/knowledge" not in call_args.kwargs["prompt"] or "Relevant past analyses/knowledge:\n\n" in call_args.kwargs["prompt"]

@pytest.mark.asyncio
async def test_analyze_llm_failure(agent, mock_llm_service):
    # Setup inputs
    pursuit_metadata = {}
    template_details = {}
    user_id = "user789"

    # Setup mock to raise exception
    mock_llm_service.generate_json.side_effect = Exception("LLM Error")

    # Execute and expect exception
    with pytest.raises(Exception, match="LLM Error"):
        await agent.analyze(pursuit_metadata, template_details, user_id)


# ============================================================================
# DEEP RESEARCH PROMPT ENHANCEMENT TESTS
# ============================================================================

@pytest.mark.asyncio
async def test_analyze_returns_deep_research_prompt(agent, mock_llm_service, mock_memory_service):
    """Test that gap analysis returns a deep_research_prompt field"""
    pursuit_metadata = {
        "id": "123",
        "entity_name": "Acme Corp",
        "industry": "Healthcare IT",
        "service_types": ["System Integration", "Data Migration"],
        "technologies": ["AWS", "Python", "PostgreSQL"],
        "requirements_text": "Need HIPAA-compliant data migration solution."
    }
    template_details = {
        "title": "Healthcare IT Proposal",
        "description": "HIPAA-compliant proposal template",
        "details": ["Executive Summary", "Technical Approach", "Security & Compliance", "Implementation Plan"]
    }
    user_id = "user123"

    # Setup mock with deep_research_prompt
    from app.services.ai_service.gap_analysis_agent import GapAnalysisResult
    expected_result = GapAnalysisResult(
        gaps=["Security certification details", "Data retention policies"],
        search_queries=["healthcare data migration best practices", "HIPAA compliance requirements"],
        reasoning="Missing security and compliance details.",
        deep_research_prompt="Research best practices for healthcare IT data migration projects..."
    )
    mock_llm_service.generate_json.return_value = expected_result

    result = await agent.analyze(pursuit_metadata, template_details, user_id)

    # Verify deep_research_prompt is present
    assert "deep_research_prompt" in result
    assert isinstance(result["deep_research_prompt"], str)
    assert len(result["deep_research_prompt"]) > 50  # Should be a substantial prompt


@pytest.mark.asyncio
async def test_deep_research_prompt_excludes_entity_names(agent, mock_llm_service, mock_memory_service):
    """Test that deep_research_prompt does not contain entity names (PII protection)"""
    pursuit_metadata = {
        "id": "456",
        "entity_name": "SecretCorp International",
        "industry": "Financial Services",
        "service_types": ["Consulting"],
        "requirements_text": "SecretCorp needs a banking solution."
    }
    template_details = {
        "title": "Financial Services Proposal",
        "description": "Banking and fintech template",
        "details": ["Executive Summary", "Solution Overview"]
    }
    user_id = "user456"

    # Setup mock - the prompt should NOT contain "SecretCorp"
    from app.services.ai_service.gap_analysis_agent import GapAnalysisResult
    expected_result = GapAnalysisResult(
        gaps=["Regulatory compliance details"],
        search_queries=["banking compliance best practices"],
        reasoning="Missing compliance info.",
        deep_research_prompt="Research industry best practices for financial services consulting engagements, focusing on regulatory compliance frameworks, banking technology standards, and risk management methodologies."
    )
    mock_llm_service.generate_json.return_value = expected_result

    result = await agent.analyze(pursuit_metadata, template_details, user_id)

    # Verify entity name is NOT in the deep research prompt
    assert "SecretCorp" not in result["deep_research_prompt"]
    assert "SecretCorp International" not in result["deep_research_prompt"]


@pytest.mark.asyncio
async def test_deep_research_prompt_includes_industry_context(agent, mock_llm_service, mock_memory_service):
    """Test that deep_research_prompt includes industry context and best practices focus"""
    pursuit_metadata = {
        "id": "789",
        "entity_name": "TechStartup Inc",
        "industry": "SaaS",
        "service_types": ["Platform Development", "API Integration"],
        "technologies": ["Kubernetes", "React", "GraphQL"],
        "requirements_text": "Build a multi-tenant SaaS platform with enterprise features."
    }
    template_details = {
        "title": "Enterprise SaaS Proposal",
        "description": "Multi-tenant platform proposal",
        "details": ["Architecture Overview", "Scalability Plan", "Security Model", "Pricing Model"]
    }
    user_id = "user789"

    from app.services.ai_service.gap_analysis_agent import GapAnalysisResult
    expected_result = GapAnalysisResult(
        gaps=["Multi-tenant architecture patterns", "Enterprise pricing strategies"],
        search_queries=["SaaS multi-tenant architecture", "enterprise SaaS pricing models"],
        reasoning="Missing architecture and pricing details.",
        deep_research_prompt="""You are a senior technology consultant researching best practices for a SaaS platform development engagement.

**Industry Context:**
- Domain: Software as a Service (SaaS)
- Service Focus: Platform Development, API Integration
- Technology Stack: Kubernetes, React, GraphQL

**Existing Information:**
- Requirements include multi-tenant platform with enterprise features
- Proposal sections cover: Architecture Overview, Scalability Plan, Security Model, Pricing Model

**Knowledge Gaps to Research:**
1. Multi-tenant architecture patterns
2. Enterprise pricing strategies

**Research Objectives:**
Please provide comprehensive research on:
1. Industry best practices for multi-tenant SaaS architecture design patterns
2. Enterprise SaaS pricing strategies and models used by leading platforms
3. Scalability considerations for high-growth SaaS platforms
4. Security frameworks commonly adopted in enterprise SaaS environments

Focus on actionable insights, proven methodologies, and industry benchmarks. Cite authoritative sources where possible."""
    )
    mock_llm_service.generate_json.return_value = expected_result

    result = await agent.analyze(pursuit_metadata, template_details, user_id)

    # Verify the prompt includes industry context elements
    prompt = result["deep_research_prompt"]
    assert "SaaS" in prompt or "saas" in prompt.lower()
    # Should NOT contain entity name
    assert "TechStartup" not in prompt


@pytest.mark.asyncio
async def test_deep_research_prompt_structure(agent, mock_llm_service, mock_memory_service):
    """Test that deep_research_prompt has proper structure for downstream use"""
    pursuit_metadata = {
        "id": "test-001",
        "entity_name": "ClientCo",
        "industry": "Manufacturing",
        "service_types": ["IoT Solutions"],
        "technologies": ["Azure IoT", "Python"],
        "requirements_text": "Smart factory monitoring system"
    }
    template_details = {
        "title": "IoT Manufacturing Solution",
        "description": "Smart factory proposal",
        "details": ["Solution Overview", "Technical Architecture", "Implementation Timeline"]
    }
    user_id = "user-test"

    from app.services.ai_service.gap_analysis_agent import GapAnalysisResult
    expected_result = GapAnalysisResult(
        gaps=["Real-time monitoring best practices", "Predictive maintenance algorithms"],
        search_queries=["IoT manufacturing monitoring", "predictive maintenance ML"],
        reasoning="Missing IoT implementation details.",
        deep_research_prompt="""You are a senior consultant researching best practices for an IoT manufacturing engagement.

**Industry Context:**
- Domain: Manufacturing
- Service Focus: IoT Solutions
- Technology Stack: Azure IoT, Python

**Existing Information:**
- Smart factory monitoring system requirements
- Proposal sections: Solution Overview, Technical Architecture, Implementation Timeline

**Knowledge Gaps to Research:**
1. Real-time monitoring best practices
2. Predictive maintenance algorithms

**Research Objectives:**
Provide comprehensive research covering industry best practices, proven methodologies, implementation patterns, and technology recommendations for the identified gaps."""
    )
    mock_llm_service.generate_json.return_value = expected_result

    result = await agent.analyze(pursuit_metadata, template_details, user_id)

    prompt = result["deep_research_prompt"]

    # Verify structural elements are present (flexible matching)
    assert "Industry Context" in prompt or "industry" in prompt.lower()
    assert "Research" in prompt or "research" in prompt.lower()
    # Entity name should be absent
    assert "ClientCo" not in prompt


@pytest.mark.asyncio
async def test_analyze_with_reference_pursuits(agent, mock_llm_service, mock_memory_service):
    """Test gap analysis incorporates reference pursuits data"""
    pursuit_metadata = {
        "id": "ref-test-001",
        "entity_name": "NewClient LLC",
        "industry": "Retail",
        "service_types": ["E-commerce"],
        "requirements_text": "Online retail platform"
    }
    template_details = {
        "title": "E-commerce Platform Proposal",
        "description": "Retail platform template",
        "details": ["Platform Overview", "Payment Integration", "Inventory Management"]
    }
    reference_pursuits = [
        {
            "pursuit_id": "past-001",
            "pursuit_name": "Previous Retail Project",
            "industry": "Retail",
            "win_status": "Won",
            "components": ["Payment Integration", "User Management"]
        }
    ]
    user_id = "user-ref-test"

    from app.services.ai_service.gap_analysis_agent import GapAnalysisResult
    expected_result = GapAnalysisResult(
        gaps=["Inventory management workflows", "Order fulfillment processes"],
        search_queries=["e-commerce inventory management", "retail order fulfillment"],
        reasoning="Reference pursuits cover payment but not inventory.",
        deep_research_prompt="Research best practices for e-commerce inventory management and order fulfillment..."
    )
    mock_llm_service.generate_json.return_value = expected_result

    # Call with reference_pursuits parameter
    result = await agent.analyze(
        pursuit_metadata,
        template_details,
        user_id,
        reference_pursuits=reference_pursuits
    )

    assert "gaps" in result
    assert "deep_research_prompt" in result
    # Verify LLM prompt included reference pursuit context
    call_args = mock_llm_service.generate_json.call_args
    assert "reference" in call_args.kwargs["prompt"].lower() or "past" in call_args.kwargs["prompt"].lower()
