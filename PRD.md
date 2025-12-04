# Product Requirements Document (PRD)
# Pursuit Response Platform

**Version:** 1.1
**Date:** 2025-12-02
**Status:** In Development
**Product Owner:** TBD
**Project Phase:** MVP Implementation

---

## Implementation Status

> **Note:** This PRD describes original requirements. The project is now in active development with:
> - 7-agent pipeline implemented (expanded from original 4-agent design)
> - Full HITL (Human-in-the-Loop) review system at each stage
> - Next.js frontend with complete Dashboard, Workflow UI, Gap Assessment, Deep Search, PPT Generation
> - FastAPI backend with memory system (short-term, long-term, episodic, edit tracking)
>
> **See `CLAUDE.md` for current implementation details and status.**

---

## Executive Summary

### Vision
Build a comprehensive pursuit response platform that enables professional services firms to rapidly and effectively respond to RFPs by leveraging AI-powered content generation, historical pursuit data, and collaborative workflows.

### Problem Statement
Professional services firms face significant challenges in pursuit response:
- **Time-Intensive:** Creating quality proposals from scratch is time-consuming (days to weeks)
- **Inconsistent Quality:** Responses vary in quality depending on who creates them
- **Lost Knowledge:** Past pursuit content and lessons learned are siloed or inaccessible
- **Manual Processes:** Heavy reliance on manual copy-paste from previous proposals
- **Limited Reuse:** Difficulty finding and reusing relevant content from past pursuits

### Solution Overview
The Pursuit Response Platform addresses these challenges through:
1. **AI-Powered Content Generation:** Automatically generate proposal outlines using Claude AI
2. **Semantic Search:** Find similar past pursuits using vector embeddings and metadata
3. **Collaborative Refinement:** Iteratively refine proposals through chat and direct editing
4. **Quality Tracking:** Tag high-quality content to improve future recommendations
5. **Review Workflow:** Multi-reviewer approval process ensures quality control
6. **Analytics Dashboard:** Track win rates, performance metrics, and trends

### Business Objectives
- **Reduce Time-to-Submit:** Cut proposal creation time by 50% (from days to hours)
- **Improve Win Rates:** Increase win rates by 10-15% through higher quality responses
- **Increase Reuse:** Enable 80%+ reuse of past pursuit content
- **Knowledge Capture:** Build searchable repository of all past pursuits
- **Quality Consistency:** Ensure consistent quality through review workflows

### Success Metrics (6 Months Post-Launch)
- **Adoption:** 100% of pursuits created through platform
- **Time Savings:** Average time-to-submit reduced from 5 days to 2 days
- **User Satisfaction:** > 8/10 satisfaction rating from users
- **Win Rate:** 5-10% improvement in win rate vs. historical baseline
- **Repository Growth:** 50+ historical pursuits searchable in database
- **AI Accuracy:** > 80% of AI-generated content requires minimal edits

### MVP Scope
**Timeline:** 6-8 weeks
**Users:** 10 users (single firm/team)
**Pursuit Volume:** 10 pursuits/week
**Focus:** Core workflows with simple permissions (all users equal access)

**MVP Includes:**
- Pursuit creation (upload RFP or chat-based entry)
- AI-powered similarity search
- AI outline generation with citations
- Iterative refinement (chat + direct edit)
- Document generation (.docx and .pptx)
- Review and approval workflow (min 2 reviewers)
- Quality tagging system
- Analytics dashboard with export
- Historical pursuit seeding via UI

**Post-MVP:**
- Role-based access control
- External integrations (CRM, email, SSO)
- Custom document templates
- Notifications and alerts
- Advanced compliance features
- Mobile and tablet support

---

## User Personas

### Persona 1: Pursuit Leader (Internal Pursuit Owner)

**Name:** Sarah Johnson
**Role:** Senior Manager, Business Development
**Age:** 35-45
**Experience:** 10+ years in consulting

**Background:**
- Manages 3-5 active pursuits at any time
- Responsible for coordinating pursuit responses from intake to submission
- Works with SMEs across practice areas
- Accountable for win rates and quality of submissions

**Goals:**
- Create high-quality pursuit responses quickly
- Find and reuse relevant content from past wins
- Coordinate with team members efficiently
- Track pursuit progress and deadlines
- Maintain consistency across proposals

**Pain Points:**
- Spending too much time searching for past content
- Manually copy-pasting from multiple documents
- Difficult to know which past pursuits are most relevant
- Losing track of pursuit status and reviews
- Inconsistent proposal quality

**Technical Proficiency:** Intermediate (comfortable with Word, PowerPoint, web apps)

**Usage Patterns:**
- Creates 2-3 new pursuits per week
- Spends 40% of time on pursuit creation
- Reviews 10+ past pursuits per new pursuit
- Primary platform user

**Success Criteria:**
- Can create initial draft in < 2 hours (vs. 1-2 days currently)
- Finds relevant past content in < 5 minutes
- Receives timely feedback from reviewers
- Has visibility into pursuit status at all times

---

### Persona 2: Subject Matter Expert (SME/Reviewer)

**Name:** Michael Chen
**Role:** Principal Consultant, Engineering Practice
**Age:** 40-50
**Experience:** 15+ years in technical consulting

**Background:**
- Technical expert providing input to pursuit responses
- Reviews 5-10 pursuits per month
- Contributes specialized content (case studies, technical approach)
- Limited time for pursuit activities (10-20% of workload)

**Goals:**
- Quickly review and approve quality proposals
- Provide specific technical feedback efficiently
- Ensure technical accuracy and feasibility
- Reuse own past content where relevant

**Pain Points:**
- Pursuit reviews interrupt billable work
- Difficult to assess quality quickly
- Unclear what specifically needs review
- Feedback doesn't always get incorporated
- Same questions answered repeatedly

**Technical Proficiency:** Advanced (comfortable with all tools)

**Usage Patterns:**
- Reviews 1-2 pursuits per week (15-30 min each)
- Occasionally searches repository for own past content
- Tags high-quality content when encountered
- Periodic user (spiky usage)

**Success Criteria:**
- Can complete review in < 15 minutes
- Clear visibility into what needs attention
- Confidence that feedback will be addressed
- Easy to approve or request specific changes

---

### Persona 3: Practice Leader (Stakeholder/Analyst)

**Name:** Jennifer Martinez
**Role:** Partner, Risk & Compliance Practice
**Age:** 45-55
**Experience:** 20+ years in professional services

**Background:**
- Oversees pursuit activities for practice area
- Accountable for practice win rates and growth
- Reviews monthly performance metrics
- Makes strategic decisions about pursuit prioritization

**Goals:**
- Understand win/loss trends and patterns
- Identify high-performing team members and content
- Make data-driven decisions about pursuits
- Optimize resource allocation

**Pain Points:**
- Limited visibility into pursuit pipeline
- Difficult to analyze win/loss patterns
- Can't identify what's working vs. not working
- No insight into pursuit quality metrics
- Manual compilation of reports

**Technical Proficiency:** Basic-Intermediate (comfortable with dashboards, Excel)

**Usage Patterns:**
- Reviews analytics dashboard weekly
- Exports data monthly for leadership reports
- Occasionally browses past pursuits
- Minimal direct pursuit creation

**Success Criteria:**
- Can access key metrics in < 1 minute
- Understands win rate trends by industry/service
- Identifies most valuable past pursuits
- Can export data for presentations

---

## System Overview and Architecture Principles

### High-Level Architecture

**Architecture Style:** Monolithic with modular design (MVP) → Microservices (future)

**Core Components:**
1. **Frontend Application** - React SPA for user interactions
2. **Backend API** - FastAPI REST API (Python)
3. **Database** - PostgreSQL (Relational Data)
4. **Vector Database** - ChromaDB (Semantic Search)
5. **AI Service** - Anthropic Claude API integration
6. **File Storage** - Local file system (MVP) → S3 (future)
7. **Job Queue** - Celery + Redis for async tasks

### Architecture Principles

**1. Simplicity First**
- Choose proven technologies over cutting-edge
- Monolithic architecture for MVP (easier to develop, deploy, debug)
- Minimize external dependencies and services
- Clear separation of concerns within monolith

**2. AI-First Design**
- AI capabilities central to user experience
- Transparent AI operations (show what AI is doing)
- Human-in-the-loop design (users refine AI output)
- Citeable sources for all AI-generated content

**3. Scalability Path**
- Design with future scale in mind
- Use abstractions that allow later service extraction
- Database optimized for growth (proper indexes)
- Stateless API design enables horizontal scaling

**4. Data-Driven**
- Capture all user actions for analytics
- Track pursuit metrics for continuous improvement
- Enable data export for external analysis
- Audit log for compliance and debugging

**5. User-Centric**
- Fast, responsive UI (< 2 second page loads)
- Clear feedback for all actions
- Progressive disclosure (show complexity when needed)
- Graceful error handling with helpful messages

**6. Security & Privacy**
- Authentication required for all features
- HTTPS everywhere
- Input validation and sanitization
- Audit logging for sensitive actions

### Technology Stack

**Frontend:**
- React 18 + TypeScript
- shadcn/ui + Tailwind CSS
- React Query (server state)
- Zustand (client state)
- Axios (HTTP client)

**Backend:**
- FastAPI (Python 3.11+)
- SQLAlchemy 2.x (async ORM)
- Celery (job queue)
- Custom Agent Orchestration (Direct API)
- LangChain + Anthropic (Claude integration)
- Pydantic (data validation)
- Uvicorn (ASGI server)
- structlog (logging)

**Database:**
- PostgreSQL 15+
- **Vector Database:** ChromaDB (Open Source)

**AI Services:**
- Anthropic Claude Sonnet 4.5 (primary)
- Anthropic Claude 3 Haiku (simple tasks)
- OpenAI embeddings (text-embedding-3-small)

**Infrastructure:**
- Docker + Docker Compose
- Azure VM (primary) or AWS EC2
- Azure Blob Storage (post-MVP)
- GitHub Actions (CI/CD)

**Estimated Monthly Cost:** $34-44 for MVP (10 users + AI services)
- *Note: Custom implementation avoids external framework licensing costs.*

---

## Detailed Module Requirements

### Module 1: Pursuit Creation & Intake

**Purpose:** Enable users to initiate new pursuit responses through multiple input methods.

**Key Features:**
1. Multiple intake methods (upload RFP, chat-based entry, upload requirements doc)
2. Automatic text extraction from documents (.pdf, .docx, .pptx)
3. AI-powered metadata extraction and auto-population
4. Metadata form with validation
5. **Optional proposal outline/framework specification**
6. **Auto-save and manual save at any point**
7. **Resume in-progress pursuits from dashboard**
8. Progress tracking throughout pursuit lifecycle

**User Workflows:**
1. User clicks "New Pursuit"
2. User selects intake method
3. User uploads files or enters requirements via chat
4. System extracts text and attempts metadata population
5. User reviews and completes metadata
6. **User optionally specifies proposal outline/framework (section structure)**
7. User saves pursuit and continues to search phase

**Acceptance Criteria:**
- ✅ User can upload up to 10 files (max 15MB each, .pdf/.docx/.pptx)
- ✅ System extracts text from all supported formats within 30 seconds
- ✅ Metadata form displays with required fields marked
- ✅ Auto-populated fields are highlighted for review
- ✅ **User can specify custom proposal outline/framework (optional, free-text or structured input)**
- ✅ **Outline/framework saved with pursuit metadata**
- ✅ User can save draft at any point
- ✅ Chat interface supports multi-turn conversation for requirements
- ✅ All required metadata validated before proceeding

**See detailed workflows:** `user-workflows.md` (Workflow 1: Pursuit Creation)

---

### Module 2: AI-Powered Search & Discovery

**Purpose:** Help users find similar past pursuits using semantic search and metadata filtering.

**Key Features:**
1. Semantic similarity search using vector embeddings
2. Weighted ranking algorithm (cosine similarity + metadata + quality + recency)
3. Search result explanations (why pursuit was recommended)
4. Manual search with advanced filters
5. Pursuit preview modal
6. Multi-select for reference pursuits

**User Workflows:**
1. System automatically triggers search after metadata completion
2. User sees "Searching..." indicator with progress
3. System displays 5-10 ranked results with similarity scores
4. User previews pursuits and selects relevant ones (0-10)
5. User can manually search for additional pursuits
6. User proceeds to outline generation

**Acceptance Criteria:**
- ✅ Search completes in < 30 seconds
- ✅ Returns 5-10 most similar pursuits (if available)
- ✅ Each result shows: entity name, industry, service types, technologies, status, fees, similarity score
- ✅ Similarity explanation provided ("Matched on: Industry, Service Type, 85% content similarity")
- ✅ User can preview full pursuit in modal
- ✅ Manual search supports filters: industry, service type, technology, status, date range, win status
- ✅ Graceful handling when no similar pursuits found

**See detailed workflows:** `user-workflows.md` (Workflow 2: Search & Discovery)

---

### Module 3: AI Outline Generation with Seven-Agent Architecture

**Purpose:** Generate comprehensive proposal outline using three specialized AI agents that analyze gaps, conduct targeted research, and synthesize content.

**Architecture:** Three Sequential Agents

#### **Agent 1: Metadata Extraction Agent**
- **Goal:** Extract structured data from unstructured RFP documents.
- **Input:** RFP Text.
- **Output:** JSON Metadata (Client, Industry, Tech Stack, etc.).

#### **Agent 2: Gap Analysis Agent**
**Responsibility:** Analyze requirements coverage and identify gaps

**Inputs:**
- RFP requirements text
- Selected past pursuits (0-10) with full content
- **Additional reference documents (0-10) uploaded by user**
- **Pursuit metadata (industry, service types, technologies, geography)**
- **Proposal outline/framework (optional - user-specified section structure)**

**Process:**
- Parse and structure RFP requirements (deliverables, evaluation criteria, key themes)
- **If user provided outline/framework:** Map requirements to specified sections
- Deep analysis of selected past pursuits
- **Analyze additional reference documents for relevant content**
- **Use metadata to understand context** (e.g., Healthcare + Engineering + Azure)
- Map past pursuit content + additional reference content to RFP requirements (coverage matrix)
- **If outline/framework provided:** Identify which sections need content vs. which are covered
- Identify gaps: requirements not addressed by past pursuits or additional references (or empty sections)
- Prioritize gaps by RFP emphasis and outline structure
- Generate targeted research queries for each gap
- **Reduce research queries for gaps already covered by additional references**
- **Tailor queries using metadata** (e.g., "Healthcare data migration best practices Azure", not generic "data migration")

**Output:** Gap Analysis Report
- Coverage matrix (requirement → source mapping)
- List of gaps with priority
- Targeted research queries with metadata context
- **Section-level gap analysis (if outline/framework provided)**
- Estimated confidence scores

**Duration:** ~30 seconds

---

#### **Agent 3: Web Research Agent**
**Responsibility:** Conduct targeted web research for identified gaps

**Inputs:**
- Gap Analysis Report (prioritized gaps + research queries)
- **Pursuit metadata for context filtering**

**Process:**
- Execute web searches using gap-specific queries
- **Filter results by metadata context:**
  - Industry-specific sources (e.g., healthcare publications for Healthcare pursuits)
  - Technology-specific documentation (e.g., Azure docs for Azure pursuits)
  - Service-specific best practices (e.g., Risk methodologies for Risk pursuits)
- Validate source relevance and credibility
- Extract key information addressing each gap
- Create citations with URLs and source titles
- **Prioritize sources that match metadata** (industry, capability, technology)

**Output:** Web Research Findings
- Research findings per gap
- Citations with URLs, titles, snippets
- Relevance scores
- Metadata match indicators

**Duration:** ~60 seconds

---

#### **Agent 4: Synthesis Agent**
**Responsibility:** Generate comprehensive outline combining all sources

**Inputs:**
- RFP requirements
- Past pursuits content
- **Additional reference documents content**
- Web research findings
- Gap Analysis Report
- **Pursuit metadata**
- **Proposal outline/framework (optional - user-specified section structure)**

**Process:**
- Synthesize content from all sources (past pursuits + additional references + web research)
- **If outline/framework provided:** Generate content following the specified section structure
- **If no outline provided:** Generate structure based on RFP requirements
- Add citations for all content (past pursuits + additional references + web sources)
- **Apply metadata context throughout:**
  - Use industry terminology (Healthcare vs. Financial Services)
  - Reference appropriate technologies (Azure vs. AWS)
  - Emphasize relevant service capabilities (Engineering, Risk, etc.)
- **Ensure all user-specified sections are populated** (if outline/framework provided)
- **NO HALLUCINATION - Critical Policy:**
  - **ONLY use information from past pursuits, additional reference documents, or web research**
  - **If no information available, mark as [GAP: Needs content]**
  - **Do NOT invent case studies, statistics, or capabilities**
  - **Include placeholder explaining what content is needed**
- Create initial conversation context
- Validate outline completeness

**Output:** Comprehensive Outline
- **5-8 major sections (or follows user's outline/framework structure)**
- Subtitles and bullets for each section
- Citations for all content (including additional reference citations)
- **Explicit [GAP] markers where information unavailable**
- Metadata-aware language and emphasis
- **Structured per user's framework if provided**

**Duration:** ~60-90 seconds

---

**User Workflows:**
1. User clicks "Generate Outline" after selecting reference pursuits (0-10)
2. System displays progress bar with three agent phases:
   - "Analyzing coverage gaps..." (Gap Analysis Agent - 30s)
   - "Conducting targeted research..." (Research Agent - 60s)
   - "Generating comprehensive outline..." (Synthesis Agent - 60-90s)
3. **[Optional] System shows gap summary:** "Found 5 gaps: X, Y, Z. Researching..."
4. Three agents execute sequentially
5. User redirected to Outline Editor with comprehensive outline

**Acceptance Criteria:**
- ✅ Total generation time ~15 minutes (7-agent pipeline with HITL, target < 7 min)
- ✅ **Gap Analysis Agent identifies all uncovered requirements**
- ✅ **Metadata used throughout gap analysis** (industry, services, technologies)
- ✅ **Research queries tailored with metadata context** (not generic)
- ✅ **Web research filtered by metadata relevance**
- ✅ Outline includes 5-8 major sections
- ✅ Each section has descriptive subtitle
- ✅ Each section has 3-5 bullet points
- ✅ **NO HALLUCINATION: All content sourced from past pursuits or web research**
- ✅ **Sections without available information marked as [GAP: Needs content]**
- ✅ **Gap markers include explanatory placeholder text**
- ✅ All non-gap content has source citations (past pursuits, web, or synthesized)
- ✅ Web citations include URL and source title
- ✅ **Synthesis uses metadata-appropriate terminology and emphasis**
- ✅ Citations clickable to view source
- ✅ Outline stored in structured JSON format
- ✅ Progress indicator shows current agent phase
- ✅ User can cancel at any time
- ✅ **Gap analysis summary visible to user** (what was missing, what was researched)
- ✅ **Gap report shows all [GAP] markers for user review**
- ✅ Each agent's output logged for debugging
- ✅ Graceful handling of agent failures (fallback to next agent)

**See detailed workflows:** `user-workflows.md` (Workflow 3-7: AI Outline Generation)

---

### Module 4: Outline Editor & Refinement

**Purpose:** Allow users to iteratively refine AI-generated outline through chat and direct edits.

**Key Features:**
1. Split-screen interface (outline editor + chat)
2. Direct inline editing of outline
3. Chat-based refinement with AI
4. Drag-and-drop reordering
5. Citation management
6. Auto-save functionality
7. Conversation history tracking
8. **Upload additional reference documents and regenerate**

**User Workflows:**
1. User views generated outline in left panel
2. User can directly edit any section/bullet
3. User can chat with AI to request changes
4. AI streams responses and updates outline
5. User can reorder sections/bullets via drag-and-drop
6. **User can upload additional reference documents:**
   - Click "Add Reference Documents" button
   - Upload .pdf, .docx, or .pptx files (max 15MB each)
   - System extracts text and displays confirmation
   - User clicks "Regenerate Outline with References"
   - All three agents re-execute with additional references
   - New outline merges with existing content (preserves user edits)
7. Changes auto-saved every 30 seconds
8. User can preview document at any time

**Acceptance Criteria:**
- ✅ Outline displays in tree structure with expand/collapse
- ✅ Inline editing enabled for all text fields
- ✅ Chat interface supports multi-turn conversation
- ✅ AI responses streamed in real-time
- ✅ Outline updates reflect immediately after AI response
- ✅ Citations preserved during edits
- ✅ Drag-and-drop reordering works smoothly
- ✅ **"Add Reference Documents" button accessible at all times**
- ✅ **Support upload of .pdf, .docx, .pptx files (max 15MB, max 10 files)**
- ✅ **Text extraction from additional references within 30 seconds**
- ✅ **"Regenerate Outline" button enabled after upload**
- ✅ **Regeneration preserves user edits while incorporating new content**
- ✅ **Additional reference citations included in outline**
- ✅ **User can remove references and regenerate**
- ✅ Auto-save occurs every 30 seconds
- ✅ User can manually save at any time
- ✅ Conversation history visible and scrollable
- ✅ Clear visual indicator when content is being generated

**See detailed workflows:** `user-workflows.md` (Workflow 8-11: Outline Editor & Refinement)

---

### Module 5: Document Generation

**Purpose:** Convert finalized outline into formatted Word or PowerPoint document.

**Key Features:**
1. Generate .docx from outline
2. Generate .pptx from outline
3. Document preview before finalization
4. Download and export functionality
5. Format-specific templates (basic)

**User Workflows:**
1. User clicks "Generate Document" from outline editor
2. System displays progress (3 phases)
3. System creates document in specified format
4. Document preview opens in modal
5. User can download or export for external editing
6. User can return to outline for further refinements

**Acceptance Criteria:**
- ✅ Generation completes in < 4 minutes
- ✅ DOCX format:
  - Headings use proper Word styles (Heading 1, 2, 3)
  - Subtitles formatted as italic
  - Bullets use list formatting
  - Citations as footnotes or endnotes
  - Table of contents generated
- ✅ PPTX format:
  - Each section = new slide
  - Subtitle becomes slide subtitle
  - Bullets populate slide body
  - Slide numbers added
  - Basic icons from public library
  - Title slide with entity name
- ✅ Preview displays document before download
- ✅ Download button provides file immediately
- ✅ Export option allows external editing with sync back (future)
- ✅ Progress indicator shows current phase

**See detailed workflows:** `user-workflows.md` (Workflow 12-13: Document Generation)

---

### Module 6: Review & Approval Workflow

**Purpose:** Manage multi-reviewer approval process before pursuit submission.

**Key Features:**
1. Submit pursuit for review
2. Review assignment (all users can review)
3. Review interface with feedback
4. Approval/changes requested workflow
5. Status tracking (minimum 2 approvals)
6. Final submission by internal owner

**User Workflows:**
1. Internal Pursuit Owner submits as "Draft"
2. Status changes to "in_review"
3. All users can see pending reviews
4. Reviewer opens pursuit detail
5. Reviewer examines outline and document
6. Reviewer submits approval or change requests
7. After 2+ approvals, status → "ready_for_submission"
8. Internal Pursuit Owner marks as "submitted"

**Acceptance Criteria:**
- ✅ "Submit for Review" button available when outline complete
- ✅ Status changes to "in_review" upon submission
- ✅ Pending reviews visible to all users
- ✅ Review interface shows: overview, outline, document, existing reviews
- ✅ Reviewer can approve or request changes
- ✅ Feedback required if requesting changes
- ✅ System tracks approval count
- ✅ Status automatically changes to "ready_for_submission" after 2 approvals
- ✅ Only Internal Pursuit Owner can mark as "submitted"
- ✅ All reviews logged in database

**See detailed workflows:** `user-workflows.md` (Workflow 14-15: Review & Approval)

---

### Module 7: Historical Pursuit Repository

**Purpose:** Maintain searchable repository of all past pursuits for reference and reuse.

**Key Features:**
1. Browse all past pursuits
2. Search with keyword and filters
3. View pursuit details (metadata, outline, document)
4. Quality tagging system
5. Bulk upload for seeding historical pursuits
6. Download documents

**User Workflows:**
1. User navigates to "Past Pursuits"
2. User sees grid/list of all pursuits
3. User can search by keyword or apply filters
4. User clicks pursuit to view details
5. User can download documents
6. User can add quality tags to completed pursuits

**Acceptance Criteria:**
- ✅ Repository displays all pursuits with status filters
- ✅ Grid and list view options
- ✅ Search by entity name, industry, requirements text
- ✅ Filters: industry, service type, technology, status, date range, win status, quality tagged
- ✅ Pursuit detail shows all metadata, outline, document preview
- ✅ Download button for generated documents
- ✅ Quality tagging available for completed pursuits (won/lost/submitted)
- ✅ Tags visible on pursuit cards (count)
- ✅ Bulk upload interface for seeding historical pursuits
- ✅ Auto-extraction of metadata from seeded files

**See detailed workflows:** `user-workflows.md` (Workflow 16-18: Repository Management)

---

### Module 8: Analytics & Reporting

**Purpose:** Provide insights into pursuit performance, trends, and team effectiveness.

**Key Features:**
1. Dashboard with key metrics
2. Win rate analysis (overall, by dimension)
3. Operational metrics (time to completion, active pursuits)
4. Usage metrics (most referenced, most tagged)
5. Filtering and date ranges
6. Data export (CSV/Excel)

**User Workflows:**
1. User navigates to "Analytics"
2. Dashboard displays key metrics cards
3. User applies filters (date range, industry, etc.)
4. Charts and tables update
5. User exports data for external analysis

**Acceptance Criteria:**
- ✅ Dashboard displays:
  - Win rate (overall and by industry/service/technology)
  - Total pursuits (all time, filtered period)
  - Active pursuits count
  - Average time to completion
  - Most referenced pursuits (top 10)
  - Most tagged pursuits (top 10)
- ✅ Filters: date range (presets + custom), industry, service type, technology, status
- ✅ Charts: win rate by industry (bar), pursuits over time (line), service type distribution (pie)
- ✅ Export button generates Excel with multiple sheets
- ✅ Export includes: pursuit list, industry breakdown, service type breakdown, reference analytics
- ✅ All metrics update in real-time when filters applied
- ✅ Individual and team views available

**See detailed workflows:** `user-workflows.md` (Workflow 19: Analytics & Reporting)

---

### Module 9: Save & Resume Workflow

**Purpose:** Enable users to save progress at any point and resume in-progress pursuits.

**Key Features:**
1. **Auto-save every 30 seconds** while user is working
2. **Manual save button** available at all stages
3. **Dashboard widget showing in-progress pursuits**
4. **Resume from last saved state**
5. **Progress tracking** showing completion percentage
6. **Session persistence** across browser sessions

**User Workflows:**

**Save Progress:**
1. User working on pursuit at any stage (metadata, outline, refinement)
2. System auto-saves every 30 seconds
3. User can click "Save Draft" button anytime
4. System saves current state to database
5. Success notification displayed
6. User can safely exit application

**Resume Progress:**
1. User logs into application
2. Dashboard displays "In Progress Pursuits" widget
3. Widget shows:
   - Pursuit name (entity name)
   - Current stage (e.g., "Refining Outline", "Ready for Review")
   - Progress percentage (e.g., 60% complete)
   - Last saved timestamp (e.g., "Saved 2 hours ago")
   - "Continue" button
4. User clicks "Continue" on pursuit
5. System loads pursuit and navigates to last stage:
   - If on metadata form → open metadata form
   - If on search → open search results
   - If on outline editing → open outline editor
   - If on document generation → show document preview
   - If on review → show review screen
6. User continues from where they left off

**Acceptance Criteria:**
- ✅ Auto-save triggers every 30 seconds of inactivity
- ✅ Manual "Save Draft" button available on all pursuit screens
- ✅ Save operation completes in < 2 seconds
- ✅ Success notification shown after save
- ✅ Dashboard "In Progress" widget shows all draft/in_review pursuits
- ✅ Each pursuit card shows:
  - Entity name
  - Current stage/status
  - Progress percentage
  - Last saved timestamp
  - Continue button
- ✅ Clicking "Continue" loads pursuit at correct stage
- ✅ All user input preserved (metadata, selections, outline edits, conversation)
- ✅ File uploads persisted
- ✅ AI-generated content preserved
- ✅ Citations and references maintained
- ✅ Works across browser sessions (after logout/login)
- ✅ No data loss if browser crashes or closes

**Progress Stages:**
- **10%** - RFP uploaded/requirements entered
- **20%** - Metadata completed
- **30%** - Similar pursuits searched
- **40%** - Reference pursuits selected
- **50%** - Outline generated
- **70%** - Outline refined and finalized
- **80%** - Document generated
- **90%** - Submitted for review
- **95%** - Reviews completed (awaiting final submission)
- **100%** - Submitted

**Technical Requirements:**
- Store current stage in pursuits.status or new field
- Save all transient data:
  - Form inputs (metadata)
  - Search results and selections
  - Outline JSON with all edits
  - Conversation history
  - Generated document reference
- Track last_modified timestamp
- Calculate progress percentage based on completed stages
- Implement optimistic locking to prevent concurrent edit conflicts

**See detailed workflows:** `user-workflows.md` (Save & Resume functionality throughout)

---

## Data Model Requirements

### Core Entities

**1. users**
- User accounts and authentication
- Fields: id, email, name, password_hash, created_at, updated_at, last_login_at, is_active

**2. pursuits**
- Core pursuit entity with all metadata
- Fields: id, entity_name, client contacts, internal owner, industry, service_types, technologies, geography, due_date, estimated_fees, status, requirements_text, outline_json, conversation_history, embedding, timestamps
- Status values: draft, in_review, ready_for_submission, submitted, won, lost, cancelled, stale

**3. pursuit_files**
- Stores uploaded files and generated documents
- Fields: id, pursuit_id (FK), file_name, file_type, file_path, file_size_bytes, mime_type, extracted_text, uploaded_at
- File types: rfp, rfp_appendix, output_docx, output_pptx, seed

**4. pursuit_references**
- Tracks which past pursuits were referenced
- Fields: id, pursuit_id (FK), referenced_pursuit_id (FK), selected_by_ai, similarity_score, selection_reason, selected_at

**5. quality_tags**
- User-applied quality markers
- Fields: id, pursuit_id (FK), tagged_by_user_id (FK), tag_type, section_reference, notes, created_at
- Tag types: high_quality, exemplary, good_approach, well_written, effective

**6. reviews**
- Review and approval tracking
- Fields: id, pursuit_id (FK), reviewer_id (FK), status, feedback, reviewed_at, created_at
- Status values: pending, approved, changes_requested

**7. citations**
- Source citations for generated content
- Fields: id, pursuit_id (FK), source_pursuit_id (FK), section_reference, content_snippet, source_type, source_details (JSONB), created_at
- Source types: past_pursuit, deep_research, user_provided, external

**8. pursuit_metrics**
- Pre-aggregated analytics data
- Fields: id, metric_date, dimension_type, dimension_value, total_pursuits, won_count, lost_count, win_rate, avg_time_to_completion, avg_estimated_fees, computed_at

**9. audit_log**
- Audit trail for all significant actions
- Fields: id, user_id (FK), pursuit_id (FK), action, entity_type, entity_id, details (JSONB), ip_address, user_agent, created_at

### Relationships

```
users (1) → (N) pursuits [internal_pursuit_owner_id]
pursuits (1) → (N) pursuit_files
pursuits (1) → (N) reviews
pursuits (1) → (N) quality_tags
pursuits (1) → (N) citations
pursuits (1) → (N) pursuit_references [as pursuit_id]
pursuits (1) → (N) pursuit_references [as referenced_pursuit_id]
users (1) → (N) reviews [reviewer_id]
users (1) → (N) quality_tags [tagged_by_user_id]
pursuits (1) → (N) citations [source_pursuit_id]
```

**See comprehensive details:** `database-schema.md`

---

## Integration Requirements

### Internal Module Interactions

**Pursuit Creation → Search & Discovery**
- Output: pursuit_id, requirements_text, metadata
- Trigger: User completes metadata and clicks "Continue to Search"
- Process: Search module generates embedding and performs similarity search

**Search & Discovery → Outline Generation**
- Output: pursuit_id, selected reference pursuit_ids (0-10)
- Trigger: User selects references and clicks "Generate Outline"
- Process: Outline generation retrieves full text of selected pursuits and RFP

**Outline Generation → Outline Editor**
- Output: pursuit_id, outline_json, citations, initial conversation
- Trigger: Generation completes
- Process: Editor loads outline and conversation for refinement

**Outline Editor → Document Generation**
- Output: pursuit_id, finalized outline_json
- Trigger: User clicks "Generate Document"
- Process: Document generation converts outline to .docx or .pptx

**Document Generation → Review Workflow**
- Output: pursuit_id, generated_document_file_id
- Trigger: User clicks "Submit for Review"
- Process: Review workflow creates review tasks and changes status

**Review Workflow → Repository**
- Output: pursuit_id, final status (submitted/won/lost)
- Trigger: Internal owner marks as submitted
- Process: Repository makes pursuit searchable for future references

**Repository → Search & Discovery**
- Output: All completed pursuits with embeddings
- Trigger: Any new pursuit search
- Process: Search queries repository for similar pursuits

**All Modules → Analytics**
- Output: Events, state changes, timestamps
- Trigger: Continuous
- Process: Analytics aggregates data for dashboards

### External Service Integrations

**Anthropic Claude API**
- Used by: Outline Generation, Outline Editor (refinement)
- Purpose: AI content generation and refinement
- Authentication: API key in environment variables
- Rate Limiting: Handle 429 responses gracefully
- Error Handling: Retry with exponential backoff

**OpenAI Embeddings API**
- Used by: Search & Discovery, Repository (seeding)
- Purpose: Generate vector embeddings for semantic search
- Authentication: API key in environment variables
- Model: text-embedding-3-small (1536 dimensions)

**PostgreSQL**
- Used by: All modules
- Purpose: Primary data store
- Connection: Connection pooling via SQLAlchemy async

**ChromaDB**
- Used by: Search & Discovery, Repository
- Purpose: Vector embeddings and semantic search
- Connection: HTTP API (or native client)

---

## Non-Functional Requirements

### Security Requirements

**Authentication & Authorization**
- ✅ All features require authentication
- ✅ JWT-based session management
- ✅ Secure password hashing (bcrypt, cost factor 12)
- ✅ HTTP-only cookies for token storage
- ✅ JWT token expiry after 30 days
- ❌ MVP: No role-based access control (all users equal)
- ✅ Post-MVP: Implement RBAC with roles (admin, owner, reviewer, viewer)

**Data Protection**
- ✅ HTTPS/TLS for all connections
- ✅ Database encryption at rest
- ✅ Secure API key storage (environment variables)
- ✅ Input validation and sanitization
- ✅ SQL injection prevention (parameterized queries)
- ✅ XSS prevention (React auto-escaping + CSP headers)

**File Upload Security**
- ✅ File type validation (whitelist: .pdf, .docx, .pptx)
- ✅ File size limits (15 MB per file)
- ✅ Filename sanitization
- ❌ MVP: No virus scanning
- ✅ Post-MVP: Integrate virus scanning (ClamAV or cloud service)

**API Security**
- ✅ Rate limiting (express-rate-limit)
- ✅ CORS configuration (whitelist origins)
- ✅ Security headers (Helmet.js)
- ✅ Request size limits
- ✅ API versioning (/api/v1)
- ⚠️ **CRITICAL GAP**: CSRF protection needed (implement csurf middleware before production)
- ⚠️ **CRITICAL GAP**: SSRF protection for Research Agent (URL validation before web fetches)

**Audit & Compliance**
- ✅ Audit log for all significant actions
- ✅ Track user actions (create, update, delete, status changes)
- ✅ IP address and user agent logging
- ❌ MVP: No compliance certifications (SOC2, ISO)
- ✅ Post-MVP: SOC2 Type II certification

**Security Assessment**
- 📄 **See:** `technical-architecture.md` Section 8 for security architecture
- 🔴 **2 Critical Gaps** identified: CSRF protection, SSRF protection
- 🟡 **6 High Priority** items before production scale
- ✅ **Overall Assessment**: GOOD for MVP with trusted user base

### Performance Requirements

**Response Times**
- ✅ Page load time: < 2 seconds (first contentful paint)
- ✅ API response time: < 500ms (95th percentile)
- ✅ Search results: < 30 seconds
- ✅ AI outline generation: ~15 min actual (target < 7 min)
- ✅ Document generation: ~6-7 min actual (target < 4 min)
- ✅ UI interactions: < 200ms feedback

**Throughput**
- ✅ Support 10 concurrent users (MVP)
- ✅ Handle 10 pursuits/week
- ✅ Process 100 file uploads/day
- ✅ Scale to 50 concurrent users (post-MVP)

**Database Performance**
- ✅ Query response time: < 100ms for indexed queries
- ✅ Vector search: < 5 seconds for similarity queries
- ✅ Connection pooling: 10-20 connections
- ✅ Regular VACUUM and ANALYZE

**Caching Strategy**
- ✅ API response caching (15 min TTL for searches)
- ✅ Static asset caching (1 year)
- ✅ Browser caching (ETags)
- ✅ Optional Redis for session and job queue

### Scalability Requirements

**MVP (10 Users)**
- Single EC2 instance (t3.medium: 2 vCPU, 4 GB RAM)
- PostgreSQL on same instance
- Local file storage (up to 5 GB)
- Estimated cost: $30-40/month
- *Agents run within existing infrastructure (no additional compute cost)*

**Post-MVP (50-100 Users)**
- Vertical scaling: Upgrade to t3.large/xlarge
- Horizontal scaling: Load balancer + multiple backend instances
- Separate database server (RDS or managed PostgreSQL)
- S3 for file storage
- Redis for caching and job queue
- Estimated cost: $200-400/month

**Growth Path (100+ Users)**
- Microservices architecture (extract AI service, search service)
- Dedicated vector database (Pinecone, Weaviate)
- CDN for static assets
- Auto-scaling groups
- Multi-region deployment (future)

### Reliability Requirements

**Uptime**
- ✅ Target: 99% uptime (MVP)
- ✅ Target: 99.9% uptime (post-MVP)
- ✅ Planned maintenance windows: weekends, off-hours

**Backup & Recovery**
- ✅ Daily automated database backups (pg_dump)
- ✅ 30-day backup retention
- ✅ Backup storage: S3 or equivalent
- ✅ Monthly backup restore tests
- ✅ RTO (Recovery Time Objective): 4 hours
- ✅ RPO (Recovery Point Objective): 24 hours

**Error Handling**
- ✅ Graceful degradation (if AI unavailable, allow manual entry)
- ✅ User-friendly error messages
- ✅ Automatic retries with exponential backoff
- ✅ Error tracking (Sentry.io free tier)
- ✅ Detailed logging (Winston)

**Monitoring**
- ✅ Application logs (Winston to files)
- ✅ Basic server metrics (CPU, memory, disk)
- ✅ Uptime monitoring (UptimeRobot or similar)
- ✅ Post-MVP: APM tool (New Relic, Datadog)

### Usability Requirements

**Ease of Use**
- ✅ Intuitive navigation (< 3 clicks to any feature)
- ✅ Clear labels and instructions
- ✅ Helpful tooltips and hints
- ✅ Consistent UI patterns
- ✅ Progressive disclosure (hide complexity)

**Accessibility**
- ✅ MVP: Basic accessibility
  - Semantic HTML
  - Keyboard navigation
  - Alt text for images
  - ARIA labels
  - WCAG AA color contrast
- ✅ Post-MVP: Full WCAG 2.1 AA compliance
  - Screen reader testing
  - Focus management
  - Accessibility audit

**Browser Support**
- ✅ Chrome 100+ (primary)
- ✅ Firefox 100+
- ✅ Safari 15+
- ✅ Edge 100+
- ❌ No IE11 support

**Responsive Design**
- ✅ MVP: Desktop only (≥ 1280px)
- ✅ Post-MVP: Tablet (768px+) and mobile (320px+)

### Maintainability Requirements

**Code Quality**
- ✅ TypeScript for type safety
- ✅ ESLint + Prettier for code formatting
- ✅ Clear naming conventions
- ✅ Modular architecture
- ✅ Code review required for all PRs

**Testing**
- ✅ Unit tests (Jest) - Target: 60%+ coverage
- ✅ Integration tests (Supertest) - API endpoints
- ✅ E2E tests (Playwright) - Critical paths
- ✅ Manual testing for UI/UX

**Documentation**
- ✅ README with setup instructions
- ✅ API documentation (OpenAPI/Swagger)
- ✅ Database schema documentation
- ✅ Architecture decision records (ADRs)
- ✅ User guide (post-MVP)

**Deployment**
- ✅ CI/CD pipeline (GitHub Actions)
- ✅ Automated builds and tests
- ✅ Docker containerization
- ✅ Infrastructure as code (Docker Compose)
- ✅ Zero-downtime deployments (post-MVP)

---

## Success Metrics

### User Adoption Metrics

**MVP (3 Months Post-Launch)**
- ✅ 100% of new pursuits created through platform
- ✅ 80%+ of users actively using platform weekly
- ✅ 50+ historical pursuits seeded in repository
- ✅ Average 3+ past pursuits referenced per new pursuit

**Post-MVP (6 Months)**
- ✅ 100% user adoption maintained
- ✅ 100+ historical pursuits in repository
- ✅ 90%+ user satisfaction score (NPS > 50)

### Efficiency Metrics

**Time Savings**
- ✅ Baseline: 5 days average time-to-submit (pre-platform)
- ✅ MVP Target: 2.5 days (50% reduction)
- ✅ Post-MVP Target: 2 days (60% reduction)

**AI Performance**
- ✅ Search accuracy: 80%+ of recommended pursuits marked as relevant
- ✅ Outline quality: 80%+ of AI-generated content requires minimal edits
- ✅ Citation accuracy: 95%+ of citations correctly attributed

### Quality Metrics

**Win Rate Improvement**
- ✅ Baseline: Current firm win rate (e.g., 35%)
- ✅ MVP Target: +5% improvement (40%)
- ✅ Post-MVP Target: +10-15% improvement (45-50%)

**Review Efficiency**
- ✅ Average review time: < 15 minutes per reviewer
- ✅ Time to approval: < 1 day (from submit to ready_for_submission)
- ✅ Revision cycles: < 2 on average

### Business Impact Metrics

**Cost Savings**
- ✅ Reduced labor hours per pursuit (50% time savings)
- ✅ Improved win rate → more revenue
- ✅ ROI: Positive within 6 months

**Knowledge Capture**
- ✅ 100% of submitted pursuits in searchable repository
- ✅ 50%+ of pursuits quality-tagged by users
- ✅ High-quality content reused in 5+ subsequent pursuits

### Technical Performance Metrics

**System Performance**
- ✅ 99% uptime
- ✅ < 2 second page load time (95th percentile)
- ✅ < 30 second search time (95th percentile)
- ✅ < 7 minute outline generation target (actual ~15 min, needs optimization)

**AI Costs**
- ✅ Average AI API cost per pursuit: < $5
- ✅ Total monthly AI costs: < $200 (for 40 pursuits/month)
- *Custom agent framework has no cost impact*
- *Costs remain based on Claude API usage and embeddings only*

---

## Risks & Mitigations

### Risk: AI-Generated Content Quality

**Impact:** High - Poor quality output reduces user trust and adoption
**Likelihood:** Medium

**Mitigation:**
- Use prompt engineering best practices
- Include reference pursuits for context
- Human-in-the-loop design (users refine output)
- Collect user feedback on AI quality
- Continuously improve prompts based on feedback

### Risk: AI API Costs Higher Than Expected

**Impact:** Medium - Could impact project budget
**Likelihood:** Medium

**Mitigation:**
- Use prompt caching to reduce costs
- Use cheaper model (Haiku) for simple tasks
- Monitor API usage closely
- Set budget alerts
- Implement rate limiting if needed

### Risk: User Adoption Below Target

**Impact:** High - Platform value depends on usage
**Likelihood:** Low

**Mitigation:**
- Involve users in requirements and design
- Comprehensive training and onboarding
- Clear value proposition (time savings)
- Executive sponsorship
- Regular user feedback sessions

### Risk: Data Privacy Concerns

**Impact:** High - Could block adoption
**Likelihood:** Low (MVP with single firm)

**Mitigation:**
- Clear data handling policies
- Audit logging for transparency
- Encryption at rest and in transit
- Compliance roadmap for post-MVP
- Regular security reviews

### Risk: Scalability Issues

**Impact:** Medium - Could impact performance
**Likelihood:** Low (MVP scope is small)

**Mitigation:**
- Database performance monitoring
- Load testing before launch
- Clear scaling path documented
- Proper indexing from day 1
- Caching strategy in place

---

## Appendices

### Appendix A: Glossary

- **Pursuit:** A potential project/engagement with a client, typically initiated by an RFP
- **RFP:** Request for Proposal - formal document from client soliciting proposals
- **Internal Pursuit Owner:** Firm employee responsible for coordinating pursuit response
- **SME:** Subject Matter Expert - technical expert providing specialized input
- **Outline:** Structured draft of proposal with sections, bullets, and citations
- **Citation:** Source reference for AI-generated content
- **Quality Tag:** User-applied marker indicating high-quality content
- **Vector Embedding:** Numerical representation of text for semantic similarity
- **Semantic Search:** Search based on meaning/context, not just keywords

### Appendix B: References

**Related Documents:**
- `system-requirements.md` - Detailed system requirements
- `technical-architecture.md` - Technical architecture and deployment
- `api-specification.md` - Complete REST API specification
- `database-schema.md` - Database schema implementation details
- `user-workflows.md` - Detailed user workflows and UI mockups
- `CLAUDE.md` - Claude Code project instructions and current status

**External References:**
- Anthropic Claude API Documentation
- OpenAI Embeddings API Documentation
- ChromaDB Documentation
- React Documentation
- TypeScript Documentation

### Appendix C: Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-11-04 | Requirements Team | Initial PRD |

---

## Approval

**Prepared By:** Requirements Team
**Date:** 2025-11-04
**Status:** Ready for Stakeholder Review

**Approvals Required:**
- [ ] Product Owner
- [ ] Technical Lead
- [ ] Practice Leader(s)
- [ ] User Representatives

---

**Next Steps:**
1. Stakeholder review and approval
2. Development planning and estimation
3. Sprint planning for MVP
4. Project kickoff
