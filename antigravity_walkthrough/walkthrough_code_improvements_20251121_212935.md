# Walkthrough: Improve Metadata Agent & LLM Service

## Goal
Align the `MetadataExtractionAgent` and `LLMService` with project best practices by implementing centralized configuration, robust error handling (retries), and structured logging.

## Changes

### 1. Centralized Configuration (`backend/app/core/config.py`)
- Created `Settings` class using `pydantic-settings`.
- Centralized API keys and model names (`LLM_MODEL_FAST`, `LLM_MODEL_SMART`).

### 2. LLM Service Improvements (`backend/app/services/ai_service/llm_service.py`)
- **Retry Logic:** Added `tenacity` decorator to `generate_json` with exponential backoff (3 attempts).
- **Logging:** Replaced `print` statements with standard `logging`.
- **Configuration:** Uses `settings` object instead of `os.getenv`.

### 3. Metadata Agent Updates (`backend/app/services/ai_service/metadata_agent.py`)
- Updated to explicitly use `settings.LLM_MODEL_SMART` (currently configured to `claude-3-haiku-20240307` for availability).

## Verification

### Manual Verification
Ran `scripts/run_metadata_extraction.py`.
- **Status:** ✅ Success
- **Output:** Successfully extracted metadata including new fields (Objective, Requirements, Sources).
- **Resilience:** Confirmed retry logic is in place (code inspection).

```bash
$ python scripts/run_metadata_extraction.py
Reading file: .../Data/AI_Platform_RFP.docx
Extracted 11517 characters.
Initializing Agent...
Running Metadata Extraction...
--- Extraction Results ---
{'entity_name': 'Leading financial services organization', ...}
```
