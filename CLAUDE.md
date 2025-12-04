# CLAUDE.md - Pursuit Response Platform

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI-powered RFP response platform that enables professional services firms to rapidly generate proposal responses using a 7-agent AI system with Human-in-the-Loop (HITL) review, historical pursuit data, and collaborative workflows.

**Total Pipeline: ~15 minutes** (excluding human review time)

## Critical Conventions

### AI Services & Models
- **Pipeline agents (7):** Claude Sonnet 4.5 (`claude-sonnet-4-5-20250929`)
- **Validation Agent Mode A:** Claude Haiku (`claude-3-5-haiku-20241022`) for stage-level validation (runs before AND after each HITL review)
- **Validation Agent Mode B:** OpenAI GPT-4o for comprehensive final validation (independent verification)
- **Web search:** Claude API web search (not Brave)
- **Academic search:** Arxiv MCP server (`arxiv-mcp-server`) for academic paper search
- **Embeddings:** OpenAI text-embedding-3-small (1536 dimensions)
- **Agent architecture:** Custom sequential (NOT LangGraph, NOT CrewAI)

### Memory Architecture
- **Short-term (Redis):** Session data, corrections, TTL 1-2 hours
- **Long-term (PostgreSQL):** Patterns, naming conventions, permanent storage
- **Episodic (ChromaDB):** Past experiences with semantic search, permanent
- **Edit Tracking:** HITL edit tracking and corrections

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

### Seven-Agent Sequential Pipeline with HITL

```
User uploads RFP
       ↓
Agent 1: Metadata Extraction (~15-30s)
       ↓
    [Validation A (Pre) → HITL → Validation A (Post) → PM/PP Approve]
       ↓
Agent 2: Team Composition (~30-60s)  ← Early placement for team input
       ↓
    [Validation A (Pre) → HITL → Validation A (Post) → PM/PP Approve]
       ↓
Agent 3: Similar Pursuit Identification (~15-30s)
       ↓
    [Validation A (Pre) → HITL: Granular Content Selection → Validation A (Post) → PM/PP Approve]
       ↓
Agent 4: Gap Analysis (~30s)
       ↓
    [Validation A (Pre) → HITL → Validation A (Post) → PM/PP Approve]
       ↓
Agent 5: Research - Web + Arxiv (~120s)
       ↓
    [Validation A (Pre) → HITL → Validation A (Post) → PM/PP Approve]
       ↓
Agent 6: Synthesis (~60-90s)
       ↓
    [Validation A (Pre) → HITL: Edit/Chat/Upload → Validation A (Post)]
       ↓
    ⭐ CRITICAL GATE: PM AND PP must BOTH approve (alignment before token spend)
       ↓
    [If new gaps → Re-run from Agent 3]
       ↓
Agent 7: Document Generation (~30-60s)
       ↓
    [Validation A (Pre) → HITL → Validation A (Post) → PM/PP Approve]
       ↓
    [Validation B: Final GPT-4o Review]
       ↓
Final .pptx or .docx output + Team Roster
```

### Approval Authority
| Stage | Approver |
|-------|----------|
| Agents 1-5, 7 | Pursuit Manager **OR** Pursuit Partner |
| Agent 6 (Synthesis) | Pursuit Manager **AND** Pursuit Partner |

### Agent Implementation Pattern
Every agent follows this structure:
1. **Input:** Receives structured data (Pydantic models)
2. **Memory integration:** Queries short-term, long-term, and episodic memory
3. **Prompt construction:** Uses memory context + system instructions
4. **LLM call:** Anthropic Claude API with streaming support
5. **Memory update:** Stores results in appropriate memory stores
6. **Token tracking:** Records usage and cost estimates
7. **Output:** Returns structured JSON (validated with Pydantic)

### Memory Service Pattern
Location: `backend/app/services/memory/`

**Four memory types:**
1. **Short-term (Redis):**
   - Key pattern: `short_term:{user_id}:{session_id}`
   - TTL: 1-2 hours
   - Use for: User corrections, session context

2. **Long-term (PostgreSQL):**
   - Table: `agent_long_term_memory` (via `LongTermMemoryModel`)
   - Use for: Naming patterns, standard terminology

3. **Episodic (ChromaDB):**
   - Collection: `agent_episodic_memory`
   - Use for: Past similar scenarios with semantic search

4. **Edit Tracking:**
   - HITL edit tracking and corrections

### Token Tracking
Location: `backend/app/services/agents/token_tracking.py`

Every agent call must track:
- Input tokens
- Output tokens
- Model used
- Cost estimate
- Duration

## Critical Files

### Agent Implementations
- `backend/app/services/agents/metadata_extraction_agent.py` - Agent 1: RFP metadata extraction
- `backend/app/services/agents/team_composition_agent.py` - Agent 2: Team composition (early for team input)
- `backend/app/services/agents/similar_pursuit_agent.py` - Agent 3: Similar pursuit identification with granular content selection
- `backend/app/services/agents/gap_analysis_agent.py` - Agent 4: Coverage gap identification
- `backend/app/services/agents/research_agent.py` - Agent 5: Web + Arxiv research for gaps
- `backend/app/services/agents/synthesis_agent.py` - Agent 6: Outline synthesis with citations
- `backend/app/services/agents/document_generation_agent.py` - Agent 7: Document generation using Claude Skills
- `backend/app/services/agents/validation_agent.py` - Validation Agent (Mode A: Haiku, Mode B: GPT-4o)

### Memory Services
- `backend/app/services/memory/short_term.py` - Redis-based session memory
- `backend/app/services/memory/long_term.py` - PostgreSQL patterns/conventions
- `backend/app/services/memory/episodic.py` - ChromaDB semantic search
- `backend/app/services/memory/edit_tracking.py` - HITL edit tracking and corrections

### HITL Infrastructure
- `backend/app/schemas/stage_review.py` - Pydantic models for human review workflow
- Team composition types defined inline in `backend/app/services/agents/team_composition_agent.py`

### Core Application
- `backend/app/main.py` - FastAPI application entry
- `backend/app/core/config.py` - Application settings
- `backend/app/core/database.py` - Async database configuration
- `backend/app/models/` - SQLAlchemy models
- `backend/app/schemas/` - Pydantic request/response models

### Infrastructure
- `docker-compose.yml` - Full stack orchestration (7 services)
- `backend/requirements.txt` - Python dependencies
- `frontend/package.json` - Node dependencies

### Documentation (Root Directory)
- `README.md` - Setup and overview
- `PRD.md` - Product requirements
- `technical-architecture.md` - System architecture
- `api-specification.md` - API endpoints
- `database-schema.md` - Database design
- `system-requirements.md` - Detailed requirements
- `user-workflows.md` - User workflows and UI specs

## Development Status

### Implemented ✅
- [x] Agent 1: Metadata Extraction Agent (with memory, token tracking)
- [x] Agent 2: Team Composition Agent (with memory, HITL, candidate matching, availability)
- [x] Agent 3: Similar Pursuit Identification Agent (with memory, weighted scoring, HITL, granular content selection)
- [x] Agent 4: Gap Analysis Agent (with memory, token tracking, HITL integration)
- [x] Agent 5: Research Agent (with memory, Claude API web search, Arxiv MCP, token tracking)
- [x] Agent 6: Synthesis Agent (with memory, streaming support, token tracking)
- [x] Agent 7: Document Generation Agent (with memory, Claude Agent Skills for pptx/docx, token tracking)
- [x] Validation Agent Mode A (LLM-as-a-Judge, stage-level validation with Claude Haiku)
- [x] Validation Agent Mode B (final validation with GPT-4o)
- [x] Token tracking utility (cost estimation per agent)
- [x] Memory services (short-term, long-term, episodic, edit tracking)
- [x] HITL infrastructure (stage review schemas, edit tracking memory)
- [x] Document ingestion service
- [x] Test infrastructure (pytest with markers)
- [x] API Routes (FastAPI endpoints) - Full CRUD for pursuits, auth, file uploads
- [x] Frontend components - Dashboard, Workflow UI, Gap Assessment, Deep Search, PPT Generation
- [x] Docker containerization with services
- [x] Activity-based token refresh mechanism
- [x] Pursuit status management (proposal lifecycle)
- [x] Base SQLAlchemy async setup (migrations not yet created)

### Not Started ❌
- [ ] CI/CD (GitHub Actions)
- [ ] Production deployment (Railway configured but not live)
- [ ] Batch Learning Service - Extract patterns from session corrections to long-term memory
- [ ] ChromaDB Integration for Agent 3 - Replace mock data with real vector search
- [ ] Alembic migrations - Currently no migrations directory exists
- [ ] Missing database models - PursuitReference, QualityTag, Review, Citation, PursuitMetrics

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
OPENAI_API_KEY=sk-...                # Embeddings & GPT-4o validation
DATABASE_URL=postgresql+asyncpg://...
REDIS_URL=redis://localhost:6379/0
```

### Optional
```bash
CHROMA_PERSIST_DIR=./chroma_data     # ChromaDB storage
ARXIV_STORAGE_PATH=~/.arxiv-mcp-server/papers  # Arxiv MCP paper storage
JWT_SECRET_KEY=...                   # Has default for dev
LOG_LEVEL=INFO                       # Logging level
```

## Important Constraints

1. **No Brave Search** - Use Claude API web search instead
2. **Async everywhere** - All DB/API operations must be async
3. **Memory integration** - All agents MUST use memory services
4. **No hardcoded secrets** - Use environment variables
5. **Type safety** - Pydantic models for all API data
6. **Token tracking** - Every LLM call must log token usage
7. **No hallucination** - Mark unknown content with `[GAP: Needs content]`

## Performance Targets

| Metric | Target | Actual (E2E) | Status |
|--------|--------|--------------|--------|
| Page load | < 2 seconds | TBD | 🔨 In progress |
| API response | < 500ms | TBD | 🔨 In progress |
| Search results | < 30 seconds | TBD | 🔨 In progress |
| Validation suggestions | < 5s per stage | ~5s | ✅ PASS |
| Agent 1 (Metadata) | 15-30s | ~20s | ✅ PASS |
| Agent 2 (Team Composition) | 30-60s | TBD | 🔨 PENDING |
| Agent 3 (Similar Pursuit) | 15-30s | TBD | 🔨 NOT IMPLEMENTED |
| Agent 4 (Gap Analysis) | 30s | ~20s | ✅ PASS |
| Agent 5 (Research) | 120s | ~116s | ✅ PASS |
| Agent 6 (Synthesis) | 60-90s | ~186s | ⚠️ NEEDS OPTIMIZATION |
| Agent 7 (Doc Gen) | 30-60s | ~396s | ⚠️ NEEDS OPTIMIZATION |
| **Total Pipeline** | **< 7 min** | **~15 min** | ⚠️ **NEEDS OPTIMIZATION** |

*Note: Synthesis and Document Generation agents need performance optimization*

## Available Slash Commands

- `/init` - Initialize environment and run tests
- `/test` - Run tests for specific module
- `/test-ai` - Test AI agents with live API calls
- `/code-review` - Review codebase for bugs, logging, error handling
- `/review-context` - Review all docs to rebuild context
- `/session-summary` - Generate comprehensive session summary for continuity
- `/review-docs` - Complete documentation and codebase review for accuracy
- `/rebuild-context` - Three-pass context rebuild for new sessions
- `/audit-docs` - Documentation audit with session summary
- `/coverage` - Generate coverage report

## Quick Reference

### Database Models (Implemented)
- `User` - User accounts (`backend/app/models/user.py`)
- `Pursuit` - Core pursuit entity (`backend/app/models/pursuit.py`)
- `PursuitFile` - Uploaded files (`backend/app/models/pursuit_file.py`)
- `AuditLog` - Audit trail (`backend/app/models/audit_log.py`)

### Database Models (Not Yet Implemented)
- `PursuitReference` - Links between pursuits
- `QualityTag` - User-applied quality markers
- `Review` - Approval workflow records
- `Citation` - Source citations
- `PursuitMetrics` - Pre-aggregated analytics

### Memory Models (In Memory Services)
- `LongTermMemoryModel` - Defined in `backend/app/services/memory/long_term.py`
- `StageReviewModel` - Defined in `backend/app/services/memory/edit_tracking.py`
- `LearnedPatternModel` - Defined in `backend/app/services/memory/edit_tracking.py`

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
    model="claude-sonnet-4-5-20250929"
)
cost = tracker.get_total_cost()
```

### HITL Features (Agent 6: Synthesis)
- **Direct Edit:** Edit outline in UI
- **Chatbot:** Natural language refinement
- **Download/Upload:** Offline editing

---

**Last Updated:** 2025-12-02
**Status:** ✅ Full stack implemented - Backend API, Frontend UI, Docker containerization
**Next Steps:** Performance optimization for Synthesis and Document Generation agents, CI/CD pipeline
