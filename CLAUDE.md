# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pursuit Response Platform - an AI-powered proposal generation system for professional services firms responding to RFPs. Uses a four-agent custom sequential workflow (Metadata -> Gap Analysis -> Research -> Synthesis) to generate proposal outlines.

**Status:** Technical specifications complete, ready for implementation.

## Technology Stack

### Backend
- **Framework:** FastAPI (Python 3.11+)
- **ORM:** SQLAlchemy 2.x (async with asyncpg)
- **Task Queue:** Celery + Redis
- **Agent Framework:** Custom (Direct API)
- **LLM:** Anthropic Claude 3.5 Sonnet
- **Embeddings:** OpenAI text-embedding-3-small

### Frontend
- **Framework:** React 18 + TypeScript
- **UI:** shadcn/ui + Tailwind CSS
- **State:** Zustand (client) + React Query (server)
- **Build:** Next.js 14

### Database
- **PostgreSQL 15+** for relational data
- **ChromaDB** for vector similarity search

## Development Commands

### Backend Setup
```bash
cd backend
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Database setup
createdb pursuit_db
alembic upgrade head

# Run server
uvicorn app.main:app --reload --port 8000

# Run Celery worker
celery -A app.tasks.celery_app worker --loglevel=info
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### Docker (Recommended)
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
# Edit .env files with API keys (ANTHROPIC_API_KEY, OPENAI_API_KEY, BRAVE_API_KEY)

docker-compose up -d
docker-compose exec backend alembic upgrade head
```

### Code Quality
```bash
# Backend
black app/
isort app/
flake8 app/
mypy app/
pytest tests/ -v --cov=app

# Frontend
npm run format
npm run lint
npm run type-check
npm run test
```

### Testing Commands
```bash
# Backend tests
cd backend && pytest tests/ -v --cov=app

# Frontend tests
cd frontend && npm run lint && npm run build
```

## Architecture

### Four-Agent AI System (Custom Sequential)
Sequential workflow in `app/services/ai_service/`:
1. **Metadata Agent** (~10s) - Extracts structured metadata from RFP documents
2. **Gap Analysis Agent** (~30s) - Analyzes RFP against past pursuits, identifies coverage gaps
3. **Research Agent** (~60s) - Web search (Brave API) to fill gaps, uses Claude Haiku for extraction
4. **Synthesis Agent** (~90s) - Generates structured outline with citations

State is managed via Python dictionaries/Pydantic models passed between agents. Checkpointing enabled for resume capability.

### Backend Structure
```
backend/app/
├── api/v1/          # FastAPI route handlers
├── core/            # Config, security, database
├── models/          # SQLAlchemy models
├── schemas/         # Pydantic request/response schemas
├── services/        # Business logic (including AI agents)
├── tasks/           # Celery background tasks
└── main.py          # App entry point
```

### Key Services
- `LLMService` - Anthropic Claude API integration
- `MemoryService` - Mem0 integration for agent memory
- `metadata_agent` - Metadata extraction from RFPs
- *(Planned)* `PursuitService` - CRUD for pursuits
- *(Planned)* `SearchService` - Vector similarity search with ChromaDB

### Database Schema
9 core tables: users, pursuits, pursuit_files, pursuit_references, quality_tags, reviews, citations, audit_logs, pursuit_metrics

Vector column uses 1536 dimensions with IVFFlat index for similarity search.

### API Patterns
- JWT authentication (30-day expiry)
- Async database operations throughout
- Background tasks via Celery for AI generation
- Task status polling via `/api/v1/tasks/{task_id}`

## Environment Variables
Required API keys:
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `BRAVE_API_KEY`

## Key Implementation Notes

- **No hallucination policy:** Synthesis agent marks unknown content with `[GAP: Needs content]` placeholders
- **Metadata-aware:** All agents consider industry, service_types, technologies for context
- **Citations required:** All generated content must have source citations
- **Auto-save:** Implement pursuit state persistence for resume functionality
