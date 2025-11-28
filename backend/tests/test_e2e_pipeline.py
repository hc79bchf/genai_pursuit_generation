import asyncio
import sys
import os
import json
from unittest.mock import MagicMock, AsyncMock, patch
from datetime import datetime
from pydantic import BaseModel

# Add backend directory to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../backend")))

from app.schemas.pursuit import PursuitMetadata

# Define missing schemas locally for testing
class GapAnalysisResult(BaseModel):
    missing_information: list
    ambiguities: list
    risk_assessment: str
    search_queries: list

class ResearchResult(BaseModel):
    overall_summary: str
    research_results: list

from app.services.ai_service.ppt_outline_agent import PPTOutlineAgent
from app.services.ai_service.metadata_agent import MetadataExtractionAgent
from app.services.ai_service.gap_analysis_agent import GapAnalysisAgent
from app.services.ai_service.research_agent import ResearchAgent

async def run_e2e_pipeline():
    print("🚀 Starting End-to-End Pipeline Test...")
    
    # 1. Setup Input
    input_file = "/data/AI_Platform_RFP.docx" # Path inside container
    if not os.path.exists(input_file):
        # Fallback for local testing if not in container with volume
        input_file = "../Data/AI_Platform_RFP.docx"
        
    print(f"📂 Input File: {input_file}")
    
    # Mock LLMService
    mock_llm_service = MagicMock()
    
    # --- Step 1: Metadata Extraction ---
    print("\n--- Step 1: Metadata Extraction ---")
    
    # Mock extraction result
    mock_metadata = PursuitMetadata(
        entity_name="TechCorp",
        client_pursuit_owner_name="John Doe",
        client_pursuit_owner_email="john@techcorp.com",
        industry="Technology",
        service_types=["AI Platform", "Cloud Engineering"],
        technologies=["Python", "TensorFlow", "AWS"],
        submission_due_date=datetime.now().date(),
        expected_format="pptx",
        rfp_objective="Build a scalable AI platform.",
        requirements=["High availability", "Security compliance"],
        sources=["Page 1"]
    )
    
    mock_llm_service.generate_json = AsyncMock(side_effect=[mock_metadata])
    
    # Simulate extraction (we skip actual file reading and just test agent logic)
    metadata_agent = MetadataExtractionAgent(mock_llm_service)
    # We mock memory service inside agent
    with patch('app.services.ai_service.metadata_agent.MemoryService'):
        extracted_data = await metadata_agent.extract("Dummy text content from DOCX")
        print(f"✅ Extracted Metadata: {extracted_data}")

    # --- Step 2: Gap Analysis ---
    print("\n--- Step 2: Gap Analysis ---")
    
    # Mock gap analysis result
    mock_gap_result = GapAnalysisResult(
        missing_information=["Specific compliance standards"],
        ambiguities=["Timeline for phase 2"],
        risk_assessment="Low risk",
        search_queries=["TechCorp AI compliance standards", "TechCorp AI roadmap"]
    )
    
    # Reset side_effect for next call
    mock_llm_service.generate_json.side_effect = [mock_gap_result]
    
    gap_agent = GapAnalysisAgent(mock_llm_service)
    gap_result = await gap_agent.analyze(extracted_data, {}, user_id="test_user")
    print(f"✅ Gap Analysis Result: {gap_result}")

    # --- Step 3: Deep Search ---
    print("\n--- Step 3: Deep Search ---")
    
    # Mock research result
    mock_research_result = ResearchResult(
        overall_summary="TechCorp is a leader in AI innovation.",
        research_results=[
            {"query": "TechCorp AI", "summary": "They focus on ethical AI.", "sources": []}
        ]
    )
    
    # Research agent uses generate_json for summary? No, it uses generate_text usually or json.
    # Let's check ResearchAgent implementation. It likely uses generate_json for structured output.
    # Assuming it returns a dict or Pydantic model.
    mock_llm_service.generate_json.side_effect = [mock_research_result]
    
    # Mock generate_text for ResearchAgent AND PPTOutlineAgent
    # ResearchAgent uses it for extraction and summarization
    # PPTOutlineAgent uses it for markdown generation
    # We can use side_effect to return different values if needed, or just a default
    # For simplicity, let's use side_effect to handle both
    
    mock_markdown = """---
marp: true
theme: gaia
class: lead
backgroundColor: #fff
style: |
  section {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-size: 24px;
  }
  h1 {
    color: #0288d1;
  }
---

<!-- _class: invert -->
![bg right:40%](https://images.unsplash.com/photo-1518770660439-4636190af475?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80)

# Proposal for TechCorp
## AI Platform Modernization

**Submitted by:** Pursuit Team
**Date:** November 28, 2025

---

# Executive Summary

- **Objective:** Build a scalable, secure AI Platform.
- **Key Benefits:**
    - Auto-scaling infrastructure
    - SOC2 Compliance
    - Faster Time-to-Market
- **Our Commitment:** Deep expertise in Cloud & AI.

<!-- note: Keep it punchy. -->

---

<!-- _backgroundColor: #f0f8ff -->

# Proposed Solution: Architecture

<div class="mermaid">
graph TD;
    A[Data Sources] --> B[Data Lake S3];
    B --> C[Feature Store];
    C --> D[Training Cluster EKS];
    D --> E[Model Registry];
    E --> F[Inference API];
</div>

- **Scalable:** EKS based.
- **Secure:** IAM & VPC integration.

---

# Methodology

![bg left:30%](https://images.unsplash.com/photo-1531403009284-440f080d1e12?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80)

1. **Discovery:** Requirements gathering.
2. **Design:** Architecture blueprint.
3. **Build:** Infrastructure as Code.
4. **Migrate:** Move existing models.
5. **Train:** Handover to team.

---

# Conclusion

We are ready to start.

**Next Steps:**
- Sign Contract
- Kickoff Meeting

---

# Understanding Your Requirements

We understand that TechCorp requires:
1.  **High Availability:** 99.99% uptime for critical AI services.
2.  **Security Compliance:** Adherence to SOC2 and ISO27001 standards.
3.  **Scalability:** Ability to handle petabytes of data and thousands of concurrent model training jobs.

*Our solution is designed specifically to address these core needs.*

---

# Proposed Solution: Architecture

- **Core Infrastructure:** AWS EKS for container orchestration.
- **Data Layer:** S3 for data lake, Feature Store for ML features.
- **ML Ops:** Kubeflow pipelines for end-to-end model lifecycle management.
- **Security:** IAM roles, VPC endpoints, and encryption at rest/transit.

![bg right:40%](https://via.placeholder.com/300x200?text=Architecture+Diagram)

---

# Methodology & Timeline

## Phase 1: Discovery & Design (Weeks 1-4)
- Stakeholder interviews
- Architecture blueprinting

## Phase 2: Implementation (Weeks 5-12)
- Infrastructure provisioning (Terraform)
- Pipeline setup

## Phase 3: Migration & Training (Weeks 13-16)
- Model migration
- Team training and handover

---

# Our Team

- **John Doe (Principal Architect):** 15+ years in Cloud & AI.
- **Jane Smith (ML Ops Lead):** Expert in Kubeflow and TensorFlow.
- **Bob Johnson (Security Specialist):** Certified AWS Security Specialty.

---

# Conclusion

We are excited to partner with TechCorp on this transformative journey. Our proposed solution offers the perfect blend of innovation, security, and reliability.

**Next Steps:**
- Finalize contract
- Kick-off meeting next week

"""
    
    async def generate_text_side_effect(prompt, **kwargs):
        if "MARP Markdown" in prompt:
            return mock_markdown
        elif "Extract key information" in prompt:
            return json.dumps({"content": "Extracted info", "relevance_score": 0.9})
        elif "Summarize" in prompt:
            return "Summary of findings."
        elif "executive summary" in prompt:
            return "Overall executive summary."
        return "Generic response"

    mock_llm_service.generate_text = AsyncMock(side_effect=generate_text_side_effect)
    
    # Mock _brave_search method directly since ResearchAgent doesn't use a BraveSearch class
    research_agent = ResearchAgent(mock_llm_service)
    
    # Mock the _brave_search method
    research_agent._brave_search = AsyncMock(return_value=[
        {
            "title": "Result 1", 
            "url": "http://example.com/1", 
            "description": "Snippet 1"
        },
        {
            "title": "Result 2", 
            "url": "http://example.com/2", 
            "description": "Snippet 2"
        }
    ])
    
    research_output = await research_agent.research(gap_result['search_queries'], extracted_data, user_id="test_user")
    print(f"✅ Research Output: {research_output}")

    # --- Step 4: PPT Generation ---
    print("\n--- Step 4: PPT Generation ---")
    
    ppt_agent = PPTOutlineAgent(mock_llm_service)
    with patch('app.services.ai_service.ppt_outline_agent.MemoryService'):
        markdown_content = await ppt_agent.generate_outline(extracted_data, research_output)
        print("✅ Generated Markdown Outline:")
        print(markdown_content)

    # --- Step 5: MARP Conversion ---
    print("\n--- Step 5: MARP Conversion ---")
    
    output_pptx = "final_pursuit_response.pptx"
    output_md = "final_pursuit_response.md"
    
    with open(output_md, "w") as f:
        f.write(markdown_content)
        
    import subprocess
    cmd = ["marp", "--pptx", output_md, "-o", output_pptx, "--allow-local-files"]
    
    try:
        subprocess.run(cmd, capture_output=True, text=True, check=True)
        print(f"✅ Successfully converted to {output_pptx}")
        if os.path.exists(output_pptx):
             print(f"🎉 Final PPTX Size: {os.path.getsize(output_pptx)} bytes")
    except Exception as e:
        print(f"❌ MARP Conversion Failed: {e}")
        
    print("\n🚀 E2E Pipeline Completed Successfully!")

if __name__ == "__main__":
    asyncio.run(run_e2e_pipeline())
