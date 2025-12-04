# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI-powered RFP response platform that enables professional services firms to rapidly generate proposal responses using a 5-agent AI system, historical pursuit data, and collaborative workflows.

**Total Pipeline: < 5 minutes (from RFP upload to final document)**

## Critical Conventions

### AI Services & Models
- **All AI agents:** Claude 3 Haiku (`claude-3-haiku-20240307`) - configurable via `LLM_MODEL_FAST` and `LLM_MODEL_SMART`
- **Web search:** Brave Search API
- **Embeddings:** OpenAI text-embedding-3-small (1536 dimensions)
- **Agent architecture:** Custom sequential (NOT LangGraph, NOT CrewAI)

### Memory Architecture
- **Short-term (Redis):** Session data, corrections, TTL 1-2 hours
- **Long-term (PostgreSQL):** Patterns, naming conventions, permanent storage
- **Episodic (ChromaDB):** Past experiences with semantic search, permanent

### Code Style
- **Python:** Black formatting, type hints required, async/await everywhere
- **Frontend:** TypeScript with ESLint
- **Async operations:** All database and API operations MUST be async
- **Data validation:** Pydantic for all API request/response schemas

### Test-Driven Development (REQUIRED)
- **Red-Green-Refactor cycle:** Write failing tests first, then implement
- **No feature code without tests:** Use `test-writer` agent before implementation
- **Test markers:** `unit`, `integration`, `api`, `ai` (requires API keys), `slow`

## Commands

### Backend
```bash
cd backend
pytest                              # Run all tests
pytest tests/unit/agents/           # Run agent tests
pytest -m "not ai"                  # Skip live API tests
pytest -m ai                        # Run only AI tests (requires ANTHROPIC_API_KEY)
pytest --cov=app --cov-report=html  # With coverage report
uvicorn app.main:app --reload       # Start dev server
```

### Frontend
```bash
cd frontend
npm run dev                         # Start dev server
npm run build                       # Production build
npm run lint                        # Run linter
npm run test                        # Run tests
```

### Full Stack
```bash
docker-compose up -d                              # Start all services
docker-compose logs -f backend                    # View backend logs
docker-compose exec backend alembic upgrade head  # Run migrations
docker-compose exec backend pytest                # Run tests in container
```

## Key Architecture Patterns

### Five-Agent Sequential Pipeline
```
Agent 1: Metadata Extraction (~15-30s)
    ↓
Agent 2: Gap Analysis (~30s)
    ↓
Agent 3: Research (~120s) ← Uses Brave Search API
    ↓
Agent 4: Synthesis (~60-90s)
    ↓
Agent 5: Document Generation (~30-60s) ← Uses Claude Skills for .pptx/.docx
    ↓
Final output (.pptx or .docx)
```

### Agent Implementation Pattern
Every agent follows this structure:
1. **Input:** Receives structured data (Pydantic models)
2. **Memory integration:** Queries short-term, long-term, and episodic memory
3. **Prompt construction:** Uses memory context + system instructions
4. **LLM call:** Anthropic Claude API with streaming support
5. **Memory update:** Stores results in appropriate memory stores
6. **Token tracking:** Records usage and cost estimates
7. **Output:** Returns structured JSON (validated with Pydantic)

Location: `backend/app/services/ai_service/`
- `metadata_agent.py` - RFP metadata extraction with memory
- `gap_analysis_agent.py` - Coverage gap identification
- `research_agent.py` - Web research using Brave Search API
- `ppt_outline_agent.py` - PPT outline generation and document creation
- `llm_service.py` - Anthropic Claude client wrapper

### Memory Service Pattern
Location: `backend/app/services/memory_service.py`

**Three memory types:**
1. **Short-term (Redis):**
   - Key pattern: `short_term:{user_id}:{session_id}`
   - TTL: 1-2 hours
   - Use for: User corrections, session context

2. **Long-term (PostgreSQL):**
   - Table: `agent_memories`
   - Use for: Naming patterns, standard terminology

3. **Episodic (ChromaDB):**
   - Collection: `agent_episodic_memory`
   - Use for: Past similar scenarios with semantic search

### Token Tracking
Location: `backend/app/services/ai_service/token_tracking.py`

Every agent call must track:
- Input tokens
- Output tokens
- Model used
- Cost estimate
- Duration

## Critical Files

### Agent Implementations
- `backend/app/services/ai_service/metadata_agent.py` - Metadata extraction
- `backend/app/services/ai_service/gap_analysis_agent.py` - Gap analysis
- `backend/app/services/ai_service/research_agent.py` - Web research
- `backend/app/services/ai_service/llm_service.py` - Anthropic Claude client

### Memory & Utilities
- `backend/app/services/memory_service.py` - All three memory types
- `backend/app/services/ai_service/token_tracking.py` - Token usage tracking
- `backend/app/services/file_service.py` - File upload/processing

### Core Application
- `backend/app/main.py` - FastAPI application entry
- `backend/app/core/config.py` - Application settings
- `backend/app/core/database.py` - Async database configuration
- `backend/app/models/` - SQLAlchemy models
- `backend/app/schemas/` - Pydantic request/response models

### Infrastructure
- `docker-compose.yml` - 8 services (backend, frontend, worker, mcp-chroma, mcp-postgres, db, chroma, redis)
- `backend/requirements.txt` - Python dependencies
- `frontend/package.json` - Node dependencies

### Documentation
- `README.md` - Setup and overview
- `PRD.md` - Product requirements
- `technical-architecture.md` - System architecture
- `api-specification.md` - API endpoints
- `database-schema.md` - Database design

## Development Status

### Implemented ✅
- [x] Metadata Extraction Agent (with memory, token tracking)
- [x] Gap Analysis Agent (with memory, token tracking)
- [x] Research Agent (with Brave Search API, token tracking)
- [x] PPT Outline Agent (document generation with PPTX export)
- [x] Token tracking utility (cost estimation per agent)
- [x] Memory services (short-term Redis, long-term PostgreSQL, episodic ChromaDB)
- [x] Document ingestion service
- [x] Test infrastructure (pytest with markers)
- [x] API Routes (FastAPI endpoints) - Full CRUD for pursuits, auth, file uploads
- [x] Frontend components - Dashboard, Gap Assessment, Deep Search, PPT Generation
- [x] Docker containerization with 8 services
- [x] Activity-based token refresh mechanism
- [x] Pursuit status management (proposal lifecycle)

### Not Started ❌
- [ ] CI/CD (GitHub Actions)
- [ ] Production deployment (Railway configured but not live)

## Testing Strategy

### Test Markers
```bash
pytest -m unit                      # Fast, isolated tests
pytest -m integration               # Database/service tests
pytest -m api                       # Endpoint tests
pytest -m ai                        # Live API calls (requires keys)
pytest -m "not slow"                # Skip slow tests
```

### Running Agent Tests
```bash
# Test metadata extraction
pytest tests/unit/test_metadata_agent.py -v

# Test with live API calls
pytest tests/unit/test_metadata_agent.py -m ai -v

# Test all agents
pytest tests/unit/agents/ -v
```

## Environment Variables

### Required
```bash
ANTHROPIC_API_KEY=sk-ant-...         # Claude API
OPENAI_API_KEY=sk-...                # Embeddings
BRAVE_API_KEY=...                    # Web search (Research Agent)
DATABASE_URL=postgresql+asyncpg://...
REDIS_URL=redis://localhost:6379/0
```

### Optional
```bash
CHROMA_PERSIST_DIR=./chroma_data     # ChromaDB storage
JWT_SECRET_KEY=...                   # Has default for dev
LOG_LEVEL=INFO                       # Logging level
```

## Important Constraints

1. **Use Brave Search API** - For web research in Research Agent
2. **Async everywhere** - All DB/API operations must be async
3. **Memory integration** - All agents MUST use memory services
4. **No hardcoded secrets** - Use environment variables
5. **Type safety** - Pydantic models for all API data
6. **Token tracking** - Every LLM call must log token usage
7. **No hallucination** - Mark unknown content with `[GAP: Needs content]`

## Agent-Specific Patterns

### Metadata Extraction Agent
```python
# Memory retrieval
memories = self.memory_service.search_long_term(query, user_id, limit=3)

# Build context from memories
memory_context = "\n".join([m['text'] for m in memories])

# Prompt includes memory context
prompt = f"""
{memory_context}

Extract metadata from:
{rfp_text}
"""

# Store result in memory
self.memory_service.add_long_term(result, user_id)
```

### Research Agent
```python
# Use Brave Search API for web research
async with aiohttp.ClientSession() as session:
    async with session.get(
        "https://api.search.brave.com/res/v1/web/search",
        params={"q": query},
        headers={"X-Subscription-Token": settings.BRAVE_API_KEY}
    ) as response:
        results = await response.json()

# Track tokens for LLM processing
token_tracker.add_usage(
    input_tokens=...,
    output_tokens=...,
    model=settings.LLM_MODEL_SMART
)
```

### PPT Outline Agent
```python
# Generate presentation outline with citations
outline = {
    "sections": [...],
    "citations": [
        {"source": "pursuit_123", "text": "..."},
        {"source": "https://example.com", "text": "..."}
    ]
}

# Export to PPTX using python-pptx
from pptx import Presentation
prs = Presentation()
# ... slide generation
prs.save(output_path)
```

## Running Tests with Live APIs

```bash
# Export API keys first
export ANTHROPIC_API_KEY=sk-ant-...
export OPENAI_API_KEY=sk-...

# Run AI tests
pytest -m ai -v

# Test specific agent with real API
pytest tests/unit/test_research_agent.py::test_web_search -m ai -v
```

## Performance Targets

| Metric | Target | Status |
|--------|--------|--------|
| Page load | < 2 seconds | 🔨 In progress |
| API response | < 500ms | 🔨 In progress |
| Search results | < 30 seconds | ✅ Implemented |
| AI Agent 1 (Metadata) | < 30s | ✅ Implemented |
| AI Agent 2 (Gap Analysis) | < 30s | ✅ Implemented |
| AI Agent 3 (Research) | < 120s | ✅ Implemented |
| AI Agent 4 (Synthesis) | < 90s | ✅ Implemented |
| AI Agent 5 (Doc Gen) | < 60s | ✅ Implemented |
| **Total Pipeline** | **< 5 minutes** | ✅ **Achieved** |

## Available Slash Commands

- `/init` - Initialize environment and run tests
- `/test` - Run tests for specific module
- `/test-ai` - Test AI agents with live API calls
- `/code-review` - Review codebase for bugs, logging, error handling
- `/review-context` - Review all docs to rebuild context
- `/session-summary` - Generate comprehensive session summary for continuity
- `/review-docs` - Complete documentation and codebase review for accuracy


## Quick Reference

### Database Models
- `User` - User accounts
- `Pursuit` - Core pursuit entity
- `PursuitFile` - Uploaded files
- `AgentMemory` - Long-term memory storage
- `Citation` - Source citations

### Memory Service API
```python
# Short-term (Redis)
memory_service.add_short_term(content, user_id, session_id)
memory_service.get_short_term(user_id, session_id)

# Long-term (PostgreSQL)
memory_service.add_long_term(content, user_id)
memory_service.search_long_term(query, user_id, limit=5)

# Episodic (ChromaDB)
memory_service.add_episodic(content, metadata, user_id)
memory_service.search_episodic(query, user_id, limit=5)
```

### Token Tracking API
```python
tracker = TokenTracker(agent_name="metadata_extraction")
tracker.add_usage(
    input_tokens=1000,
    output_tokens=500,
    model=settings.LLM_MODEL_SMART  # claude-3-haiku-20240307
)
cost = tracker.get_total_cost()
```

---

**Last Updated:** 2025-11-29
**Status:** ✅ Full stack implemented - Backend API, Frontend UI, Docker containerization
**Next Steps:** CI/CD pipeline and production deployment
