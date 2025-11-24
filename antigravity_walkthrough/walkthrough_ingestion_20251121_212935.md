# Walkthrough: Proposal Ingestion Pipeline

## Goal
Implement a pipeline to ingest prior proposal documents (`.docx`, `.pptx`) into ChromaDB for semantic search, enabling the "Search Similar Pursuits" feature.

## Implementation

### 1. Ingestion Script (`scripts/ingest_proposals.py`)
- **Dependencies**: `chromadb`, `openai`, `python-docx`, `python-pptx`
- **Logic**:
    - Connects to ChromaDB (defaulting to `localhost:8001` or local fallback).
    - Iterates through `Data/PriorProposal`.
    - Extracts text from DOCX (paragraphs) and PPTX (slides).
    - Chunks text (1000 chars, 100 overlap).
    - Embeds using `text-embedding-3-small` via OpenAI.
    - Indexes into `prior_proposals` collection.

### 2. Query Script (`scripts/query_proposals.py`)
- Simple script to verify retrieval by querying the collection.

## Verification

### Execution
Ran `python scripts/ingest_proposals.py`.
- **Result**: Successfully indexed 12 chunks from 5 files.
```
Connecting to ChromaDB at localhost:8001...
Successfully connected to ChromaDB.
Collection 'prior_proposals' ready.
...
Ingestion complete! Total chunks indexed: 12
```

### Retrieval Verification
Ran `python scripts/query_proposals.py`.
- **Query**: "AI Governance Framework"
- **Result**: Retrieved relevant chunks from `Proposal1_AI_Governance_Framework.docx`.
```
Result 1:
Source: Proposal1_AI_Governance_Framework.docx
Content Snippet: AI GOVERNANCE & COMPLIANCE FRAMEWORK...
```
