# System Requirements - Pursuit Response Platform

## Project Overview
**System Name:** Pursuit Response Platform
**Purpose:** Platform for professional services firms to rapidly generate and respond to pursuits (RFPs)
**Target Users:** Professional services firms (primarily consulting)
**Current Phase:** Requirements Gathering (Greenfield MVP)

---

## 1. Core System Capabilities

### 1.1 Pursuit Creation Process
The system supports three methods for initiating a pursuit response:
1. Upload RFP document(s)
2. Upload file with written requirements
3. Use chat interface to prompt/refine requirements

### 1.2 Main Workflow Phases
1. **Intake Phase**
   - User uploads RFP or enters requirements via chat
   - System extracts text and attempts auto-population of metadata
   - User supplements/corrects metadata fields
   - User selects and customizes predefined slides outline (headings, titles, sub-titles)

2. **Discovery Phase**
   - AI searches database for 5-10 similar past pursuits
   - Results ranked by weighted scoring algorithm
   - User reviews recommendations and selects relevant examples
   - **User can upload additional reference documents at any time**

3. **Gap Assessment Phase**
   - System analyzes selected past pursuits against current requirements
   - Identifies missing information (gaps) where past pursuits do not cover requirements
   - Highlights areas needing fresh research or additional user input

4. **Generation Phase**
   - AI conducts deep research on selected past pursuits
   - System generates outline with headings, bullet points, and subtitles
   - User can see sources/citations for all information
   - **User can upload additional reference documents and regenerate**

5. **Refinement Phase**
   - User iteratively refines outline via prompts or direct edits
   - Conversation history maintained
   - Citations preserved throughout refinement
   - **User can upload additional reference documents and regenerate outline**

6. **Compilation Phase**
   - System generates .docx or .pptx from finalized outline
   - User can preview before finalizing
   - User can export to make external edits OR return to outline for updates

7. **Review & Approval Phase**
   - Internal Pursuit Owner submits as "DRAFT"
   - Minimum 2 reviewers must review and approve
   - Reviewers can provide feedback before approval

8. **Submission Phase**
   - After approvals, pursuit marked as "SUBMITTED"
   - All artifacts stored (final document, outline, conversation history, selected source pursuits)

### 1.3 Save & Resume Capability

**Auto-Save:**
- System auto-saves pursuit progress every 30 seconds of user inactivity
- Saves all transient data: form inputs, selections, outline edits, conversation history
- No user action required
- Success notification displayed ("Draft saved")
- Background operation, doesn't block user

**Manual Save:**
- "Save Draft" button available on all pursuit screens
- User can save progress at any point
- Saves immediately (< 2 seconds)
- Success notification displayed
- Allows user to safely exit application

**Resume from Dashboard:**
- Dashboard displays "In Progress Pursuits" widget
- Shows all pursuits with status: draft, in_review
- Each pursuit card displays:
  - Entity name
  - Current stage (e.g., "Refining Outline", "Ready for Review")
  - Progress percentage (10%-100%)
  - Last saved timestamp (e.g., "Saved 2 hours ago")
  - "Continue" button
- Clicking "Continue" navigates to last active stage
- All user data restored exactly as left

**Progress Tracking:**
- System tracks pursuit completion percentage
- Progress stages:
  - 10% - RFP uploaded/requirements entered
  - 20% - Metadata completed
  - 30% - Similar pursuits searched
  - 40% - Reference pursuits selected
  - 50% - Outline generated
  - 70% - Outline refined and finalized
  - 80% - Document generated
  - 90% - Submitted for review
  - 95% - Reviews completed
  - 100% - Submitted
- Progress bar displayed on pursuit cards and detail screens

**Session Persistence:**
- Works across browser sessions (after logout/login)
- No data loss if browser crashes or closes
- Pursuit state persisted in database
- User can switch devices and continue

**Concurrent Edit Prevention:**
- Warn user if pursuit opened in multiple tabs/sessions
- Implement optimistic locking to prevent conflicts
- Last save wins (with warning if conflict detected)

---

## 2. Metadata Requirements

### 2.1 Required Metadata Fields
- **Entity Name** (Client organization)
- **Client Pursuit Owner** (Name)
- **Client Pursuit Owner Email**
- **Internal Pursuit Owner** (Name)
- **Internal Pursuit Owner Email**
- **Industry** (Healthcare, Financial Services, Manufacturing, etc.)
- **Expected Pursuit Format** (.pptx or .docx)
- **Service Type** (Engineering, Risk, Project Management, Transformation, Data)

### 2.2 Optional Metadata Fields
- **Geography** (Region/country)
- **Submission Due Date**
- **Estimated Fees**
- **Technology** (Multi-select: Microsoft Azure, AWS, M365 Copilot, ServiceNow, Workday, etc.)
- **Proposal Outline/Framework** (User-specified section structure for the proposal)
  - Purpose: Define the desired structure/framework for the proposal response
  - Format: Ordered list of section headings
  - Example outline:
    - Title Page
    - Table of Contents
    - We Understand the Ask/Requirements
    - We Have the Capabilities and Credentials to Deliver
    - Our Approach Overview
    - Detailed Delivery Approach
    - Our Delivery Accelerators
    - Delivery Team Structure
    - Proposed Professional Fees
    - Our Qualifications
    - Delivery Team Profiles
  - Usage: Fed into Gap Analysis, Research, and Synthesis agents to structure the proposal
  - Default: If not specified, agents generate structure based on RFP requirements

### 2.3 System-Generated Metadata
- **Status** (Draft, In Review, Ready for Submission, Submitted, Won, Lost, Cancelled, Stale)
- **Team Members Involved**
- **Services Proposed**
- **Creation Date**
- **Last Modified Date**
- **Submitted Date**

### 2.4 Metadata Extraction
- System should attempt automatic extraction from uploaded RFP documents
- Users can manually update/correct all metadata fields
- Technology field supports multi-select

---

## 3. Historical Pursuit Repository

### 3.1 Storage Requirements
For each past pursuit, store:
- Full document content (entire .docx or .pptx)
- All metadata fields (required + optional + system-generated)
- Win/loss status
- Quality tags (user-applied)

### 3.2 Quality Tagging System
- After pursuit marked as Won/Lost/Cancelled/Stale, users can tag content
- Tags can apply to entire presentation or specific sections
- Tags influence ranking in future searches
- Any user with repository access can apply tags

### 3.3 Search Display Information
When AI returns similar pursuits, display:
- Client name (Entity Name)
- Industry
- Service Type(s)
- Technology
- Win/loss status
- Similarity score/explanation
- Date submitted
- Estimated Fees
- Key sections available
- Quality tags

### 3.4 Confidentiality
- MVP assumes no confidential client information restrictions
- All users have access to all past pursuits

---

## 4. AI Capabilities

### 4.1 Document Processing
- Extract full text from uploaded RFPs (.pdf, .docx, .pptx)
- Parse and identify key sections (Scope of Work, Evaluation Criteria, etc.)
- Extract specific requirements and questions
- Auto-populate metadata fields where possible

### 4.2 Semantic Search & Matching
- Search past pursuits using vector embeddings
- Ranking algorithm with weighted scoring based on:
  - Exact metadata matches (Industry, Service Type, Technology)
  - Semantic similarity of RFP requirements text
  - "High quality" user tags
   - Win status (prioritize won pursuits)
   - Recency (newer pursuits ranked higher)
- Return 5-10 most similar pursuits
- Provide explanation for why each pursuit was recommended

### Module 3: AI Outline Generation with Seven-Agent Architecture

**Note:** This document describes original requirements. The implemented system uses a 7-agent pipeline with HITL review gates. See `CLAUDE.md` for current implementation details.

**Agent-Based Workflow (Updated):**

**Agent 1: Metadata Extraction Agent (~15-30 seconds)**
- **Role:** Extracts structured metadata from RFP documents
- **Model:** Claude Sonnet 4.5
- **HITL:** Human review and correction of extracted metadata

**Agent 2: Team Composition Agent (~30-60 seconds)**
- **Role:** Recommends team composition based on pursuit requirements
- **Model:** Claude Sonnet 4.5
- **Features:** Candidate matching, availability calculation
- **HITL:** Human selection and override of team recommendations

**Agent 3: Similar Pursuit Identification Agent (~15-30 seconds)**
- **Role:** Finds relevant past pursuits using vector similarity + weighted scoring
- **Model:** Claude Sonnet 4.5
- **Features:** Granular content selection (slides/sections)
- **HITL:** Human selection of which content to include

**Agent 4: Gap Analysis Agent (~30 seconds)**
- **Inputs:** RFP requirements + selected past pursuits + additional reference documents + pursuit metadata + proposal outline/framework (optional)
- **Process:**
  - Parse RFP requirements (deliverables, evaluation criteria, themes)
  - Map past pursuit content to RFP requirements (coverage matrix)
  - Identify gaps (uncovered requirements or sections)
  - Generate metadata-aware research queries
- **Output:** Gap Analysis Report (coverage matrix, gaps list, targeted queries)
- **HITL:** Human review and prioritization of gaps

**Agent 5: Research Agent (~120 seconds)**
- **Role:** Web + Arxiv research for identified gaps
- **Model:** Claude Sonnet 4.5
- **Features:** Claude API web search (not Brave), Arxiv MCP integration
- **HITL:** Human review and selection of research findings

**Agent 6: Synthesis Agent (~60-90 seconds)**
- **Inputs:** All previous outputs + research findings
- **Process:** Synthesize outline with citations from all sources
- **NO HALLUCINATION POLICY:** Mark unknown content as `[GAP: Needs content]`
- **HITL:** Direct editing, chatbot refinement, upload new references
- **CRITICAL GATE:** Both PM and PP must approve before document generation

**Agent 7: Document Generation Agent (~30-60 seconds)**
- **Role:** Generate final .pptx or .docx from approved outline
- **Features:** Claude Agent Skills for document formatting
- **HITL:** Final review before delivery

**Validation Agents:**
- **Mode A (Claude Haiku):** Stage-level validation before/after HITL
- **Mode B (GPT-4o):** Comprehensive final validation

**Total Pipeline: ~15 minutes** (excluding HITL review time)

### 4.4 No-Hallucination Policy

**Critical Requirement:** The AI agents must NOT generate fictional or speculative content.

**Strict Rules:**
1. **Source-Based Content Only:**
   - All content must come from past pursuits OR web research findings
   - No invention of case studies, client names, statistics, or methodologies
   - No speculative statements about capabilities or experience

2. **Explicit Gap Marking:**
   - When no information is available for a requirement or section, mark as: **[GAP: Needs content]**
   - Include explanatory placeholder text:
     - "No information available from past pursuits or research"
     - "Requires SME input for: [specific topic]"
     - "Need to add: [description of missing content]"

3. **Gap Marker Format:**
   ```
   Section: Our Healthcare Experience
   - [GAP: No healthcare case studies found in past pursuits]
   - [GAP: Requires input on: Healthcare data migration projects completed]
   - [GAP: Need specific client examples with outcomes]
   ```

4. **User Visibility:**
   - Gap markers displayed prominently in outline editor
   - User can identify missing content before document generation
   - Refinement prompts can request specific information to fill gaps

5. **Validation:**
   - Synthesis Agent validates that all content has citations
   - Content without citations flagged for review
   - Gap report generated showing all placeholder sections

**Rationale:** Prevents AI from fabricating credentials, experience, or capabilities that could damage credibility or create legal/ethical issues in RFP responses.

### 4.5 Additional Reference Documents

**Capability:** Users can upload additional reference documents at any point in the workflow to enhance content generation.

**When Available:**
- During Discovery Phase (before selecting past pursuits)
- During Generation Phase (before or after outline generation)
- During Refinement Phase (while editing outline)

**Upload Process:**
1. User clicks "Add Reference Documents" button (available on all workflow screens)
2. User uploads files (.pdf, .docx, .pptx) - max 15MB per file
3. System extracts text from uploaded documents
4. Documents stored as "additional_reference" type associated with pursuit
5. User provided with option to "Regenerate with New References"

**Regeneration Behavior:**
- **If regenerating outline:** All three agents re-execute with additional references included
  - Gap Analysis Agent: Analyzes additional references for requirement coverage
  - Research Agent: May skip web research if additional references fill gaps
  - Synthesis Agent: Incorporates content from additional references with citations
- **Citation Format:** Additional references cited as "Reference Document: {filename}, Page {page}"
- **Incremental Updates:** New content merged with existing outline (preserves user edits)
- **Conversation History:** Regeneration logged as system action in conversation

**Use Cases:**
- User realizes specific case study document exists after initial generation
- Gap report identifies missing content that user has in internal documents
- User wants to ground response in specific methodologies from company documentation
- Reviewer suggests adding content from specific past proposal
- User finds relevant white papers or reports to strengthen response

**Supported File Types:**
- .pdf (up to 75 pages)
- .docx (up to 75 pages)
- .pptx (up to 75 slides)
- Text extraction with OCR fallback for scanned documents

**Constraints:**
- Maximum 10 additional reference documents per pursuit
- Total storage: 150MB across all additional references per pursuit
- References only used for current pursuit (not added to historical repository)
- User can remove references and regenerate to see impact

### 4.6 Refinement Capabilities
Users can request:
- Adding more detail to specific sections
- Including specific case studies or examples
- Rewording content
- Providing more details on bullets
- Rearranging sections
- Citing additional sources
- Any other enhancement requests

### 4.7 Interaction Model
- Chat-based interface for prompts
- Direct inline editing of outline
- Maintain full conversation history
- Show citations/sources for all generated content
- Support iterative refinement

### 4.8 LLM Provider
- **Primary:** Anthropic Claude (using user's Max subscription)
- Model selection based on task requirements

---

## 5. Document Generation

### 5.1 PowerPoint (.pptx) Output
- Use blank slides with minimal styling
- Each heading maps to a new slide
- Subtitle becomes slide subtitle
- Bullet points populate slide content
- Use publicly available PowerPoint icons
- Support for minimal charts and images
- No custom templates in MVP

### 5.2 Word (.docx) Output
- Blank template with standard styling
- Headings map to document sections with proper heading styles
- Support for tables, figures, and appendices
- Minimal formatting

### 5.3 Generation Requirements
- Preview capability before finalizing
- Generation time target: 4 minutes
- Export functionality for external editing
- Or return to outline for updates (which update the proposal)
- Store final document with pursuit record

---

## 6. File Handling

### 6.1 Upload Specifications
- **Accepted Formats:** .pdf, .docx, .pptx
- **Maximum File Size:** 75 pages per document
- **Maximum Document Size:** 15 MB per file
- **Multiple Files:** Support multiple file uploads per pursuit (RFP + appendices)

### 6.2 Storage Requirements
- Store original uploaded RFP files permanently
- Average document size: ~15 MB
- Total storage capacity needed: Up to 5 GB for MVP
- No virus scanning required for MVP

### 6.3 Chat-Based Requirements Entry
- If user describes RFP via chat (no upload), rationalize and break into requirements
- Store as structured pursuit requirements
- Treat equivalently to uploaded RFP for downstream processing

---

## 7. User Access & Permissions

### 7.1 MVP Access Model
- **Single Role:** All users have identical permissions
- **Repository Access:** Everyone can view all past pursuits
- **Pursuit Actions:** Everyone can perform all lifecycle activities
  - Create new pursuits
  - Upload/edit metadata
  - Search and view past pursuits
  - Tag content as "high quality"
  - Mark pursuits with status changes
  - Delete or archive pursuits

### 7.2 Review Workflow
- Internal Pursuit Owner submits pursuit as "DRAFT"
- Minimum 2 reviewers (any users) must review
- Reviewers provide feedback and approval
- After 2+ approvals, ready for submission
- No role-based restrictions on who can review

### 7.3 Future Considerations
- Role-based access control (RBAC) for post-MVP
- Approval workflows
- Confidentiality levels
- Team/office-based access restrictions

---

## 8. Search & Discovery

### 8.1 AI-Powered Search
- Triggered after RFP upload and metadata entry complete
- Returns 5-10 similar past pursuits
- Weighted scoring algorithm (see 4.2)
- Display similarity explanation for each result

### 8.2 Manual Search
- Users can search repository separately from AI recommendations
- Filter by metadata fields:
  - Industry
  - Service Type
  - Technology
  - Status (Won/Lost/etc.)
  - Date ranges
  - Geography
  - Estimated Fees
- Search time target: 30 seconds

### 8.3 Empty Database Handling
- Show message when no similar pursuits exist
- Allow users to proceed without selecting reference pursuits
- Support seeding database via UI upload of historical pursuits

---

## 9. Analytics & Reporting

### 9.1 Metrics to Track
- **Win/Loss Rates:**
  - Overall
  - By Industry
  - By Service Type
  - By Technology
  - By Client
  - By Team Member

- **Operational Metrics:**
  - Time to completion (RFP received → submitted)
  - Number of pursuits in progress vs. completed
  - Pursuits by status

- **Usage Metrics:**
  - Which historical pursuits referenced most often
  - Which pursuits tagged as "high quality" most frequently

### 9.2 Dashboard Views
- **Individual View:**
  - My pursuits
  - My tasks
  - Pursuits I'm reviewing

- **Team/Firm View:**
  - All active pursuits
  - Upcoming deadlines
  - Pipeline overview

- **Historical Performance:**
  - Trends over time
  - Success rates
  - Performance by dimension

### 9.3 Filtering & Date Ranges
- Last 30/60/90 days
- Year-to-date
- Custom date ranges
- Filter by any metadata field

### 9.4 Export Capabilities
- Export reports and analytics data
- Support common formats (CSV, Excel)

### 9.5 Notifications
- No notifications required for MVP

---

## 10. Integration Requirements

### 10.1 MVP Integrations
- **Must-Have:** Frontend ↔ Backend integration
- **No External Integrations:**
  - No email systems
  - No document storage (SharePoint, Google Drive)
  - No CRM systems
  - No calendar systems
  - No SSO/authentication systems
  - No collaboration tools (Teams, Slack)

### 10.2 AI Services
- **LLM:** Anthropic Claude API (user's Max subscription)
  - Claude Sonnet 4.5 for outline generation, refinement, deep research
  - Claude 3 Haiku for simple tasks (metadata extraction)
- **Document Parsing/OCR:** Required for extracting information from RFPs and past pursuits
- **Vector Database:** ChromaDB (Semantic Search) capabilities
- **Web Search/Research:** Required for AI to conduct web research
  - Option 1: Claude's web search capabilities (if available)
  - Option 2: Claude API web search (built-in to Claude)
  - Option 3: Web scraping with appropriate rate limiting
  - Must handle: search queries, result parsing, URL fetching, content extraction

### 10.3 Compliance & Data Residency
- No specific geographic data residency requirements for MVP
- No compliance standards (SOC2, ISO) required for MVP

---

## 11. Performance & Scale Requirements

### 11.1 User Scale
- **Expected Users:** Up to 10 concurrent users
- **Total Users:** ~10 users in organization

### 11.2 Pursuit Volume
- **Active Pursuits:** Variable
- **New Pursuits:** Up to 10 per week
- **Historical Pursuits:** TBD based on seeding

### 11.3 Performance Targets
- **Search & Return Similar Pursuits:** 30 seconds
- **Generate Initial Outline:** 3 minutes (increased to account for web research)
- **Generate Final Document:** 4 minutes
- **General UI Interactions:** Reasonable/acceptable response times (< 2 seconds)
- **Web Research:** ~30-60 seconds for search and content extraction within outline generation

### 11.4 Storage
- **Document Size:** Up to 15 MB per document
- **Total Storage:** Up to 5 GB for MVP

### 11.5 Cost Constraints
- Keep cloud hosting costs as low as possible
- Leverage user's Anthropic Claude Max subscription
- Optimize for cost efficiency

---

## 12. MVP Scope Summary

### 12.1 In Scope
✅ RFP upload and parsing (.pdf, .docx, .pptx)
✅ Chat-based requirements entry
✅ Metadata capture and auto-extraction
✅ AI-powered semantic search for similar pursuits
✅ Manual search with filters
✅ Outline generation with citations
✅ Iterative refinement via prompts and direct editing
✅ Document generation (.docx and .pptx)
✅ Review and approval workflow (min 2 reviewers)
✅ Quality tagging system
✅ Historical pursuit repository
✅ Analytics and reporting dashboards
✅ Data export capabilities
✅ Database seeding via UI
✅ **Auto-save and manual save at any point**
✅ **Resume in-progress pursuits from dashboard**
✅ **Progress tracking throughout pursuit lifecycle**

### 12.2 Out of Scope (Post-MVP)
❌ External system integrations (email, CRM, storage, SSO)
❌ Role-based access control
❌ Custom document templates
❌ Notifications and alerts
❌ File security/virus scanning
❌ Confidentiality controls
❌ Advanced compliance features

---

## 13. Success Criteria

A pursuit response is considered successful when:
1. All required metadata captured
2. Relevant past pursuits identified and selected (if available)
3. Outline generated with proper citations
4. User refinements incorporated
5. Final document generated in requested format
6. Minimum 2 reviewers approve
7. Marked as "SUBMITTED" by Internal Pursuit Owner
8. All artifacts stored in repository

---

## Document Control

**Version:** 1.0
**Date:** 2025-11-04
**Status:** Requirements Gathering Complete
**Next Phase:** Architecture Design
