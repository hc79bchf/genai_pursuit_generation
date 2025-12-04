# Pursuit Response Platform
## AI-Powered Proposal Generation System

**Version:** 1.0 MVP
**Status:** Technical Specifications Complete - Ready for Development
**Last Updated:** 2025-11-18

---

## 📋 Project Overview

The Pursuit Response Platform is an AI-powered system that enables professional services firms to rapidly and effectively respond to RFPs by leveraging AI-powered content generation, historical pursuit data, and collaborative workflows.

### Key Capabilities
- 🤖 **AI-Powered Outline Generation** - 7-agent pipeline with HITL review (Metadata → Team → Similar Pursuit → Gap → Research → Synthesis → Document)
- 📄 **Smart Metadata Extraction** - Automatically extracts client details, objectives, requirements, and sources from RFPs
- 🔍 **Semantic Search** - Find similar past pursuits using vector embeddings
- 💬 **Iterative Refinement** - Chat-based and direct editing of proposals
- 📄 **Document Generation** - Export to DOCX and PPTX formats
- ✅ **Review Workflow** - Multi-reviewer approval process with HITL gates
- 📊 **Analytics Dashboard** - Track win rates and performance metrics

### Business Objectives
- **50% Time Reduction**: Cut proposal creation from days to hours
- **10-15% Win Rate Improvement**: Higher quality through AI assistance
- **80%+ Content Reuse**: Leverage historical pursuits effectively

---

## 📚 Documentation Index

### Requirements & Planning (3 docs)
| Document | Description | Status |
|----------|-------------|--------|
| **PRD.md** | Product Requirements Document | ✅ Complete |
| **system-requirements.md** | Detailed System Requirements | ✅ Complete |
| **user-workflows.md** | User Workflows & UI Specifications | ✅ Complete |

### Technical Specifications (3 docs)
| Document | Description | Status |
|----------|-------------|--------|
| **technical-architecture.md** | Complete Technical Architecture | ✅ Complete |
| **database-schema.md** | Database Schema (PostgreSQL + ChromaDB) | ✅ Complete |
| **api-specification.md** | REST API Specification (FastAPI) | ✅ Complete |

### Project Configuration
| Document | Description | Status |
|----------|-------------|--------|
| **CLAUDE.md** | Claude Code project instructions | ✅ Complete |

---

## 🏗️ Technology Stack

### Frontend
- **Framework:** React 18 + TypeScript
- **UI Components:** shadcn/ui + Tailwind CSS
- **State Management:** Zustand (client) + React Query (server)
- **Build Tool:** Next.js 14

### Backend
- **Framework:** FastAPI (Python 3.11+)
- **ORM:** SQLAlchemy 2.x (async)
- **Task Queue:** Celery + Redis
- **Validation:** Pydantic
- **Server:** Uvicorn (ASGI)

### Database
- **Database:** PostgreSQL 15+
- **Vector Search:** ChromaDB
- **Migrations:** Alembic

### AI Services
- **LLM:** Anthropic Claude Sonnet 4.5 (`claude-sonnet-4-5-20250929`)
- **Validation:** Claude Haiku (Mode A) + OpenAI GPT-4o (Mode B)
- **Embeddings:** OpenAI text-embedding-3-small
- **Web Research:** Claude API web search (not Brave)

### Infrastructure
- **Containerization:** Docker + Docker Compose
- **Web Server:** Nginx (reverse proxy, SSL)
- **CI/CD:** GitHub Actions
- **Deployment:** Single VM (MVP) → Multi-server (scale)

---

## 🚀 Quick Start (Development)

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL 15+
- ChromaDB (Vector Database)
- Redis 7+
- Docker & Docker Compose (optional but recommended)

### Setup with Docker (Recommended)

```bash
# Clone repository
git clone <repo_url>
cd pursuit-response-platform

# Copy environment files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local

# Edit .env files with your API keys
# Required: ANTHROPIC_API_KEY, OPENAI_API_KEY

# Start all services
docker-compose up -d

# Run database migrations
docker-compose exec backend alembic upgrade head

# Access application
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000
# API Docs: http://localhost:8000/api/docs
```

### Setup without Docker

**Backend:**
```bash
cd backend
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Setup PostgreSQL and ChromaDB
createdb pursuit_db
psql pursuit_db -c "CREATE EXTENSION vector;"

# Run migrations
alembic upgrade head

# Start server
uvicorn app.main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

**Celery Worker:**
```bash
cd backend
celery -A app.tasks.celery_app worker --loglevel=info
```

---

## 📖 Key Documentation Sections

### For Product Managers
- **PRD.md** - Complete product requirements, user personas, success metrics
- **user-workflows.md** - Detailed user workflows with UI mockups
- **ALIGNMENT_SUMMARY.md** - Executive summary of technical decisions

### For Developers
- **technical-architecture.md** - Complete system architecture, design patterns
- **database-schema.md** - Database schema with SQLAlchemy models
- **api-specification.md** - All API endpoints with request/response examples

### For Stakeholders
- **PRD.md** - Executive Summary, Business Objectives, Success Metrics
- **ALIGNMENT_SUMMARY.md** - Technology decisions, cost estimates, timeline

---

## 🎯 MVP Scope (6-8 Weeks)

### In Scope ✅
- Pursuit creation (upload RFP or chat-based entry)
- AI-powered similarity search (vector embeddings)
- AI outline generation (7-agent pipeline with HITL)
- Iterative refinement (chat + direct edit)
- Document generation (.docx and .pptx)
- Review and approval workflow (min 2 reviewers)
- Quality tagging system
- Analytics dashboard with export
- Historical pursuit seeding via UI
- **Auto-save and resume functionality**
- **Additional reference document upload**

### Out of Scope (Post-MVP) ❌
- Role-based access control (all users equal in MVP)
- External integrations (CRM, email, SSO)
- Custom document templates
- Notifications and alerts
- Advanced compliance features
- Mobile and tablet support

---

## 🏛️ System Architecture Highlights

### Seven-Agent AI Pipeline with HITL
```
Agent 1: Metadata Extraction (~15-30s)
   ↓ [HITL Review]
Agent 2: Team Composition (~30-60s)
   ↓ [HITL Review]
Agent 3: Similar Pursuit Identification (~15-30s)
   ↓ [HITL Review]
Agent 4: Gap Analysis (~30s)
   ↓ [HITL Review]
Agent 5: Research - Web + Arxiv (~120s)
   ↓ [HITL Review]
Agent 6: Synthesis (~60-90s)
   ↓ [CRITICAL GATE: PM + PP Approval]
Agent 7: Document Generation (~30-60s)
   ↓ [Final Validation: GPT-4o]
Complete .pptx or .docx Output
```

**Total Pipeline: ~15 minutes** (excluding HITL review time)

### Data Flow
```
User → React Frontend → FastAPI → PostgreSQL
                    ↓
              Celery Worker → AI APIs → PostgreSQL
```

### Vector Similarity Search
```
RFP Text → OpenAI Embedding → ChromaDB Query → Weighted Ranking
                                              ↓
                                   Top 10 Similar Pursuits
```

---

## 📊 Database Schema Summary

### Core Tables (9)
1. **users** - User accounts and authentication
2. **pursuits** - Core pursuit records with metadata + embeddings
3. **pursuit_files** - Uploaded files (RFPs, documents)
4. **pursuit_references** - Links between pursuits
5. **quality_tags** - User-applied quality markers
6. **reviews** - Approval workflow records
7. **citations** - Source citations for AI content
8. **audit_logs** - Comprehensive audit trail
9. **pursuit_metrics** - Pre-aggregated analytics (optional)

**Total Storage (1 Year, 500 Pursuits):**
- Database: ~81 MB
- File Storage: ~30 GB
- **Total: ~30 GB**

---

## 🔒 Security Features

- ✅ JWT-based authentication (30-day expiry)
- ✅ Password hashing (bcrypt, cost factor 12)
- ✅ HTTPS/TLS everywhere
- ✅ CORS whitelist
- ✅ Rate limiting (per-IP, per-endpoint)
- ✅ Input validation (Pydantic schemas)
- ✅ SQL injection prevention (SQLAlchemy ORM)
- ✅ XSS prevention (React auto-escaping + CSP)
- ✅ Audit logging (all actions tracked)

---

## 📈 Performance Targets

| Metric | Target | Implementation |
|--------|--------|----------------|
| Page Load | < 2 seconds | React code splitting, Next.js optimization |
| API Response | < 500ms | FastAPI async, connection pooling |
| Search Results | < 30 seconds | ChromaDB HNSW index |
| AI Outline Gen | ~15 minutes | 7-agent pipeline with HITL |
| Document Gen | < 4 minutes | Background Celery task |

---

## 💰 Cost Estimate

### MVP (10 Users)
- **Infrastructure:** $20-30/month (Azure VM or AWS EC2)
- **AI APIs:** $10-15/month (Claude + OpenAI)
- **Total:** $30-45/month

### Post-MVP (50 Users)
- **Infrastructure:** $150-250/month (scaled VMs, RDS)
- **AI APIs:** $50-100/month
- **Total:** $200-350/month

---

## 🔄 Development Workflow

### Phase 1: Foundation (Week 1-2)
- [ ] Set up development environment
- [ ] Initialize project structure (frontend + backend)
- [ ] Configure Docker Compose
- [ ] Implement database schema
- [ ] Set up authentication

### Phase 2: Core Features (Week 3-4)
- [ ] Pursuit creation and file upload
- [ ] Vector similarity search
- [ ] 7-agent AI outline generation
- [ ] Basic outline editor

### Phase 3: Refinement (Week 5-6)
- [ ] Chat-based refinement
- [ ] Document generation (DOCX/PPTX)
- [ ] Review workflow
- [ ] Quality tagging

### Phase 4: Polish (Week 7-8)
- [ ] Analytics dashboard
- [ ] Auto-save and resume
- [ ] UI/UX refinements
- [ ] Testing and bug fixes
- [ ] Deployment preparation

---

## 📝 API Endpoints Summary

### Authentication
- `POST /api/v1/auth/login` - User login
- `GET /api/v1/auth/me` - Get current user

### Pursuits
- `POST /api/v1/pursuits` - Create pursuit
- `GET /api/v1/pursuits` - List pursuits
- `GET /api/v1/pursuits/{id}` - Get pursuit
- `PATCH /api/v1/pursuits/{id}` - Update pursuit
- `POST /api/v1/pursuits/{id}/files` - Upload files

### AI Generation
- `POST /api/v1/search/similar` - Find similar pursuits
- `POST /api/v1/pursuits/{id}/generate-outline` - Generate outline (async)
- `POST /api/v1/pursuits/{id}/refine-outline` - Refine via chat
- `GET /api/v1/tasks/{task_id}` - Get task status

### Reviews
- `POST /api/v1/pursuits/{id}/submit-for-review` - Submit for review
- `GET /api/v1/reviews/pending` - List pending reviews
- `POST /api/v1/reviews` - Submit review

### Analytics
- `GET /api/v1/analytics/dashboard` - Get dashboard metrics
- `POST /api/v1/analytics/export` - Export data

**Total: 30+ endpoints** - See `api-specification.md` for complete details

---

## 🧪 Testing Strategy

### Unit Tests
- Backend: pytest (60%+ coverage target)
- Frontend: Vitest + React Testing Library

### Integration Tests
- API endpoints: Supertest or httpx
- Database: Test fixtures with SQLAlchemy

### E2E Tests
- Critical paths: Playwright
- User workflows: Automated browser testing

### Manual Testing
- UI/UX validation
- AI output quality
- Cross-browser testing

---

## 🚀 Deployment

### Development
```bash
docker-compose up -d
```

### Production
- **Server:** Azure VM or AWS EC2 (t3.medium minimum)
- **Database:** PostgreSQL 15+
- **Vector Database:** ChromaDB
- **Web Server:** Nginx (reverse proxy, SSL)
- **SSL:** Let's Encrypt (free)
- **Process Management:** systemd
- **Monitoring:** Sentry.io (error tracking)

See `technical-architecture.md` Section 9 for complete deployment guide.

---

## 📞 Support & Contact

### Documentation Issues
- Review `CLAUDE.md` for current implementation status
- See session summaries in `logs/` for recent changes

### Technical Questions
- Backend: See `technical-architecture.md` + `api-specification.md`
- Database: See `database-schema.md`
- Frontend: See `technical-architecture.md` Section 4

### Project Management
- Requirements: See `PRD.md` + `system-requirements.md`
- User Workflows: See `user-workflows.md`

---

## 📜 License

[Specify License - e.g., MIT, Proprietary, etc.]

---

## 🎉 Ready for Development

All documentation is complete, aligned, and verified. The project is ready to move into the implementation phase.

**Next Step:** Initialize project structure and begin Phase 1 development.

---

**Document Version:** 1.2
**Last Updated:** 2025-12-02
**Status:** ✅ In Active Development
