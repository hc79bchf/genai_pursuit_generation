# Walkthrough: Enhance Metadata Extraction Agent

## Goal
Enhance the `MetadataExtractionAgent` to extract richer information from RFPs, specifically:
- **RFP Objective**: The client's main goal.
- **Requirements**: Specific technical or business requirements.
- **Sources**: References to where information was found in the text.

## Changes

### 1. Schema Update (`backend/app/schemas/pursuit.py`)
- Added `rfp_objective` (Optional[str])
- Added `requirements` (List[str])
- Added `sources` (List[str])

### 2. Agent Logic (`backend/app/services/ai_service/metadata_agent.py`)
- Updated the system prompt to explicitly request these new fields.
- The `LLMService` (using tool use) automatically enforces the updated Pydantic schema.

### 3. Documentation (`README.md`)
- Added "Smart Metadata Extraction" to Key Capabilities.

## Verification

### Manual Verification
Ran `scripts/run_metadata_extraction.py` against `Data/AI_Platform_RFP.docx`.

**Output:**
```json
{
  "entity_name": "Leading financial services organization",
  ...
  "rfp_objective": "Establish centralized AI governance framework with automated policy enforcement...",
  "requirements": [
    "Platform implementation including infrastructure provisioning...",
    "Integration with existing enterprise systems...",
    "AI governance framework design...",
    ...
  ],
  "sources": [
    "Page 3, Section 3.2",
    "Page 4, Section 4",
    "Page 5, Section 5"
  ]
}
```

### Unit Tests
Updated `backend/tests/unit/test_metadata_agent.py` to assert the presence of the new fields.
