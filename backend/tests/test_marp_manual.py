import asyncio
import sys
import os
import subprocess
from unittest.mock import MagicMock, AsyncMock

# Add backend directory to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../backend")))

from app.services.ai_service.ppt_outline_agent import PPTOutlineAgent

async def test_marp_integration():
    print("Testing MARP Integration...")

    # Mock LLMService
    mock_llm_service = MagicMock()
    
    # Expected Markdown output
    expected_markdown = """---
marp: true
theme: default
---

# Proposal for Acme Corp

- Key point 1
- Key point 2

<!-- _footer: Confidential -->

---

# Solution Overview

- Innovative approach
- Cost effective

"""
    
    # Mock generate_text to return the expected markdown
    mock_llm_service.generate_text = AsyncMock(return_value=expected_markdown)

    # Mock MemoryService
    from unittest.mock import patch
    with patch('app.services.ai_service.ppt_outline_agent.MemoryService') as MockMemoryService:
        mock_memory_instance = MockMemoryService.return_value
        mock_memory_instance.search_long_term.return_value = []

        agent = PPTOutlineAgent(mock_llm_service)
        
        metadata = {
            "entity_name": "Acme Corp",
            "service_types": ["Engineering"],
        }
        
        print("Calling generate_outline...")
        markdown_content = await agent.generate_outline(metadata)
        
        print("Generated Markdown:")
        print(markdown_content)
        
        assert "marp: true" in markdown_content
        
        # Test MARP conversion
        print("Testing MARP conversion...")
        test_md_file = "test_presentation.md"
        test_pptx_file = "test_presentation.pptx"
        
        with open(test_md_file, "w") as f:
            f.write(markdown_content)
            
        cmd = ["marp", "--pptx", test_md_file, "-o", test_pptx_file, "--allow-local-files"]
        
        try:
            subprocess.run(cmd, capture_output=True, text=True, check=True)
            print(f"✅ Successfully converted to {test_pptx_file}")
            
            if os.path.exists(test_pptx_file):
                print(f"✅ File exists: {test_pptx_file} ({os.path.getsize(test_pptx_file)} bytes)")
                # Cleanup
                # os.remove(test_md_file)
                # os.remove(test_pptx_file)
                print(f"Files saved: {test_md_file}, {test_pptx_file}")
            else:
                print("❌ File was not created.")
                
        except subprocess.CalledProcessError as e:
            print(f"❌ MARP failed: {e.stderr}")
            raise e
        except FileNotFoundError:
            print("❌ MARP command not found. Is it installed?")

if __name__ == "__main__":
    asyncio.run(test_marp_integration())
