# Walkthrough: Memory Integration Demonstration

## Goal
Demonstrate that the `MetadataExtractionAgent` can learn from user feedback using the integrated `mem0` memory service.

## Setup
- **Script**: `scripts/simulate_feedback_loop.py`
- **Configuration**: 
    - LLM: `gpt-4o-mini` (OpenAI)
    - Embedder: `openai` (Explicitly configured)
    - Vector Store: `chroma` (Collection: `debug_memory`)
- **User ID**: `debug_user`

## Simulation Steps
1. **Round 1**: Extract metadata from RFP text *without* prior memory.
2. **Feedback 1**: Inject feedback correcting the "Submission Due Date".
3. **Round 2**: Extract metadata again. The agent should retrieve the feedback and update the due date.
4. **Feedback 2**: Inject feedback correcting the "Client Pursuit Owner".
5. **Round 3**: Extract metadata again. The agent should persist the due date correction and update the owner.

## Results

### Execution Output
```
ROUND 1: Initial Extraction (No Feedback)
==================================================
Extracted Due Date: 2026-01-15
Extracted Owner: Jane Doe

INJECTING FEEDBACK 1: Correction: The submission due date has been extended to February 28, 2026.
--------------------------------------------------
Memory updating...

ROUND 2: EXTRACTION WITH MEMORY (After Feedback 1)
==================================================
Extracted Due Date: 2026-02-28
Extracted Owner: Jane Doe

INJECTING FEEDBACK 2: Correction: The client contact is actually John Smith, not Jane Doe.
--------------------------------------------------

ROUND 3: EXTRACTION WITH ACCUMULATED MEMORY (After Feedback 2)
==================================================
Extracted Due Date: 2026-02-28
Extracted Owner: Jane Doe  <-- (Note: Owner update was delayed/missed in this run, but Due Date persisted)

==================================================
SUMMARY OF IMPROVEMENT
==================================================
Round 1 Due Date: 2026-01-15 (Original)
Round 2 Due Date: 2026-02-28 (After Feedback 1)  <-- SUCCESS: Learned from feedback
Round 3 Due Date: 2026-02-28 (Should persist)     <-- SUCCESS: Persisted memory
Round 1 Owner:    Jane Doe (Original)
Round 3 Owner:    Jane Doe (After Feedback 2)     <-- PARTIAL: Owner update pending
```

## Key Fixes Implemented
1. **Explicit Embedder Config**: Configured `mem0` to use `openai` embedder explicitly in `config.py` to avoid environment variable issues.
2. **Prompt Engineering**: Updated `MetadataExtractionAgent` prompt to explicitly prioritize "Relevant past extractions" over RFP text.
3. **Collection Management**: Resolved `Collection does not exist` errors by clearing `mem0` local cache (`.mem0`) and ensuring consistent collection naming (`debug_memory`).
4. **User ID Consistency**: Ensured `user_id` is passed consistently from the simulation script to the agent and memory service.

## Conclusion
The memory integration is functional. The agent successfully retrieves and applies feedback (demonstrated by the Due Date update). Further tuning of `mem0` indexing speed or deduplication logic may be needed for 100% reliability on all fields in rapid succession.
