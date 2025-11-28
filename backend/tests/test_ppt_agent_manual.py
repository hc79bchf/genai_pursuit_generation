import asyncio
import sys
import os
from unittest.mock import MagicMock, AsyncMock

# Add backend directory to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../backend")))

from app.services.ai_service.ppt_outline_agent import PPTOutlineAgent
from app.schemas.pursuit import PPTOutline, Slide

async def test_ppt_agent():
    print("Testing PPTOutlineAgent...")

    # Mock LLMService
    mock_llm_service = MagicMock()
    
    # Expected output
    expected_outline = {
        "title": "Proposal for Acme Corp",
        "theme": "Modern Corporate",
        "slides": [
            {
                "title": "Executive Summary",
                "content": ["Key point 1", "Key point 2"],
                "speaker_notes": "Emphasize value prop",
                "layout": "Title and Content"
            }
        ]
    }
    
    # Mock generate_json to return the expected outline
    mock_llm_service.generate_json = AsyncMock(return_value=expected_outline)

    # Mock MemoryService
    # We need to patch MemoryService inside the agent or mock the instance
    # Since MemoryService is instantiated inside __init__, we can mock it after instantiation if we want,
    # or better, we can modify the agent to accept it or patch the class.
    # For this test, let's patch the class.
    
    from unittest.mock import patch
    with patch('app.services.ai_service.ppt_outline_agent.MemoryService') as MockMemoryService:
        mock_memory_instance = MockMemoryService.return_value
        mock_memory_instance.search_long_term.return_value = ["Prior pursuit A had a similar scope.", "Client values innovation."]

        agent = PPTOutlineAgent(mock_llm_service)
        
        metadata = {
            "entity_name": "Acme Corp",
            "service_types": ["Engineering"],
            "industry": "Tech"
        }
        
        research = {
            "overall_summary": "Acme Corp is expanding into AI."
        }

        print("Calling generate_outline...")
        result = await agent.generate_outline(metadata, research)
        
        print("Result:", result)
        
        assert result["title"] == "Proposal for Acme Corp"
        assert len(result["slides"]) == 1
        assert result["slides"][0]["title"] == "Executive Summary"
        
        print("✅ Test Passed!")

if __name__ == "__main__":
    asyncio.run(test_ppt_agent())
