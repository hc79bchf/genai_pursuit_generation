# Agent Architecture Clarification
# Pursuit Response Platform

**Date:** 2025-11-20
**Status:** Technical Clarification

---

## Architecture Decision: Custom Implementation Only

**Decision:** The Pursuit Response Platform will use a **custom-built four-agent sequential system** using **direct Anthropic Claude API calls**.

**Explicit Constraint:** We will **NOT** use any pre-built agent frameworks such as:
- ❌ LangGraph
- ❌ LangChain
- ❌ CrewAI
- ❌ AutoGen
- ❌ Microsoft Semantic Kernel

**Rationale:**
1. **Simplicity:** Direct API calls are easier to debug and maintain than complex framework abstractions.
2. **Control:** Full control over prompt engineering, context management, and error handling.
3. **Dependencies:** Minimizes external dependencies, reducing security surface area and maintenance burden.
4. **Performance:** Removes framework overhead for faster execution.

---

## Defined Agent Architecture

### Four-Agent Sequential System

The system consists of four specialized agents that execute sequentially to generate pursuit responses.

```python
# app/services/ai_service.py (Conceptual Implementation)

class AIService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.anthropic_client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
        self.search_client = httpx.AsyncClient()

    async def run_pursuit_generation(self, pursuit_id: str):
        """Orchestrator method"""
        # 1. Metadata Extraction
        metadata = await self.run_metadata_agent(pursuit_id)
        
        # 2. Gap Analysis
        gap_analysis = await self.run_gap_analysis_agent(pursuit_id, metadata)
        
        # 3. Research
        research = await self.run_research_agent(gap_analysis)
        
        # 4. Synthesis
        outline = await self.run_synthesis_agent(pursuit_id, research)
        
        return outline
```

### Agent 1: Metadata Extraction Agent
**Role:** Extracts structured metadata from uploaded RFP documents.
- **Input:** Raw text from RFP documents (PDF/DOCX).
- **Output:** JSON object containing:
    - Client Name
    - Industry
    - Service Types
    - Technology Stack
    - Submission Deadline
    - Key Requirements
- **Implementation:** Direct Claude 3.5 Sonnet API call with JSON mode.

### Agent 2: Gap Analysis Agent
**Role:** Analyzes RFP requirements against internal capabilities and identifies missing information.
- **Input:** Extracted metadata, RFP text, Reference Pursuits.
- **Output:** JSON object containing:
    - Covered Requirements (with reference citations)
    - Missing Capabilities (Gaps)
    - Ambiguous Requirements
    - Questions for Clarification
- **Implementation:** Direct Claude 3.5 Sonnet API call.

### Agent 3: Web Research Agent
**Role:** Finds external information to fill identified gaps.
- **Input:** List of "Missing Capabilities" and "Ambiguous Requirements" from Agent 2.
- **Output:** Structured research findings with source URLs.
- **Implementation:** 
    - Custom Python logic to query Search API (Brave/SerpAPI).
    - Claude 3 Haiku used to summarize/extract relevant info from search results.

### Agent 4: Synthesis Agent
**Role:** Generates the final proposal outline and content.
- **Input:** RFP Requirements, Metadata, Gap Analysis, Research Findings.
- **Output:** Comprehensive Proposal Outline (JSON) with:
    - Executive Summary
    - Technical Approach
    - Case Studies (from references)
    - Implementation Plan
- **Implementation:** Direct Claude 3.5 Sonnet API call (Streaming).

---

## Technical Implementation Details

### 1. Direct API Integration
All agents will interact directly with the Anthropic API using the official Python SDK (`anthropic`).

```python
response = await client.messages.create(
    model="claude-3-5-sonnet-20241022",
    max_tokens=4096,
    messages=[
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]
)
```

### 2. State Management
State is passed explicitly between functions in the `AIService` class. There is no complex graph state object; simple Python dictionaries or Pydantic models are used to pass data from one step to the next.

### 3. Error Handling
Custom try/except blocks will handle API failures, with simple exponential backoff for rate limits.

### 4. Observability
- **Logging:** All prompts and responses are logged to the `audit_logs` table for review.
- **Tracking:** Each agent step updates the `pursuit.progress_percentage` and `pursuit.current_stage` fields in the database.
- **Vector Store:** Embeddings are stored in ChromaDB for semantic retrieval.

---

## Summary of Changes
- **Removed:** All references to LangGraph and other agent frameworks.
- **Added:** Metadata Extraction Agent as the first step.
- **Clarified:** "Custom Implementation" is the ONLY supported path.
