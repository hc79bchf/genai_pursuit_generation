# Walkthrough: Containerized Development Workflow

## Goal
Shift all development and testing to run inside the Docker container to ensure a consistent environment and avoid local dependency issues.

## Changes

### 1. Docker Configuration (`docker-compose.yml`)
- Mounted `./Data` to `/data` so agents can access RFP files.
- Mounted `./scripts` to `/app/scripts` so scripts can be executed inside the container.

### 2. Dependencies (`backend/requirements.txt`)
- Added `tenacity` (required for retry logic).
- Upgraded `anthropic` to `>=0.25.0` to resolve compatibility issues with `httpx`.

### 3. Scripts (`scripts/run_metadata_extraction.py`)
- Updated to detect if running in a container and use the `/data` path.

## How to Run

### 1. Start Containers
```bash
docker compose up -d backend
```

### 2. Run Tests
Execute `pytest` inside the `pursuit_backend` container:
```bash
docker exec pursuit_backend pytest tests/unit/test_metadata_agent.py
```

### 3. Run Agent Scripts
Execute python scripts inside the container:
```bash
docker exec pursuit_backend python scripts/run_metadata_extraction.py
```

## Verification Results
- **Tests:** ✅ Passed inside container.
- **Agent Script:** ✅ Successfully extracted metadata from `/data/AI_Platform_RFP.docx`.
