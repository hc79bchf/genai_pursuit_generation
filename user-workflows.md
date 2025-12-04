# User Workflows & Feature Specifications - Pursuit Response Platform

## 1. Overview

This document details the user workflows, UI/UX requirements, and feature specifications for the Pursuit Response Platform MVP.

---

## 2. Core User Workflows

### 2.1 Workflow 1: Create New Pursuit Response

**Trigger:** User needs to respond to a new RFP

**Primary Actor:** Internal Pursuit Owner

**Preconditions:** User is authenticated

**Main Flow:**

```
┌─────────────────────────────────────────────────────────┐
│ Step 1: Initiate Pursuit                               │
├─────────────────────────────────────────────────────────┤
│ User clicks "New Pursuit" button                        │
│ System presents creation method options:                │
│   • Upload RFP Document(s)                             │
│   • Enter Requirements via Chat                         │
│   • Upload Requirements Document                        │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ Step 2A: Upload RFP (if selected)                      │
├─────────────────────────────────────────────────────────┤
│ • Drag-and-drop or browse files                        │
│ • Support multiple files (.pdf, .docx, .pptx)          │
│ • Show upload progress                                  │
│ • Display file validation (size, type)                 │
│ • System begins text extraction in background          │
└────────────────┬────────────────────────────────────────┘
                 │
┌────────────────┴────────────────────────────────────────┐
│ Step 2B: Chat Requirements (alternative)                │
├─────────────────────────────────────────────────────────┤
│ • Chat interface opens                                  │
│ • User describes RFP requirements conversationally      │
│ • AI asks clarifying questions                          │
│ • System rationalizes into structured requirements      │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ Step 3: Review & Complete Metadata                     │
├─────────────────────────────────────────────────────────┤
│ System displays form with:                              │
│ • Auto-populated fields (extracted from RFP)           │
│ • Highlighted fields that need review/correction       │
│ • Required fields marked with *                        │
│                                                         │
│ User reviews and completes:                             │
│ ✓ Entity Name                                          │
│ ✓ Client Pursuit Owner & Email                        │
│ ✓ Internal Pursuit Owner & Email                      │
│ ✓ Industry (dropdown)                                  │
│ ✓ Service Types (multi-select)                        │
│ ✓ Expected Format (docx/pptx)                         │
│ • Geography (optional)                                 │
│ • Submission Due Date (optional)                       │
│ • Estimated Fees (optional)                            │
│ • Technologies (multi-select, optional)                │
│ • **Proposal Outline/Framework (optional)**           │
│   - Text area or structured input                      │
│   - User specifies desired section structure           │
│   - Example: Title Page, Table of Contents, etc.      │
│   - If not provided, AI generates structure            │
│                                                         │
│ User clicks "Continue to Search"                        │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ Step 4: AI-Powered Similar Pursuit Search              │
├─────────────────────────────────────────────────────────┤
│ System displays:                                        │
│ • "Searching for similar pursuits..." loading indicator│
│ • Progress: "Analyzing requirements..."                │
│ • Progress: "Searching historical pursuits..."         │
│                                                         │
│ Results display (5-10 pursuits):                       │
│ ┌─────────────────────────────────────────────────┐   │
│ │ Acme Healthcare - Digital Transformation        │   │
│ │ Industry: Healthcare | Status: Won              │   │
│ │ Match: 92% - Same industry, service type, tech  │   │
│ │ Services: Engineering, Data | Fees: $500K      │   │
│ │ Tagged: High Quality (3 users)                  │   │
│ │ [Preview] [Select]                              │   │
│ └─────────────────────────────────────────────────┘   │
│                                                         │
│ User actions:                                           │
│ • Preview pursuit (opens modal with outline/content)   │
│ • Select/deselect pursuits (checkbox)                  │
│ • Apply filters (industry, service, win status, date)  │
│ • Manual search box for additional pursuits            │
│ • "Skip this step" if no relevant pursuits             │
│                                                         │
│ User clicks "Generate Outline" (with 0-10 selected)    │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ Step 5: AI Outline Generation                          │
├─────────────────────────────────────────────────────────┤
│ System displays:                                        │
│ • "Generating your pursuit outline..." (progress bar)  │
│ • "Analyzing RFP requirements..." (Step 1/4)           │
│ • "Researching selected pursuits..." (Step 2/4)        │
│ • "Creating outline structure..." (Step 3/4)           │
│ • "Adding citations..." (Step 4/4)                     │
│                                                         │
│ Estimated time: 3 minutes                               │
│                                                         │
│ On completion:                                          │
│ • Navigate to Outline Editor                           │
│ • Show success notification                            │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ Step 6: Review & Refine Outline                        │
├─────────────────────────────────────────────────────────┤
│ Split-screen interface:                                 │
│                                                         │
│ LEFT PANEL: Outline Editor                             │
│ ├─ Section 1: Executive Summary                        │
│ │  Subtitle: Overview of proposed approach             │
│ │  • Bullet point 1 [citation: Acme Healthcare]       │
│ │  • Bullet point 2 [citation: deep research]         │
│ │  [+ Add bullet] [Edit] [Reorder]                    │
│ ├─ Section 2: Technical Approach                       │
│ │  Subtitle: Methodology and implementation            │
│ │  ...                                                 │
│                                                         │
│ RIGHT PANEL: Chat Assistant                            │
│ ├─ Conversation History                                │
│ │  "I've created an initial outline based on..."      │
│ ├─ Input Box                                           │
│ │  "Add more detail about healthcare experience"      │
│ │  [Send]                                              │
│                                                         │
│ User can:                                               │
│ • Click citations to see sources                       │
│ • Edit bullets inline                                  │
│ • Drag-and-drop to reorder                             │
│ • Chat with AI to request changes                      │
│ • Add/remove sections and bullets                      │
│                                                         │
│ Top toolbar:                                            │
│ [Save Draft] [Preview Document] [Generate Document]    │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ Step 7: Generate Document                              │
├─────────────────────────────────────────────────────────┤
│ User clicks "Generate Document"                         │
│                                                         │
│ System displays:                                        │
│ • "Generating [DOCX/PPTX]..." (progress bar)           │
│ • "Creating structure..." (Step 1/3)                   │
│ • "Adding content..." (Step 2/3)                       │
│ • "Formatting..." (Step 3/3)                           │
│                                                         │
│ Estimated time: 4 minutes                               │
│                                                         │
│ On completion:                                          │
│ • Preview modal opens showing document                 │
│ • [Download] [Export for Editing] [Back to Outline]   │
│                                                         │
│ User downloads or exports document                      │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ Step 8: Submit for Review                              │
├─────────────────────────────────────────────────────────┤
│ User clicks "Submit for Review" button                  │
│                                                         │
│ Modal opens:                                            │
│ • "Submit this pursuit for review?"                    │
│ • "At least 2 reviewers must approve before submission"│
│ • Checklist:                                           │
│   ✓ Outline complete                                   │
│   ✓ Document generated                                 │
│   ✓ Metadata verified                                  │
│ • [Cancel] [Submit as Draft]                           │
│                                                         │
│ On submit:                                              │
│ • Status changes to "in_review"                        │
│ • Review tasks created (available to all users)        │
│ • Success notification shown                           │
│ • User redirected to pursuit detail page               │
└─────────────────────────────────────────────────────────┘
```

**Postconditions:**
- Pursuit created with status "in_review"
- All artifacts stored (RFP, outline, document, citations)
- Review tasks available for other users

**Alternative Flows:**

**A1: No Similar Pursuits Found**
- Step 4: System shows "No similar pursuits found"
- User can proceed to outline generation without references
- AI generates outline based solely on RFP requirements

**A2: User Makes Changes After Review Feedback**
- User receives feedback from reviewers
- Returns to Step 6 (Outline Editor)
- Makes requested changes
- Reviews reset to "pending" status
- Re-submits for review

---

### 2.2 Workflow 2: Review & Approve Pursuit

**Trigger:** Pursuit submitted for review

**Primary Actor:** Reviewer (any user)

**Preconditions:**
- User is authenticated
- Pursuit in "in_review" status

**Main Flow:**

```
┌─────────────────────────────────────────────────────────┐
│ Step 1: Discover Pending Reviews                       │
├─────────────────────────────────────────────────────────┤
│ User navigates to "Pending Reviews" from:               │
│ • Dashboard widget showing pending count                │
│ • Main navigation menu                                  │
│ • Notification (future)                                 │
│                                                         │
│ System displays list of pursuits needing review:        │
│ ┌─────────────────────────────────────────────────┐   │
│ │ Beta Financial - Risk Assessment                │   │
│ │ Owner: John Doe | Submitted: 2 hours ago        │   │
│ │ Industry: Financial Services | Format: PPTX     │   │
│ │ Reviews: 1/2 approved                           │   │
│ │ [Review Now]                                    │   │
│ └─────────────────────────────────────────────────┘   │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ Step 2: Open Pursuit for Review                        │
├─────────────────────────────────────────────────────────┤
│ User clicks "Review Now"                                │
│                                                         │
│ System displays pursuit detail page with:               │
│                                                         │
│ TABS:                                                   │
│ [Overview] [Outline] [Document] [Reviews]              │
│                                                         │
│ OVERVIEW TAB:                                           │
│ • All metadata                                         │
│ • RFP documents (downloadable)                         │
│ • Referenced past pursuits                             │
│ • Generation timestamps                                 │
│                                                         │
│ OUTLINE TAB:                                            │
│ • Full outline with citations                          │
│ • Read-only view                                       │
│ • Click citations to see sources                       │
│                                                         │
│ DOCUMENT TAB:                                           │
│ • Preview of generated document                        │
│ • Download option                                      │
│                                                         │
│ REVIEWS TAB:                                            │
│ • Existing reviews and feedback                        │
│ • Review status (approved, changes requested)          │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ Step 3: Conduct Review                                 │
├─────────────────────────────────────────────────────────┤
│ User reviews all tabs, checking for:                    │
│ • Accuracy of information                              │
│ • Completeness of response                             │
│ • Quality of writing                                   │
│ • Proper citations                                     │
│ • Alignment with RFP requirements                      │
│                                                         │
│ User clicks "Submit Review" button                      │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ Step 4: Provide Review Decision                        │
├─────────────────────────────────────────────────────────┤
│ Modal opens with review form:                           │
│                                                         │
│ Review Decision:                                        │
│ ( ) Approve                                            │
│ ( ) Request Changes                                    │
│                                                         │
│ Feedback (optional if approving, required if changes): │
│ [Text area for comments]                               │
│                                                         │
│ Examples:                                               │
│ • "Add more detail to technical approach section"      │
│ • "Include specific case study for healthcare"         │
│ • "Clarify timeline in implementation plan"            │
│                                                         │
│ [Cancel] [Submit Review]                               │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ Step 5: System Processes Review                        │
├─────────────────────────────────────────────────────────┤
│ If APPROVED:                                            │
│ • Review marked as "approved"                          │
│ • Check if 2+ approvals exist                          │
│ • If yes: pursuit status → "ready_for_submission"      │
│ • If no: pursuit stays "in_review"                     │
│ • Notify internal pursuit owner (future)               │
│                                                         │
│ If CHANGES REQUESTED:                                   │
│ • Review marked as "changes_requested"                 │
│ • Feedback visible to internal pursuit owner           │
│ • Pursuit stays "in_review"                            │
│ • Other approvals remain valid                         │
│ • Notify internal pursuit owner (future)               │
│                                                         │
│ Success message shown to reviewer                       │
│ Reviewer redirected to pending reviews list             │
└─────────────────────────────────────────────────────────┘
```

**Postconditions:**
- Review recorded with status and feedback
- Pursuit status updated if criteria met
- Internal pursuit owner can see feedback

---

### 2.3 Workflow 3: Search Historical Pursuits

**Trigger:** User needs to find past pursuits for reference

**Primary Actor:** Any user

**Preconditions:** User is authenticated

**Main Flow:**

```
┌─────────────────────────────────────────────────────────┐
│ Step 1: Navigate to Repository                         │
├─────────────────────────────────────────────────────────┤
│ User clicks "Past Pursuits" in main navigation          │
│                                                         │
│ System displays repository browser:                     │
│                                                         │
│ HEADER:                                                 │
│ [Search box] [Filters] [Sort] [View: Grid/List]       │
│                                                         │
│ FILTERS PANEL (collapsible):                           │
│ • Industry (multi-select)                              │
│ • Service Types (multi-select)                         │
│ • Technologies (multi-select)                          │
│ • Status (multi-select)                                │
│ • Date Range (picker)                                  │
│ • Win Status (Won/Lost/Other)                          │
│ • Quality Tagged (checkbox)                            │
│ • Estimated Fees (range slider)                        │
│ [Reset Filters] [Apply]                                │
│                                                         │
│ RESULTS GRID:                                           │
│ Shows pursuit cards with key info                       │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ Step 2: Search & Filter                                │
├─────────────────────────────────────────────────────────┤
│ Option A: Keyword Search                               │
│ • User types in search box                             │
│ • Search across entity name, industry, requirements    │
│ • Results update in real-time (debounced)              │
│                                                         │
│ Option B: Filter by Metadata                            │
│ • User selects filter criteria                         │
│ • Clicks "Apply"                                       │
│ • Results refresh                                      │
│                                                         │
│ Option C: Combination                                   │
│ • User applies both keyword and filters                │
│                                                         │
│ Results display:                                        │
│ ┌─────────────────────────────────────────────────┐   │
│ │ Acme Healthcare Digital Transformation       ⭐  │   │
│ │ Industry: Healthcare | Status: Won              │   │
│ │ Services: Engineering, Data                     │   │
│ │ Technologies: Azure, M365 Copilot               │   │
│ │ Fees: $500K | Submitted: Jan 2024              │   │
│ │ Quality Tags: 3                                 │   │
│ │ [View Details] [Download]                       │   │
│ └─────────────────────────────────────────────────┘   │
│                                                         │
│ Showing 15 of 47 results                                │
│ [Load More]                                             │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ Step 3: View Pursuit Details                           │
├─────────────────────────────────────────────────────────┤
│ User clicks "View Details"                              │
│                                                         │
│ Full pursuit detail page opens (same as review flow)    │
│                                                         │
│ User can:                                               │
│ • View all metadata                                    │
│ • Read outline with citations                          │
│ • Download generated document                          │
│ • See which pursuits referenced this one               │
│ • View quality tags                                    │
│ • Add quality tags (if pursuit completed)              │
└─────────────────────────────────────────────────────────┘
```

**Postconditions:**
- User has found relevant past pursuits
- User can download or reference in new pursuit

---

### 2.4 Workflow 4: Seed Historical Pursuits

**Trigger:** Need to populate repository with historical pursuits

**Primary Actor:** Any user (typically admin/power user)

**Preconditions:**
- User is authenticated
- Has historical pursuit documents

**Main Flow:**

```
┌─────────────────────────────────────────────────────────┐
│ Step 1: Navigate to Seed Interface                     │
├─────────────────────────────────────────────────────────┤
│ User navigates to "Upload Historical Pursuits"          │
│ (accessible from Past Pursuits page)                    │
│                                                         │
│ System displays upload interface:                       │
│                                                         │
│ BULK UPLOAD MODE:                                       │
│ ┌─────────────────────────────────────────────────┐   │
│ │   Drag and drop historical pursuit documents    │   │
│ │            (.pdf, .docx, .pptx)                 │   │
│ │                                                 │   │
│ │              [Browse Files]                     │   │
│ └─────────────────────────────────────────────────┘   │
│                                                         │
│ • Supports multiple files at once                      │
│ • Each file = one historical pursuit                   │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ Step 2: Upload Files                                   │
├─────────────────────────────────────────────────────────┤
│ User drops/selects 5 files                              │
│                                                         │
│ System displays upload queue:                           │
│ ┌─────────────────────────────────────────────────┐   │
│ │ 1. Acme-Healthcare-2023.pptx                    │   │
│ │    15.2 MB | Uploading... 45%                   │   │
│ ├─────────────────────────────────────────────────┤   │
│ │ 2. Beta-Financial-Risk.docx                     │   │
│ │    8.5 MB | Queued                              │   │
│ ├─────────────────────────────────────────────────┤   │
│ │ 3. Gamma-Manufacturing.pdf                      │   │
│ │    12.1 MB | Queued                             │   │
│ └─────────────────────────────────────────────────┘   │
│                                                         │
│ As each completes upload:                               │
│ • Text extraction begins automatically                 │
│ • Status changes to "Processing..."                    │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ Step 3: Review Extracted Metadata                      │
├─────────────────────────────────────────────────────────┤
│ For each uploaded file, system attempts extraction:     │
│                                                         │
│ FILE: Acme-Healthcare-2023.pptx                         │
│ Status: ✓ Extraction Complete                          │
│                                                         │
│ Auto-extracted metadata (editable):                     │
│ • Entity Name: Acme Healthcare Corp ✓                  │
│ • Industry: Healthcare (confidence: 95%) ✓             │
│ • Service Types: [Please select]                       │
│ • Technologies: Azure, M365 (detected) ✓               │
│ • Estimated Fees: $500,000 (detected) ✓                │
│                                                         │
│ User must provide:                                      │
│ • Client Pursuit Owner (required)                      │
│ • Internal Pursuit Owner (required)                    │
│ • Service Types (required)                             │
│ • Status: Won/Lost/Cancelled/Stale (required)          │
│ • Expected Format: [auto: pptx] ✓                      │
│                                                         │
│ [Skip This File] [Save & Continue]                     │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ Step 4: Generate Embeddings & Index                    │
├─────────────────────────────────────────────────────────┤
│ After metadata completed for all files:                 │
│                                                         │
│ System displays progress:                               │
│ "Indexing historical pursuits for search..."           │
│                                                         │
│ For each pursuit:                                       │
│ 1. Generate vector embedding from extracted text        │
│ 2. Store in database with metadata                     │
│ 3. Mark as searchable                                  │
│                                                         │
│ Progress: 3/5 pursuits indexed                          │
│                                                         │
│ On completion:                                          │
│ • Success notification                                 │
│ • "5 historical pursuits added to repository"          │
│ • Redirect to Past Pursuits page                       │
└─────────────────────────────────────────────────────────┘
```

**Postconditions:**
- Historical pursuits stored in repository
- Searchable by AI and manual search
- Available as references for new pursuits

---

### 2.5 Workflow 5: Tag Quality Pursuits

**Trigger:** User finds exemplary content in past pursuit

**Primary Actor:** Any user

**Preconditions:**
- User is authenticated
- Viewing a completed pursuit (won/lost/submitted)

**Main Flow:**

```
┌─────────────────────────────────────────────────────────┐
│ Step 1: View Completed Pursuit                         │
├─────────────────────────────────────────────────────────┤
│ User viewing pursuit detail page                        │
│ Pursuit status: Won                                     │
│                                                         │
│ Top-right corner shows:                                 │
│ [⭐ Add Quality Tag]                                    │
│                                                         │
│ Existing tags shown:                                    │
│ 🏆 High Quality (tagged by 2 users)                    │
│ ✅ Exemplary (tagged by 1 user)                        │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ Step 2: Add Quality Tag                                │
├─────────────────────────────────────────────────────────┤
│ User clicks "Add Quality Tag"                           │
│                                                         │
│ Modal opens:                                            │
│                                                         │
│ Add Quality Tag                                         │
│                                                         │
│ Tag Type: (required)                                    │
│ ( ) High Quality - General high quality marker         │
│ ( ) Exemplary - Exemplary example                      │
│ ( ) Good Approach - Good technical approach            │
│ ( ) Well Written - Well-written content                │
│ ( ) Effective - Effective proposal (won)               │
│                                                         │
│ Apply to: (required)                                    │
│ ( ) Entire Pursuit                                     │
│ ( ) Specific Section:                                  │
│     [Dropdown: Select Section from Outline]            │
│                                                         │
│ Notes (optional):                                       │
│ [Text area]                                            │
│ "Excellent use of healthcare case studies"             │
│                                                         │
│ [Cancel] [Add Tag]                                     │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ Step 3: Tag Saved                                      │
├─────────────────────────────────────────────────────────┤
│ System:                                                 │
│ • Saves tag to database                                │
│ • Updates pursuit's quality score                      │
│ • Tag appears in pursuit details                       │
│ • Influences future search ranking                     │
│                                                         │
│ Success notification:                                   │
│ "Quality tag added! This will help improve future       │
│  search recommendations."                               │
└─────────────────────────────────────────────────────────┘
```

**Postconditions:**
- Quality tag stored
- Pursuit ranking improved for future searches
- Tag visible to all users

---

### 2.6 Workflow 6: Export Analytics

**Trigger:** User needs to analyze pursuit performance

**Primary Actor:** Any user

**Preconditions:** User is authenticated

**Main Flow:**

```
┌─────────────────────────────────────────────────────────┐
│ Step 1: Navigate to Analytics                          │
├─────────────────────────────────────────────────────────┤
│ User clicks "Analytics" in main navigation              │
│                                                         │
│ System displays dashboard with:                         │
│                                                         │
│ FILTERS (top):                                          │
│ Date Range: [Last 30 Days ▼]                          │
│ Industry: [All ▼]                                      │
│ Service Type: [All ▼]                                  │
│ [Apply Filters]                                        │
│                                                         │
│ KEY METRICS (cards):                                    │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐      │
│ │ Win Rate    │ │ Active      │ │ Avg Time    │      │
│ │   65.2%     │ │ Pursuits: 8 │ │  to Submit  │      │
│ │   ↑ 5.3%    │ │             │ │  4.2 days   │      │
│ └─────────────┘ └─────────────┘ └─────────────┘      │
│                                                         │
│ CHARTS:                                                 │
│ • Win Rate by Industry (bar chart)                     │
│ • Pursuits Over Time (line chart)                      │
│ • Service Type Distribution (pie chart)                │
│ • Most Referenced Pursuits (table)                     │
│ • Time to Completion (histogram)                       │
│                                                         │
│ [Export Data]                                          │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ Step 2: Export Analytics Data                          │
├─────────────────────────────────────────────────────────┤
│ User clicks "Export Data"                               │
│                                                         │
│ Modal opens:                                            │
│                                                         │
│ Export Analytics Data                                   │
│                                                         │
│ Include:                                                │
│ ☑ Pursuit list with metadata                           │
│ ☑ Win/loss breakdown by industry                       │
│ ☑ Win/loss breakdown by service type                   │
│ ☑ Time to completion metrics                           │
│ ☑ Most referenced pursuits                             │
│                                                         │
│ Format:                                                 │
│ ( ) CSV                                                │
│ (•) Excel (.xlsx)                                      │
│                                                         │
│ Date Range: Last 30 Days                                │
│                                                         │
│ [Cancel] [Export]                                      │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ Step 3: Download File                                  │
├─────────────────────────────────────────────────────────┤
│ System generates export file                            │
│                                                         │
│ Progress: "Generating export... 80%"                    │
│                                                         │
│ On completion:                                          │
│ • File downloads automatically                         │
│ • Success notification shown                           │
│                                                         │
│ Excel file contains multiple sheets:                    │
│ • Sheet 1: Pursuit List                                │
│ • Sheet 2: Industry Breakdown                          │
│ • Sheet 3: Service Type Breakdown                      │
│ • Sheet 4: Reference Analytics                         │
└─────────────────────────────────────────────────────────┘
```

**Postconditions:**
- User has analytics data for external analysis
- Can use in presentations or reports

---

### 2.7 Workflow 7: Save & Resume Pursuit

**Trigger:** User wants to save progress or resume previous work

**Primary Actor:** Any user working on pursuit

**Preconditions:** User is authenticated

**Main Flow (Save Progress):**

```
┌─────────────────────────────────────────────────────────┐
│ Step 1: Auto-Save (Background)                         │
├─────────────────────────────────────────────────────────┤
│ User actively working on pursuit:                       │
│ • Filling metadata form                                │
│ • Editing outline                                      │
│ • Chatting with AI                                     │
│ • Reviewing document                                   │
│                                                         │
│ After 30 seconds of inactivity:                         │
│ • System auto-saves all progress                       │
│ • Small notification appears: "Draft saved ✓"          │
│ • User continues working without interruption          │
│                                                         │
│ What gets saved:                                        │
│ • All form inputs (metadata fields)                    │
│ • Selected reference pursuits                          │
│ • Outline JSON with all edits                          │
│ • Conversation history                                 │
│ • Current stage/step                                   │
│ • Generated document reference                         │
└─────────────────────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────────────────────┐
│ Step 2: Manual Save (User-Initiated)                   │
├─────────────────────────────────────────────────────────┤
│ User clicks "Save Draft" button (visible on all screens)│
│                                                         │
│ System:                                                 │
│ • Saves current state immediately                      │
│ • Shows progress indicator (< 2 seconds)               │
│ • Displays success notification: "Draft saved ✓"       │
│                                                         │
│ User options:                                           │
│ • Continue working                                     │
│ • Navigate away/close browser                          │
│ • Logout                                               │
│                                                         │
│ All progress safely persisted in database               │
└─────────────────────────────────────────────────────────┘
```

**Main Flow (Resume Progress):**

```
┌─────────────────────────────────────────────────────────┐
│ Step 1: View In-Progress Pursuits                      │
├─────────────────────────────────────────────────────────┤
│ User logs into application                              │
│ Dashboard displays "In Progress Pursuits" widget        │
│                                                         │
│ Widget shows pursuit cards:                             │
│ ┌───────────────────────────────────────────────────┐ │
│ │ Acme Healthcare Digital Transformation            │ │
│ │ Stage: Refining Outline                           │ │
│ │ Progress: [████████████░░░░] 60%                  │ │
│ │ Last saved: 2 hours ago                           │ │
│ │                                                   │ │
│ │ [Continue Working]                                │ │
│ └───────────────────────────────────────────────────┘ │
│                                                         │
│ ┌───────────────────────────────────────────────────┐ │
│ │ Beta Financial Risk Assessment                    │ │
│ │ Stage: In Review                                  │ │
│ │ Progress: [██████████████████░] 90%               │ │
│ │ Last saved: Yesterday at 5:30 PM                  │ │
│ │                                                   │ │
│ │ [Continue Working]                                │ │
│ └───────────────────────────────────────────────────┘ │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ Step 2: Resume Pursuit                                 │
├─────────────────────────────────────────────────────────┤
│ User clicks "Continue Working" on pursuit card          │
│                                                         │
│ System loads pursuit and determines last stage:         │
│                                                         │
│ If stage = "Metadata Entry":                           │
│ → Navigate to metadata form with all fields filled     │
│                                                         │
│ If stage = "Search Results":                           │
│ → Navigate to search results with previous selections  │
│                                                         │
│ If stage = "Outline Editing":                          │
│ → Navigate to outline editor                           │
│ → Load outline JSON with all edits                     │
│ → Restore conversation history                         │
│                                                         │
│ If stage = "Document Generated":                       │
│ → Navigate to document preview                         │
│                                                         │
│ If stage = "In Review":                                │
│ → Navigate to review status screen                     │
│                                                         │
│ All user data exactly as it was when saved             │
│ User continues working seamlessly                       │
└─────────────────────────────────────────────────────────┘
```

**Alternative Flow (Concurrent Edit Warning):**

```
┌─────────────────────────────────────────────────────────┐
│ A1: Pursuit Open in Multiple Sessions                  │
├─────────────────────────────────────────────────────────┤
│ User clicks "Continue Working" on pursuit               │
│                                                         │
│ System detects pursuit is open in another tab/session  │
│                                                         │
│ Warning modal displays:                                 │
│ ┌───────────────────────────────────────────────────┐ │
│ │ ⚠️ Concurrent Edit Warning                         │ │
│ │                                                   │ │
│ │ This pursuit is currently open in another        │ │
│ │ browser tab or session.                          │ │
│ │                                                   │ │
│ │ Opening it here may cause conflicts. We          │ │
│ │ recommend closing the other session first.       │ │
│ │                                                   │ │
│ │ [Go Back] [Open Anyway]                          │ │
│ └───────────────────────────────────────────────────┘ │
│                                                         │
│ If user clicks "Open Anyway":                           │
│ • Pursuit opens with latest saved data                 │
│ • Warning displayed at top of screen                   │
│ • Last save wins if conflict occurs                    │
└─────────────────────────────────────────────────────────┘
```

**Postconditions:**
- All progress saved to database
- User can resume from exact point they left off
- No data loss
- Works across sessions and devices

---

### 2.8 Workflow 8: Upload Additional Reference Documents & Regenerate

**Trigger:** User wants to add more content sources to improve outline

**Primary Actor:** Internal Pursuit Owner

**Preconditions:**
- Pursuit has been created
- User is in Discovery, Generation, or Refinement phase

**Main Flow:**

```
┌─────────────────────────────────────────────────────────┐
│ Step 1: Upload Additional References                    │
├─────────────────────────────────────────────────────────┤
│ User clicks "Add Reference Documents" button             │
│ (Available on: Search Results, Outline Generation,      │
│  Outline Editor screens)                                │
│                                                         │
│ Upload modal opens:                                      │
│ ┌───────────────────────────────────────────────────┐ │
│ │ Upload Additional Reference Documents             │ │
│ │                                                   │ │
│ │ Drag files here or click to browse                │ │
│ │ Supported: .pdf, .docx, .pptx (max 15MB each)    │ │
│ │                                                   │ │
│ │ Current References (2):                           │ │
│ │ ☑ Company_Case_Studies_2024.pdf (3.2MB)          │ │
│ │ ☑ Methodology_Framework.docx (1.8MB)             │ │
│ │                                                   │ │
│ │ [Upload Files]                                    │ │
│ └───────────────────────────────────────────────────┘ │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ Step 2: Process Uploaded Files                         │
├─────────────────────────────────────────────────────────┤
│ System displays progress:                               │
│ "Processing Company_Case_Studies_2024.pdf..."           │
│ Progress: [████████████░░░░] 75%                        │
│                                                         │
│ For each file:                                          │
│ 1. Validate file (type, size, page count < 75)         │
│ 2. Store file with type = 'additional_reference'       │
│ 3. Extract text from document                          │
│ 4. Store extracted text                                │
│ 5. Mark extraction_status = 'completed'                │
│                                                         │
│ Success message:                                        │
│ "✓ 2 reference documents uploaded successfully"         │
│                                                         │
│ [Regenerate Outline with New References]                │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ Step 3: Regenerate Outline with References             │
├─────────────────────────────────────────────────────────┤
│ User clicks "Regenerate Outline with New References"    │
│                                                         │
│ System displays confirmation:                            │
│ ┌───────────────────────────────────────────────────┐ │
│ │ Regenerate Outline?                               │ │
│ │                                                   │ │
│ │ This will re-run the outline generation process  │ │
│ │ using:                                            │ │
│ │ • Selected past pursuits (3)                      │ │
│ │ • Additional references (2 new)                   │ │
│ │ • Web research (if gaps exist)                    │ │
│ │                                                   │ │
│ │ Your manual edits will be preserved where         │ │
│ │ possible.                                         │ │
│ │                                                   │ │
│ │ [Cancel] [Regenerate]                             │ │
│ └───────────────────────────────────────────────────┘ │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ Step 4: Seven-Agent Re-Execution                      │
├─────────────────────────────────────────────────────────┤
│ Progress displayed:                                      │
│ [Agent 1] Extracting metadata from RFP... 15s           │
│ [Agent 2] Analyzing coverage with new references... 30s │
│ [Agent 2] Conducting web research for gaps... 60s       │
│ [Agent 3] Synthesizing comprehensive outline... 90s     │
│                                                         │
│ Agent 1 (Metadata Extraction):                          │
│ - Extracts client, industry, service types              │
│                                                         │
│ Agent 2 (Gap Analysis):                                 │
│ - Identifies missing capabilities                       │
│ - Generates research queries                            │
│ • Reduces research queries if gaps filled               │
│                                                         │
│ Agent 2 (Research):                                     │
│ • Skips gaps already covered by additional refs         │
│ • Conducts web research only for remaining gaps         │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ Step 5: Review Updated Outline                         │
├─────────────────────────────────────────────────────────┤
│ Updated outline displayed with change indicators:        │
│                                                         │
│ Section: Our Healthcare Experience [UPDATED]            │
│ • Completed 15 data migration projects [NEW]            │
│   Source: Company_Case_Studies_2024.pdf, Page 12        │
│ • Implemented Epic EHR for 50K+ users                   │
│   Source: Past Pursuit: Acme Healthcare 2023            │

│ Gap Report:                                             │
│ "2 gaps filled by new references, 1 gap remains"        │
│                                                         │
│ User actions:                                           │
│ • Review updated sections                               │
│ • Accept or reject specific changes                     │
│ • Continue editing                                      │
│ • Upload more references if needed                      │
└─────────────────────────────────────────────────────────┘
```

**Alternative Flow - Remove References:**
```
User can remove additional references:
1. Click "Manage References" button
2. Uncheck references to remove
3. Click "Regenerate without References"
4. System re-executes agents without removed references
5. Updated outline shows what content was lost
```

**Acceptance Criteria:**
- ✅ "Add Reference Documents" button visible in all relevant phases
- ✅ Upload supports .pdf, .docx, .pptx (max 15MB per file)
- ✅ Maximum 10 additional references per pursuit
- ✅ Text extraction completes within 30 seconds per file
- ✅ extraction_status tracked (pending/processing/completed/failed)
- ✅ "Regenerate" button enabled after successful upload
- ✅ Regeneration preserves user edits where possible
- ✅ Updated sections marked with [UPDATED] indicator
- ✅ Additional reference citations included in outline
- ✅ Citations display filename, section, page number
- ✅ Gap Analysis Agent reduces web research for filled gaps
- ✅ User can remove references and regenerate
- ✅ Regeneration logged in conversation history
- ✅ Total regeneration time ~15 minutes (7-agent pipeline)

**Postconditions:**
- Additional reference documents stored and indexed
- Outline updated with new content and citations
- Gap report reflects reduced gaps
- User manual edits preserved where possible
- Conversation history includes regeneration event

---

## 3. UI/UX Requirements

### 3.1 Design Principles

**Simplicity**
- Clean, uncluttered interfaces
- Progressive disclosure (show advanced features when needed)
- Clear call-to-action buttons

**Efficiency**
- Minimize clicks to complete tasks
- Keyboard shortcuts for power users
- Autosave and form persistence

**Transparency**
- Always show AI progress and status
- Clear explanations for recommendations
- Visible citations and sources

**Responsiveness**
- Fast page loads (< 2 seconds)
- Optimistic UI updates
- Loading indicators for long operations

### 3.2 Layout & Navigation

**Main Navigation (Left Sidebar)**
```
╔════════════════╗
║ PURSUIT APP    ║
╠════════════════╣
║ 🏠 Dashboard    ║
║ ➕ New Pursuit  ║
║ 📋 My Pursuits  ║
║ 👁️ Reviews      ║
║ 📚 Past Pursuits║
║ 📊 Analytics    ║
║ ⚙️ Settings     ║
╚════════════════╝
```

**Dashboard Widgets**
- Active Pursuits (cards with status)
- Pending Reviews (count + list)
- Recent Activity (timeline)
- Quick Stats (win rate, total pursuits)

### 3.3 Component Specifications

#### Pursuit Card Component
```
┌─────────────────────────────────────────────────┐
│ Acme Healthcare Digital Transformation       ⭐  │
│ ───────────────────────────────────────────────  │
│ Industry: Healthcare | Status: Won              │
│ Service: Engineering, Data | Format: PPTX       │
│ Owner: John Doe | Submitted: Jan 15, 2024      │
│ ───────────────────────────────────────────────  │
│ [View Details] [Download]              [⋮ Menu] │
└─────────────────────────────────────────────────┘
```

**States:**
- Default
- Hover (subtle elevation)
- Selected (border highlight)
- Loading (skeleton screen)

#### Outline Editor Component

**Left Panel - Outline Tree:**
```
Executive Summary [Edit] [Reorder]
├─ Subtitle: Overview of approach
├─ • Bullet point 1 [citation]
├─ • Bullet point 2 [citation]
└─ [+ Add Bullet]

Technical Approach [Edit] [Reorder]
├─ Subtitle: Methodology
├─ Phase 1: Discovery [Expand]
└─ Phase 2: Implementation [Expand]
```

**Right Panel - Chat:**
```
┌─────────────────────────────────────────┐
│ AI Assistant                            │
├─────────────────────────────────────────┤
│                                         │
│ 🤖 I've created an outline based on    │
│    your RFP and 3 similar pursuits.    │
│    What would you like to refine?      │
│                             10:32 AM    │
│                                         │
│ Add more healthcare case studies     👤 │
│                             10:35 AM    │
│                                         │
│ 🤖 I've added 2 healthcare case       │
│    studies to the Technical Approach   │
│    section, citing from the Acme       │
│    Healthcare pursuit.                 │
│                             10:36 AM    │
├─────────────────────────────────────────┤
│ Type your message...                    │
│ [Send]                                  │
└─────────────────────────────────────────┘
```

#### Citation Popover
```
When user clicks a citation badge:

┌─────────────────────────────────────────┐
│ Source: Acme Healthcare Project         │
├─────────────────────────────────────────┤
│ Section: Technical Approach, Page 8     │
│                                         │
│ "Our team leverages a phased approach  │
│  to digital transformation, beginning  │
│  with a comprehensive discovery phase  │
│  that includes..."                     │
│                                         │
│ [View Full Pursuit] [Close]            │
└─────────────────────────────────────────┘
```

#### Progress Indicators

**Linear Progress (Document Generation):**
```
Generating Document... (Step 2 of 3)
[████████████████────────] 65%
Adding content...

Estimated time remaining: 1 minute 23 seconds
```

**Indeterminate Progress (AI Thinking):**
```
🤖 Analyzing your requirements...
[━━━━━━━━━━━━━━━━━━━━━━━━]
(Animated)
```

### 3.4 Responsive Design

**Breakpoints:**
- Desktop: ≥ 1280px (default)
- Tablet: 768px - 1279px
- Mobile: < 768px (not supported in MVP)

**MVP:** Focus on desktop experience
**Post-MVP:** Add tablet and mobile support

### 3.5 Accessibility

**MVP Requirements:**
- Semantic HTML
- Keyboard navigation support
- Alt text for images
- ARIA labels for interactive elements
- Sufficient color contrast (WCAG AA)

**Post-MVP:**
- Full WCAG 2.1 AA compliance
- Screen reader testing
- Focus management

---

## 4. Feature Specifications

### 4.1 Feature: AI-Powered Similarity Search

**Description:** Find similar past pursuits using semantic search

**Inputs:**
- Current pursuit requirements text
- Metadata filters (industry, service type, etc.)

**Process:**
1. Generate vector embedding for requirements
2. Query ChromaDB for similar pursuit embeddings
3. Apply metadata filters
4. Calculate weighted ranking score
5. Return top 5-10 results

**Ranking Algorithm:**
```
similarity_score = (
  0.40 * vector_cosine_similarity +
  0.20 * metadata_match_score +
  0.15 * quality_tag_score +
  0.15 * win_status_score +
  0.10 * recency_score
)

Where:
- vector_cosine_similarity: 0.0-1.0 from ChromaDB
- metadata_match_score: % of matching metadata fields
- quality_tag_score: (tag_count / max_tags) capped at 1.0
- win_status_score: 1.0 if won, 0.5 if submitted, 0.3 if lost
- recency_score: (1 - days_old / 365) capped at 1.0
```

**Outputs:**
- List of similar pursuits with:
  - Similarity score (percentage)
  - Match explanation (which factors contributed)
  - Preview information

**Performance Target:** < 30 seconds

---

### 4.2 Feature: AI Outline Generation with Seven-Agent Architecture

**Description:** Generate comprehensive outline using three specialized agents that analyze gaps, conduct targeted research, and synthesize content

**Inputs:**
- RFP requirements text
- 0-10 selected reference pursuits (full text)
- **Pursuit metadata (industry, service types, technologies, geography)**
- Web search capability

**Seven-Agent Sequential Process:**

**Agent 1: Metadata Extraction Agent (~15 seconds)**
- **Input:** RFP Documents
- **Process:** Extracts structured metadata (Client, Industry, Deadline, etc.)
- **Output:** JSON Metadata

**Agent 2: Gap Analysis Agent (~30 seconds)**
1. Parse and structure RFP requirements
2. Analyze selected past pursuits deeply
3. **Use metadata to understand context** (e.g., Healthcare + Engineering + Azure)
4. Map past pursuit content to RFP requirements (create coverage matrix)
5. Identify gaps (requirements not covered by past pursuits)
6. Prioritize gaps by RFP emphasis
7. **Generate metadata-aware research queries:**
   - Not generic: "data migration"
   - But specific: "Healthcare data migration best practices Azure 2024"
   - Queries include: industry + service + technology context
8. Output Gap Analysis Report

**Agent 2: Research Agent (~60 seconds)**
1. Receive Gap Analysis Report with targeted queries
2. **Use pursuit metadata to filter and prioritize research:**
   - Industry context: Search healthcare publications for Healthcare pursuits
   - Technology context: Prioritize Azure docs for Azure pursuits
   - Service context: Focus on Risk methodologies for Risk pursuits
3. Execute web searches for each gap
4. **Filter results by metadata relevance:**
   - Score sources based on industry match
   - Prioritize technology-specific documentation
   - Focus on service-appropriate best practices
5. Validate source credibility
6. Extract key information addressing each gap
7. Create citations with URLs, titles, metadata relevance scores
8. Output Web Research Findings

**Agent 3: Synthesis Agent (~60-90 seconds)**
1. Receive all inputs: RFP + past pursuits + web research + gap analysis + **metadata**
2. Synthesize content from all sources
3. Generate structured outline (sections, subtitles, bullets)
4. Ensure 100% requirement coverage (all gaps filled)
5. **Apply metadata context throughout synthesis:**
   - Use industry-specific terminology (Healthcare vs. Financial Services language)
   - Reference appropriate technologies (Azure vs. AWS specifics)
   - Emphasize relevant service capabilities (Engineering vs. Risk approaches)
6. Add citations for all content (source tracking)
7. Validate outline completeness
8. Create initial conversation context
9. Output Comprehensive Outline

**Agent 2: Gap Analysis Prompt Template:**
```
You are a Gap Analysis Agent for professional services proposals.

Context:
- Client: {entity_name}
- Industry: {industry}
- Service Types: {service_types}
- Technologies: {technologies}
- Geography: {geography}

RFP Requirements:
{requirements_text}

Selected Past Pursuits ({count}):
{reference_pursuits_content}

Proposal Outline/Framework (optional):
{outline_framework}

Task: Analyze coverage of RFP requirements by past pursuits and identify gaps.

Analysis Steps:
1. Parse RFP into structured requirements (deliverables, evaluation criteria, key themes)
2. **If proposal outline/framework provided:** Map requirements to specified sections
3. Deep analysis of each past pursuit's content
4. Use metadata context to understand domain (e.g., Healthcare + Engineering + Azure)
5. Create coverage matrix: map past pursuit content to RFP requirements
6. **If outline/framework provided:** Identify which sections need content vs. which are covered
7. Identify gaps: requirements NOT addressed by past pursuits (or empty sections)
8. Prioritize gaps by RFP emphasis and outline structure
9. Generate targeted research queries for each gap
   - NOT generic: "data migration best practices"
   - BUT specific: "Healthcare data migration best practices Azure 2024"
   - Include industry + service + technology in queries

Output Format: JSON
{
  "coverage_matrix": [
    {
      "requirement": "string",
      "covered_by": ["pursuit_id", "section_name"],
      "confidence": 0.0-1.0
    }
  ],
  "section_coverage": [
    {
      "section_name": "string (if outline/framework provided)",
      "requirements_mapped": ["requirement_ids"],
      "content_available": true/false,
      "coverage_percentage": 0.0-1.0
    }
  ],
  "gaps": [
    {
      "requirement": "string",
      "section": "string (if outline/framework provided)",
      "priority": "high|medium|low",
      "reason": "string",
      "research_query": "string with metadata context"
    }
  ],
  "research_queries": [
    {
      "query": "Industry-specific service Technology year",
      "gap_addressed": "requirement",
      "section": "string (if outline/framework provided)",
      "metadata_context": {
        "industry": "Healthcare",
        "service": "Engineering",
        "technology": "Azure"
      }
    }
  ]
}
```

**Agent 2: Research Prompt Template:**
```
You are a Web Research Agent for professional services proposals.

Context:
- Client: {entity_name}
- Industry: {industry}
- Service Types: {service_types}
- Technologies: {technologies}
- Geography: {geography}

Gap Analysis Report:
{gap_analysis_json}

Task: Execute web searches for each gap using targeted queries with metadata filtering.

Research Steps:
1. Execute search for each research query from gap analysis
2. Filter results by metadata relevance:
   - Industry-specific sources (e.g., Healthcare publications for Healthcare pursuits)
   - Technology-specific documentation (e.g., Azure docs for Azure pursuits)
   - Service-specific best practices (e.g., Risk methodologies for Risk pursuits)
3. Validate source credibility (prefer official docs, industry publications, reputable firms)
4. Extract key information for each gap
5. Prioritize sources that match multiple metadata dimensions
6. Assign relevance scores based on metadata alignment

Output Format: JSON
{
  "findings": [
    {
      "gap_addressed": "requirement",
      "sources": [
        {
          "url": "string",
          "title": "string",
          "excerpt": "string",
          "credibility": "high|medium|low",
          "metadata_relevance": {
            "industry_match": true/false,
            "technology_match": true/false,
            "service_match": true/false,
            "relevance_score": 0.0-1.0
          },
          "access_date": "YYYY-MM-DD"
        }
      ]
    }
  ],
  "search_summary": {
    "total_queries": number,
    "total_sources": number,
    "avg_relevance_score": 0.0-1.0
  }
}
```

**Agent 3: Synthesis Prompt Template:**
```
You are a Synthesis Agent for professional services proposals.

Context:
- Client: {entity_name}
- Industry: {industry}
- Service Types: {service_types}
- Technologies: {technologies}
- Geography: {geography}
- Expected Format: {expected_format}

RFP Requirements:
{requirements_text}

Past Pursuits Content:
{reference_pursuits_content}

Gap Analysis Report:
{gap_analysis_json}

Web Research Findings:
{web_research_json}

Proposal Outline/Framework (optional):
{outline_framework}

Task: Synthesize comprehensive outline with 100% requirement coverage using metadata-aware language.

Synthesis Steps:
1. Combine content from past pursuits + web research + gap analysis
2. **If proposal outline/framework provided:** Structure content according to specified sections
3. **If no outline provided:** Generate structure based on RFP requirements
4. Apply metadata context throughout:
   - Use industry-specific terminology (Healthcare vs Financial Services language)
   - Reference appropriate technologies (Azure, AWS, ServiceNow, etc.)
   - Emphasize relevant service capabilities (Engineering, Risk, Transformation)
   - Consider geography if applicable (regional regulations, standards)
5. Create structured outline (sections, subtitles, bullets)
6. **If outline/framework provided:** Ensure all specified sections are populated with content
7. **CRITICAL - NO HALLUCINATION POLICY:**
   - **ONLY use information explicitly provided in past pursuits or web research findings**
   - **NEVER invent or fabricate:**
     - Case studies or client examples
     - Statistics or metrics
     - Methodologies or frameworks (unless found in sources)
     - Team capabilities or credentials
     - Project outcomes or results
   - **If no information available for a requirement or section:**
     - Mark as: [GAP: Needs content]
     - Include explanatory placeholder, example:
       "[GAP: No healthcare case studies found in past pursuits or web research. Requires SME input on completed healthcare data migration projects.]"
     - DO NOT generate speculative or generic content as filler
8. Add citations for ALL content:
   - Past pursuit citations: {pursuit_name}, Section {section}, Page {page}
   - Web citations: {source_title}, {url}, accessed {date}, relevance: {score}
   - Synthesized citations: Multiple sources combined
   - Gap markers: No citation (placeholder for missing content)
9. Validate completeness against RFP requirements
10. Ensure proposal format matches expected format (.docx or .pptx structure)

Output Format: JSON
{
  "outline": {
    "sections": [
      {
        "heading": "string",
        "subtitle": "string",
        "bullets": [
          {
            "text": "string",
            "is_gap": false,
            "gap_explanation": "string (only if is_gap=true)",
            "citations": [citation_ids]
          }
        ]
      }
    ]
  },
  "citations": [
    {
      "id": "string",
      "type": "past_pursuit|web|synthesized",
      "source": "string",
      "url": "string (for web)",
      "pursuit_id": "string (for past_pursuit)",
      "section": "string",
      "page": number,
      "metadata_relevance": 0.0-1.0,
      "accessed_date": "YYYY-MM-DD"
    }
  ],
  "coverage_validation": {
    "total_requirements": number,
    "requirements_covered": number,
    "coverage_percentage": number
  },
  "gap_report": {
    "total_gaps": number,
    "gaps": [
      {
        "section": "string",
        "requirement": "string",
        "explanation": "string"
      }
    ]
  }
}
```

**Sequential Agent Execution:**
- Agent 1 (Metadata Extraction) → 15 seconds → Output: JSON Metadata
- Agent 2 (Gap Analysis) → 30 seconds → Output: Gap Analysis Report
- Agent 3 (Web Research) → 60 seconds → Output: Research Findings
- Agent 4 (Synthesis) → 90 seconds → Output: Proposal Outline

**Performance Target:** ~15 minutes total (7-agent pipeline with HITL, target < 7 min)

---

### 4.3 Feature: Iterative Outline Refinement

**Description:** Allow users to refine outline via chat or direct edits

**Chat-Based Refinement:**
- User sends prompt (e.g., "Add healthcare case studies")
- System appends to conversation history
- Sends full context to Claude API
- Streams response back to user
- Updates outline JSON with changes
- Adds new citations if applicable
- Appends response to conversation history

**Direct Edit:**
- User clicks "Edit" on section or bullet
- Inline editor appears
- User makes changes
- On save:
  - Validate changes
  - Update outline JSON
  - Preserve citations
  - Log edit in conversation as user action

**Constraints:**
- Preserve citation links during edits
- Maintain outline structure validity
- Auto-save every 30 seconds

---

### 4.4 Feature: Document Generation

**Description:** Convert outline to formatted Word or PowerPoint document

**DOCX Generation:**
1. Parse outline JSON
2. Create Word document structure
3. Add headings (Heading 1, 2, 3 styles)
4. Add subtitles (italic)
5. Add bullet points (list style)
6. Format citations (footnotes or endnotes)
7. Add page breaks between major sections
8. Generate table of contents
9. Save to file storage
10. Return download link

**PPTX Generation:**
1. Parse outline JSON
2. Create PowerPoint presentation
3. Title slide (entity name, date)
4. Each section heading = new slide
5. Subtitle becomes slide subtitle
6. Bullets populate slide body
7. Use simple template (blank)
8. Add slide numbers
9. Insert icons from public library if applicable
10. Save to file storage
11. Return download link

**Libraries:**
- DOCX: `officegen` or `docx` npm package
- PPTX: `pptxgenjs`

**Performance Target:** < 4 minutes

---

### 4.5 Feature: Review Workflow

**Description:** Manage multi-reviewer approval process

**Business Rules:**
1. Pursuit must be in "in_review" status
2. Minimum 2 approvals required
3. Any user can review (no role restrictions in MVP)
4. Internal pursuit owner shouldn't review own (soft rule)
5. If changes requested, other approvals remain valid
6. After 2+ approvals, status → "ready_for_submission"
7. Internal pursuit owner can mark as "submitted"

**Review States:**
- `pending` - Review not yet completed
- `approved` - Reviewer approved
- `changes_requested` - Reviewer requested changes

**Database Tracking:**
- `reviews` table stores all review records
- Query to check approval count before status change
- Audit log tracks status transitions

---

### 4.6 Feature: Quality Tagging

**Description:** Allow users to mark high-quality content

**Tag Types:**
- High Quality
- Exemplary
- Good Approach
- Well Written
- Effective

**Scope:**
- Entire pursuit
- Specific section (by section ID)

**Effects:**
- Increases pursuit's ranking in similarity search
- Visible to all users
- Tracked in analytics (most tagged pursuits)

**UI:**
- Tag badge on pursuit cards
- Tag count displayed
- Click to see who tagged and why

---

### 4.7 Feature: Analytics Dashboard

**Metrics:**

**Win Rate:**
- Overall: won / (won + lost)
- By Industry
- By Service Type
- By Technology
- By Internal Pursuit Owner

**Operational:**
- Total pursuits (all time, filtered period)
- Active pursuits count
- Pursuits by status breakdown
- Average time to completion (created → submitted)
- Average time to review (submitted → approved)

**Usage:**
- Most referenced pursuits (top 10)
- Most tagged pursuits (top 10)
- Pursuit volume over time (line chart)
- Service type distribution (pie chart)

**Filters:**
- Date range (preset and custom)
- Industry
- Service Type
- Technology
- Status
- Internal Owner

**Export:**
- CSV or Excel format
- Multiple sheets for different breakdowns
- Includes raw pursuit data and aggregations

---

## 5. Error Handling & Edge Cases

### 5.1 File Upload Errors

**Error:** File too large (> 15 MB)
- **UI:** Red error message below file
- **Action:** Prevent upload, show size limit
- **Message:** "File exceeds 15 MB limit. Please compress or split the file."

**Error:** Invalid file type
- **UI:** Red error message below file
- **Action:** Prevent upload, show accepted types
- **Message:** "Invalid file type. Please upload .pdf, .docx, or .pptx files."

**Error:** Text extraction failed
- **UI:** Warning icon on file card
- **Action:** Allow user to proceed with manual entry
- **Message:** "Unable to extract text from this file. You can proceed with manual requirements entry."

### 5.2 AI Service Errors

**Error:** Claude API timeout
- **UI:** Error modal with retry option
- **Action:** Save progress, allow retry
- **Message:** "Request timed out. Your progress has been saved. Would you like to retry?"

**Error:** Claude API rate limit
- **UI:** Informational message
- **Action:** Queue request, show estimated wait time
- **Message:** "Service is busy. Your request has been queued and will process in approximately 2 minutes."

**Error:** Claude API error (400/500)
- **UI:** Error message with support link
- **Action:** Log error, save pursuit state
- **Message:** "We encountered an error processing your request. Please try again or contact support if the issue persists."

### 5.3 Search Edge Cases

**Case:** No similar pursuits found
- **UI:** Empty state with helpful message
- **Action:** Allow user to proceed without references
- **Message:** "No similar pursuits found. You can proceed to generate an outline based solely on your RFP requirements, or adjust your search filters."

**Case:** Database empty (first pursuit)
- **UI:** Informational message
- **Action:** Explain and allow continuation
- **Message:** "Your pursuit repository is empty. Add historical pursuits to enable similarity search and improve AI recommendations."

### 5.4 Review Workflow Edge Cases

**Case:** User tries to review own pursuit
- **UI:** Warning message (soft restriction)
- **Action:** Allow but warn
- **Message:** "You are the internal pursuit owner. While you can review your own pursuit, it's recommended to have other team members review it."

**Case:** Pursuit updated after reviews submitted
- **UI:** Notification to reviewers
- **Action:** Reset reviews to "pending" (future), or keep existing (MVP)
- **MVP Action:** Keep existing approvals, show warning on pursuit detail

---

## 6. Non-Functional Requirements

### 6.1 Performance

- Page load time: < 2 seconds
- Search results: < 30 seconds
- Outline generation: ~15 min (target < 7 min)
- Document generation: ~6-7 min (target < 4 min)
- UI interactions: < 500ms response

### 6.2 Usability

- Intuitive navigation (< 3 clicks to any feature)
- Clear labels and instructions
- Helpful tooltips and hints
- Responsive feedback for all actions
- Graceful error handling

### 6.3 Reliability

- 99% uptime target
- Auto-save to prevent data loss
- Graceful degradation if AI unavailable
- Data integrity (no corruption/loss)

### 6.4 Scalability

- Support 10 concurrent users (MVP)
- Handle up to 100 pursuits in repository
- Scale to 50+ users post-MVP
- Database indexing for performance

### 6.5 Security

- Authentication required for all features
- HTTPS for all connections
- Input validation and sanitization
- SQL injection prevention
- XSS prevention
- File upload security

---

## Document Control

**Version:** 1.0
**Date:** 2025-11-04
**Status:** User Workflows Complete
**Next Phase:** Development Planning & Project Scaffolding
