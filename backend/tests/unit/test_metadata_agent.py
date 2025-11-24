import pytest
from unittest.mock import AsyncMock, MagicMock, patch
import json

# Assuming the agent will be implemented here
# from app.services.ai_service.metadata_agent import MetadataExtractionAgent
# from app.schemas.pursuit import PursuitMetadata

from app.services.ai_service.metadata_agent import MetadataExtractionAgent

@pytest.fixture
def mock_llm_service():
    service = AsyncMock()
    return service

@pytest.fixture
def metadata_agent(mock_llm_service):
    return MetadataExtractionAgent(llm_service=mock_llm_service)

@pytest.mark.asyncio
async def test_extract_metadata_success(metadata_agent, mock_llm_service):
    """
    Test that the agent correctly extracts all available metadata from a clear RFP text.
    """
    # Sample RFP text
    rfp_text = """
    REQUEST FOR PROPOSAL
    ...
    """
    
    # Expected JSON response from the LLM (mocked)
    expected_llm_response = {
        "entity_name": "Acme Healthcare Corp",
        "client_pursuit_owner_name": "Sarah Johnson",
        "client_pursuit_owner_email": "sarah.johnson@acme.com",
        "industry": "Healthcare",
        "service_types": ["Data", "Engineering"],
        "technologies": ["Azure", "Azure Synapse", "Power BI"],
        "submission_due_date": "2025-12-15",
        "expected_format": "pptx",
        "rfp_objective": "Modernize data infrastructure",
        "requirements": ["Migrate to Azure", "Implement Power BI dashboards"],
        "sources": ["Page 1, Executive Summary", "Page 5, Technical Requirements"]
    }
    
    # Configure the LLM service to return this data
    mock_llm_service.generate_json.return_value = expected_llm_response
    
    # Act
    result = await metadata_agent.extract(rfp_text)
    
    # Assert
    assert result["entity_name"] == "Acme Healthcare Corp"
    assert result["client_pursuit_owner_email"] == "sarah.johnson@acme.com"
    assert "Azure" in result["technologies"]
    assert result["expected_format"] == "pptx"
    assert result["industry"] == "Healthcare"
    assert result["rfp_objective"] == "Modernize data infrastructure"
    assert "Migrate to Azure" in result["requirements"]
    assert len(result["sources"]) == 2
    
    # Verify LLM was called
    mock_llm_service.generate_json.assert_called_once()

@pytest.mark.asyncio
async def test_extract_metadata_partial(metadata_agent, mock_llm_service):
    """
    Test extraction when some fields are missing from the text.
    """
    rfp_text = """
    RFP for Software Development
    
    We need a React application built.
    Please reply by next Friday.
    """
    
    expected_response = {
        "entity_name": None, # Missing
        "technologies": ["React"],
        "service_types": ["Engineering"],
        "expected_format": "docx" # Default or inferred
    }
    
    mock_llm_service.generate_json.return_value = expected_response
    
    result = await metadata_agent.extract(rfp_text)
    
    assert result["entity_name"] is None
    assert "React" in result["technologies"]
