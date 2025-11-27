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
    assert "Acme Corp" in call_args.kwargs["prompt"]
    assert "Standard Proposal" in call_args.kwargs["prompt"]
    assert "Past analysis for Acme Corp" in call_args.kwargs["prompt"] # Verify RAG context usage

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
