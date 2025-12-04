# API Specification
# Pursuit Response Platform

**Version:** 1.0
**Date:** 2025-11-18
**Base URL:** `/api/v1`
**Framework:** FastAPI
**Protocol:** HTTP/HTTPS REST

---

## Table of Contents

1. [API Overview](#1-api-overview)
2. [Authentication](#2-authentication)
3. [Common Patterns](#3-common-patterns)
4. [User Endpoints](#4-user-endpoints)
5. [Pursuit Endpoints](#5-pursuit-endpoints)
6. [Search Endpoints](#6-search-endpoints)
7. [AI Generation Endpoints](#7-ai-generation-endpoints)
8. [Document Generation Endpoints](#8-document-generation-endpoints)
9. [Review Endpoints](#9-review-endpoints)
10. [Quality Tags Endpoints](#10-quality-tags-endpoints)
11. [Analytics Endpoints](#11-analytics-endpoints)
12. [Audit Log Endpoints](#12-audit-log-endpoints)
13. [Error Handling](#13-error-handling)
14. [Rate Limiting](#14-rate-limiting)
15. [Webhooks (Future)](#15-webhooks-future)

---

## 1. API Overview

### 1.1 Design Principles

- **RESTful**: Resource-oriented URLs, HTTP verbs for actions
- **Stateless**: No server-side session state (JWT authentication)
- **Versioned**: API version in URL path (`/api/v1`)
- **JSON**: All requests and responses use JSON (except file uploads)
- **Async**: FastAPI async/await for I/O-heavy operations
- **OpenAPI**: Auto-generated documentation at `/api/docs`

### 1.2 Base URL

```
Development:  http://localhost:8000/api/v1
Production:   https://pursuit.example.com/api/v1
```

### 1.3 Request/Response Format

**Request Headers:**
```http
Content-Type: application/json
Authorization: Bearer <JWT_TOKEN>
```

**Response Format:**
```json
{
  "data": { ... },           // Success response data
  "message": "Success",      // Human-readable message
  "timestamp": "2025-11-18T10:30:00Z"
}
```

**Error Response Format:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  },
  "timestamp": "2025-11-18T10:30:00Z"
}
```

---

## 2. Authentication

### 2.1 Login

**POST** `/auth/login`

**Description:** Authenticate user and receive JWT token

**Request:**
```json
{
  "email": "user@example.com",
  "password": "secure_password"
}
```

**Response:** `200 OK`
```json
{
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "bearer",
    "expires_in": 2592000,
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "full_name": "John Doe",
      "is_active": true
    }
  },
  "message": "Login successful"
}
```

**Errors:**
- `401 Unauthorized`: Invalid credentials
- `403 Forbidden`: Account inactive

---

### 2.2 Register (Admin Only - MVP)

**POST** `/auth/register`

**Description:** Create new user account (admin-only in MVP)

**Request:**
```json
{
  "email": "newuser@example.com",
  "password": "secure_password",
  "full_name": "Jane Smith",
  "phone": "+1-555-0123",
  "title": "Senior Consultant",
  "department": "Business Development"
}
```

**Response:** `201 Created`
```json
{
  "data": {
    "id": "uuid",
    "email": "newuser@example.com",
    "full_name": "Jane Smith",
    "is_active": true,
    "created_at": "2025-11-18T10:30:00Z"
  },
  "message": "User created successfully"
}
```

---

### 2.3 Get Current User

**GET** `/auth/me`

**Description:** Get authenticated user's profile

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "full_name": "John Doe",
    "phone": "+1-555-0123",
    "title": "Senior Manager",
    "department": "Business Development",
    "is_active": true,
    "created_at": "2025-01-15T09:00:00Z",
    "last_login_at": "2025-11-18T10:00:00Z"
  }
}
```

---

## 3. Common Patterns

### 3.1 Pagination

All list endpoints support pagination:

**Query Parameters:**
- `page` (integer, default: 1)
- `limit` (integer, default: 20, max: 100)

**Response:**
```json
{
  "data": {
    "items": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total_items": 150,
      "total_pages": 8
    }
  }
}
```

### 3.2 Filtering

**Query Parameters:**
- Field-specific filters (e.g., `status=draft`, `industry=Healthcare`)
- Multiple values: `status=draft,in_review` (comma-separated)
- Date ranges: `created_after=2025-01-01&created_before=2025-12-31`

### 3.3 Sorting

**Query Parameter:**
- `sort` (string, format: `field:order`)
- Example: `sort=created_at:desc`
- Multiple: `sort=status:asc,created_at:desc`

---

## 4. User Endpoints

### 4.1 List Users

**GET** `/users`

**Description:** Get list of all users (active)

**Query Parameters:**
- `page` (integer)
- `limit` (integer)
- `is_active` (boolean)
- `search` (string, searches name/email)

**Response:** `200 OK`
```json
{
  "data": {
    "items": [
      {
        "id": "uuid",
        "email": "user@example.com",
        "full_name": "John Doe",
        "title": "Senior Manager",
        "department": "Business Development",
        "is_active": true
      }
    ],
    "pagination": { ... }
  }
}
```

---

### 4.2 Get User

**GET** `/users/{user_id}`

**Description:** Get specific user details

**Response:** `200 OK`
```json
{
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "full_name": "John Doe",
    "phone": "+1-555-0123",
    "title": "Senior Manager",
    "department": "Business Development",
    "is_active": true,
    "created_at": "2025-01-15T09:00:00Z"
  }
}
```

---

## 5. Pursuit Endpoints

### 5.1 Create Pursuit

**POST** `/pursuits`

**Description:** Create new pursuit with initial metadata

**Request:**
```json
{
  "entity_name": "Acme Healthcare Corp",
  "client_pursuit_owner_name": "Sarah Johnson",
  "client_pursuit_owner_email": "sarah@acme.com",
  "internal_pursuit_owner_name": "John Doe",
  "internal_pursuit_owner_email": "john@firm.com",
  "industry": "Healthcare",
  "service_types": ["Engineering", "Data"],
  "technologies": ["Azure", "M365 Copilot"],
  "geography": "North America",
  "submission_due_date": "2025-12-15",
  "estimated_fees_usd": 500000,
  "expected_format": "pptx",
  "proposal_outline_framework": "Title Page\nTable of Contents\nWe Understand the Ask..."
}
```

**Response:** `201 Created`
```json
{
  "data": {
    "id": "uuid",
    "entity_name": "Acme Healthcare Corp",
    "status": "draft",
    "current_stage": "metadata_entry",
    "progress_percentage": 10,
    "created_at": "2025-11-18T10:30:00Z"
  },
  "message": "Pursuit created successfully"
}
```

---

### 5.2 Upload RFP Files

**POST** `/pursuits/{pursuit_id}/files`

**Description:** Upload RFP documents (multipart/form-data)

**Content-Type:** `multipart/form-data`

**Form Fields:**
- `files` (file[], max 10 files)
- `file_type` (string: "rfp" | "rfp_appendix" | "additional_reference")

**Response:** `201 Created`
```json
{
  "data": {
    "files": [
      {
        "id": "uuid",
        "file_name": "RFP_Acme_Healthcare.pdf",
        "file_type": "rfp",
        "file_size_bytes": 5242880,
        "extraction_status": "pending",
        "uploaded_at": "2025-11-18T10:35:00Z"
      }
    ]
  },
  "message": "Files uploaded successfully. Text extraction in progress."
}
```

---

### 5.3 List Reference Documents

**GET** `/pursuits/{pursuit_id}/references`

**Description:** List all additional reference documents for a pursuit

**Response:** `200 OK`
```json
{
  "data": {
    "references": [
      {
        "id": "uuid",
        "file_name": "Company_Case_Studies_2024.pdf",
        "file_type": "additional_reference",
        "file_size_bytes": 3355443,
        "extraction_status": "completed",
        "uploaded_at": "2025-11-18T11:00:00Z"
      }
    ],
    "total_count": 2,
    "total_size_bytes": 5242880,
    "max_allowed": 10
  }
}
```

---

### 5.4 Delete Reference Document

**DELETE** `/pursuits/{pursuit_id}/references/{file_id}`

**Description:** Remove an additional reference document from a pursuit

**Response:** `200 OK`
```json
{
  "message": "Reference document deleted successfully",
  "data": {
    "remaining_references": 1
  }
}
```

**Error Response:** `404 Not Found`
```json
{
  "error": {
    "code": "REFERENCE_NOT_FOUND",
    "message": "Reference document not found"
  }
}
```

---

### 5.5 Get Pursuit

**GET** `/pursuits/{pursuit_id}`

**Description:** Get complete pursuit details

**Query Parameters:**
- `include` (string[], optional): `files`, `reviews`, `references`, `citations`
- Example: `/pursuits/{id}?include=files,reviews`

**Response:** `200 OK`
```json
{
  "data": {
    "id": "uuid",
    "entity_name": "Acme Healthcare Corp",
    "client_pursuit_owner_name": "Sarah Johnson",
    "client_pursuit_owner_email": "sarah@acme.com",
    "internal_pursuit_owner_name": "John Doe",
    "internal_pursuit_owner_email": "john@firm.com",
    "industry": "Healthcare",
    "service_types": ["Engineering", "Data"],
    "technologies": ["Azure", "M365 Copilot"],
    "geography": "North America",
    "submission_due_date": "2025-12-15",
    "estimated_fees_usd": 500000.00,
    "expected_format": "pptx",
    "status": "draft",
    "current_stage": "outline_editing",
    "progress_percentage": 70,
    "requirements_text": "Full extracted text...",
    "outline_json": { ... },
    "conversation_history": [ ... ],
    "created_at": "2025-11-18T10:30:00Z",
    "updated_at": "2025-11-18T11:45:00Z",
    "files": [ ... ],      // if include=files
    "reviews": [ ... ],    // if include=reviews
    "references": [ ... ]  // if include=references
  }
}
```

---

### 5.6 Update Pursuit

**PATCH** `/pursuits/{pursuit_id}`

**Description:** Update pursuit metadata or content

**Request:**
```json
{
  "industry": "Financial Services",
  "estimated_fees_usd": 750000,
  "outline_json": { ... },
  "current_stage": "outline_editing",
  "progress_percentage": 70
}
```

**Response:** `200 OK`
```json
{
  "data": {
    "id": "uuid",
    "entity_name": "Acme Healthcare Corp",
    "industry": "Financial Services",
    "estimated_fees_usd": 750000.00,
    "updated_at": "2025-11-18T12:00:00Z"
  },
  "message": "Pursuit updated successfully"
}
```

---

### 5.7 List Pursuits

**GET** `/pursuits`

**Description:** Get list of pursuits with filters

**Query Parameters:**
- `status` (string[], comma-separated)
- `industry` (string[])
- `service_types` (string[], matches ANY)
- `technologies` (string[], matches ANY)
- `internal_owner_id` (uuid)
- `created_after` (date)
- `created_before` (date)
- `page` (integer)
- `limit` (integer)
- `sort` (string)

**Example:**
```
GET /pursuits?status=draft,in_review&industry=Healthcare&sort=created_at:desc&page=1&limit=20
```

**Response:** `200 OK`
```json
{
  "data": {
    "items": [
      {
        "id": "uuid",
        "entity_name": "Acme Healthcare Corp",
        "industry": "Healthcare",
        "service_types": ["Engineering", "Data"],
        "status": "draft",
        "current_stage": "outline_editing",
        "progress_percentage": 70,
        "internal_pursuit_owner_name": "John Doe",
        "submission_due_date": "2025-12-15",
        "created_at": "2025-11-18T10:30:00Z",
        "updated_at": "2025-11-18T11:45:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total_items": 42,
      "total_pages": 3
    }
  }
}
```

---

### 5.8 Delete Pursuit (Soft Delete)

**DELETE** `/pursuits/{pursuit_id}`

**Description:** Soft delete pursuit (is_deleted = true)

**Response:** `204 No Content`

---

### 5.9 Check Concurrent Session

**GET** `/pursuits/{pursuit_id}/check-session`

**Description:** Detect if pursuit is being edited in another browser session (for concurrent edit prevention)

**Query Parameters:**
- `session_id` (string, required): Unique identifier for current browser session (UUID)

**Response:** `200 OK`
```json
{
  "warning": false,
  "message": null
}
```

**Response (Concurrent Edit Detected):** `200 OK`
```json
{
  "warning": true,
  "message": "This pursuit is currently open in another browser tab or session.",
  "last_edited_by": "uuid",
  "last_edited_at": "2025-11-18T12:00:00Z"
}
```

---

## 6. Search Endpoints

### 6.1 Search Similar Pursuits

**POST** `/search/similar`

**Description:** Find similar past pursuits using vector search + weighted ranking

**Request:**
```json
{
  "pursuit_id": "uuid",              // Or provide text directly
  "requirements_text": "Optional text if no pursuit_id",
  "metadata_filters": {
    "industry": "Healthcare",
    "service_types": ["Engineering"],
    "technologies": ["Azure"]
  },
  "limit": 10
}
```

**Response:** `200 OK`
```json
{
  "data": {
    "results": [
      {
        "pursuit_id": "uuid",
        "entity_name": "Beta Healthcare System",
        "industry": "Healthcare",
        "service_types": ["Engineering", "Risk"],
        "technologies": ["Azure", "ServiceNow"],
        "status": "won",
        "estimated_fees_usd": 450000.00,
        "submitted_at": "2025-06-15T00:00:00Z",
        "similarity_score": 0.92,
        "match_explanation": {
          "vector_similarity": 0.88,
          "metadata_match": 0.60,
          "quality_score": 0.15,
          "win_status": 1.0,
          "recency": 0.75
        },
        "quality_tags_count": 3
      }
    ],
    "search_metadata": {
      "query_embedding_generated": true,
      "total_candidates": 247,
      "filtered_to": 10
    }
  }
}
```

---

### 6.2 Manual Search

**GET** `/search/pursuits`

**Description:** Manual search with advanced filters

**Query Parameters:**
- `q` (string, keyword search)
- `industry` (string[])
- `service_types` (string[])
- `technologies` (string[])
- `status` (string[])
- `win_status` (string: "won" | "lost")
- `quality_tagged` (boolean)
- `date_from` (date)
- `date_to` (date)
- `fees_min` (number)
- `fees_max` (number)
- `page`, `limit`, `sort`

**Example:**
```
GET /search/pursuits?q=healthcare&industry=Healthcare&quality_tagged=true&sort=created_at:desc
```

**Response:** Same format as List Pursuits

---

## 7. AI Generation Endpoints

### 7.1 Generate Outline (Async)

**POST** `/pursuits/{pursuit_id}/generate-outline`

**Description:** Trigger AI outline generation using custom 7-agent sequential workflow with HITL

**Request:**
```json
{
  "reference_pursuit_ids": [
    "uuid1", "uuid2", "uuid3"
  ]
}
```

**Response:** `202 Accepted`
```json
{
  "data": {
    "task_id": "celery-task-uuid",
    "status": "pending",
    "message": "Outline generation started. Use task_id to poll status."
  }
}
```

**Custom Sequential Workflow:**
The backend uses a custom sequential workflow to orchestrate four agents:

1.  **Metadata Extraction Agent:** Extracts key entities from RFP.
2.  **Gap Analysis Agent:** Identifies missing info & capabilities.
3.  **Web Research Agent:** Finds external info to fill gaps.
4.  **Synthesis Agent:** Generates comprehensive outline.

**Features:**
- Checkpointing: Workflow can resume from last completed agent if interrupted
- Streaming: Progress updates streamed via Server-Sent Events (optional)
- Error Handling: Automatic retries with exponential backoff for transient failures

**Poll Status:** See [Task Status Endpoint](#73-get-task-status)

---

### 7.2 Refine Outline (Chat)

**POST** `/pursuits/{pursuit_id}/refine-outline`

**Description:** Iterative outline refinement via chat

**Request:**
```json
{
  "message": "Add more healthcare case studies to the Technical Approach section",
  "context": {
    "section_id": "uuid-optional"
  }
}
```

**Response:** `200 OK` (with streaming support)
```json
{
  "data": {
    "response": "I've added 2 healthcare case studies to the Technical Approach section, citing from the Acme Healthcare pursuit.",
    "outline_updates": {
      "section_id": "uuid",
      "bullets_added": [
        {
          "id": "uuid",
          "text": "Completed 15+ healthcare data migration projects...",
          "citations": ["citation-uuid-1"]
        }
      ]
    },
    "updated_outline_json": { ... },
    "conversation_entry_id": "uuid"
  }
}
```

**Streaming Option:**
```http
GET /pursuits/{pursuit_id}/refine-outline/stream?message=...
Accept: text/event-stream
```

**Server-Sent Events:**
```
data: {"type": "thinking", "content": ""}
data: {"type": "text", "content": "I've added"}
data: {"type": "text", "content": " 2 healthcare"}
data: {"type": "done", "outline_updates": {...}}
```

---

### 7.3 Get Task Status

**GET** `/tasks/{task_id}`

**Description:** Get status of background task (outline generation, document generation)

**Response:** `200 OK`

**When Pending (AI agent running):**
```json
{
  "data": {
    "task_id": "uuid",
    "status": "PROGRESS",
    "current_step": 2,
    "total_steps": 4,
    "current_agent": "gap_analysis",
    "message": "Analyzing RFP requirements...",
    "progress_percentage": 50,
    "agent_metadata": {
      "current_agent": "metadata_extraction",
      "step": 1,
      "total_steps": 4,
      "status": "Extracting metadata from RFP..."
    }
  }
}
```

**When Complete:**
```json
{
  "data": {
    "task_id": "uuid",
    "status": "SUCCESS",
    "result": {
      "pursuit_id": "uuid",
      "outline_json": { ... },
      "gap_report": { ... }
    },
    "execution_metadata": {
      "total_duration_seconds": 182,
      "agents_executed": ["gap_analysis", "research", "synthesis"],
      "checkpoints_created": 3
    }
  }
}
```

**When Failed:**
```json
{
  "data": {
    "task_id": "uuid",
    "status": "FAILURE",
    "error": {
      "type": "AnthropicAPIError",
      "message": "API rate limit exceeded",
      "failed_agent": "synthesis",
      "can_retry": true
    },
    "langgraph_metadata": {
      "thread_id": "uuid",
      "last_checkpoint_id": "uuid",
      "completed_agents": ["gap_analysis", "research"]
    }
  }
}
```

**Streaming Option (Server-Sent Events):**

For real-time progress updates during workflow execution:

```http
GET /tasks/{task_id}/stream
Accept: text/event-stream
```

**Event Stream Format:**
```
event: agent_start
data: {"agent": "gap_analysis", "step": 1, "total_steps": 3}

event: agent_progress
data: {"agent": "gap_analysis", "message": "Analyzing requirements..."}

event: agent_complete
data: {"agent": "gap_analysis", "duration_seconds": 28}

event: agent_start
data: {"agent": "research", "step": 2, "total_steps": 3}

event: task_complete
data: {"status": "SUCCESS", "result": {...}}
```

---

## 8. Document Generation Endpoints

### 8.1 Generate Document (Async)

**POST** `/pursuits/{pursuit_id}/generate-document`

**Description:** Generate DOCX or PPTX from outline

**Request:**
```json
{
  "format": "pptx"  // or "docx"
}
```

**Response:** `202 Accepted`
```json
{
  "data": {
    "task_id": "celery-task-uuid",
    "status": "pending",
    "message": "Document generation started"
  }
}
```

**Poll Status:** Use `/tasks/{task_id}` endpoint

---

### 8.2 Download Document

**GET** `/pursuits/{pursuit_id}/document/{file_id}`

**Description:** Download generated document

**Response:** `200 OK`
```http
Content-Type: application/vnd.openxmlformats-officedocument.presentationml.presentation
Content-Disposition: attachment; filename="Acme_Healthcare_Proposal.pptx"

<binary file data>
```

---

## 9. Review Endpoints

### 9.1 Submit for Review

**POST** `/pursuits/{pursuit_id}/submit-for-review`

**Description:** Change pursuit status to "in_review"

**Request:** (empty body or optional message)
```json
{
  "message": "Ready for review"
}
```

**Response:** `200 OK`
```json
{
  "data": {
    "pursuit_id": "uuid",
    "status": "in_review",
    "submitted_at": "2025-11-18T15:00:00Z"
  },
  "message": "Pursuit submitted for review"
}
```

---

### 9.2 List Pending Reviews

**GET** `/reviews/pending`

**Description:** Get pursuits needing review by current user

**Query Parameters:**
- `page`, `limit`, `sort`

**Response:** `200 OK`
```json
{
  "data": {
    "items": [
      {
        "pursuit_id": "uuid",
        "entity_name": "Acme Healthcare Corp",
        "industry": "Healthcare",
        "internal_pursuit_owner_name": "John Doe",
        "submitted_at": "2025-11-18T15:00:00Z",
        "approval_count": 1,
        "changes_requested_count": 0
      }
    ],
    "pagination": { ... }
  }
}
```

---

### 9.3 Submit Review

**POST** `/reviews`

**Description:** Submit review decision for pursuit

**Request:**
```json
{
  "pursuit_id": "uuid",
  "status": "approved",  // or "changes_requested"
  "feedback": "Optional feedback text"
}
```

**Response:** `201 Created`
```json
{
  "data": {
    "review_id": "uuid",
    "pursuit_id": "uuid",
    "reviewer_id": "uuid",
    "status": "approved",
    "feedback": "Looks great!",
    "reviewed_at": "2025-11-18T16:00:00Z",
    "pursuit_status_updated": "ready_for_submission"
  },
  "message": "Review submitted. Pursuit now has 2 approvals and is ready for submission."
}
```

---

### 9.4 Get Reviews for Pursuit

**GET** `/pursuits/{pursuit_id}/reviews`

**Description:** Get all reviews for specific pursuit

**Response:** `200 OK`
```json
{
  "data": {
    "reviews": [
      {
        "id": "uuid",
        "reviewer": {
          "id": "uuid",
          "full_name": "Jane Smith",
          "title": "Principal Consultant"
        },
        "status": "approved",
        "feedback": "Technical approach is solid",
        "reviewed_at": "2025-11-18T14:30:00Z"
      },
      {
        "id": "uuid",
        "reviewer": {
          "id": "uuid",
          "full_name": "Bob Johnson",
          "title": "Partner"
        },
        "status": "changes_requested",
        "feedback": "Add more details on implementation timeline",
        "reviewed_at": "2025-11-18T15:15:00Z"
      }
    ],
    "summary": {
      "total_reviews": 2,
      "approved_count": 1,
      "changes_requested_count": 1,
      "ready_for_submission": false
    }
  }
}
```

---

## 10. Quality Tags Endpoints

### 10.1 Add Quality Tag

**POST** `/quality-tags`

**Description:** Add quality marker to pursuit

**Request:**
```json
{
  "pursuit_id": "uuid",
  "tag_type": "high_quality",
  "section_reference": "Technical Approach",
  "notes": "Excellent use of healthcare case studies"
}
```

**Response:** `201 Created`
```json
{
  "data": {
    "id": "uuid",
    "pursuit_id": "uuid",
    "tagged_by_user_id": "uuid",
    "tag_type": "high_quality",
    "section_reference": "Technical Approach",
    "notes": "Excellent use of healthcare case studies",
    "created_at": "2025-11-18T17:00:00Z"
  },
  "message": "Quality tag added successfully"
}
```

---

### 10.2 Get Tags for Pursuit

**GET** `/pursuits/{pursuit_id}/quality-tags`

**Response:** `200 OK`
```json
{
  "data": {
    "tags": [
      {
        "id": "uuid",
        "tag_type": "high_quality",
        "tagged_by": {
          "id": "uuid",
          "full_name": "Jane Smith"
        },
        "section_reference": "Technical Approach",
        "notes": "Excellent case studies",
        "created_at": "2025-11-18T17:00:00Z"
      }
    ],
    "summary": {
      "total_tags": 3,
      "unique_taggers": 2,
      "tag_breakdown": {
        "high_quality": 2,
        "exemplary": 1
      }
    }
  }
}
```

---

## 11. Analytics Endpoints

### 11.1 Get Dashboard Metrics

**GET** `/analytics/dashboard`

**Description:** Get key metrics for analytics dashboard

**Query Parameters:**
- `date_from` (date, default: 30 days ago)
- `date_to` (date, default: today)
- `industry` (string[], optional filter)
- `service_types` (string[], optional filter)

**Response:** `200 OK`
```json
{
  "data": {
    "win_rate": {
      "overall": 0.652,
      "by_industry": [
        {"industry": "Healthcare", "win_rate": 0.72, "total": 25},
        {"industry": "Financial Services", "win_rate": 0.61, "total": 18}
      ],
      "by_service_type": [
        {"service_type": "Engineering", "win_rate": 0.68, "total": 30},
        {"service_type": "Risk", "win_rate": 0.59, "total": 22}
      ]
    },
    "operational": {
      "total_pursuits": 150,
      "active_pursuits": 8,
      "avg_time_to_completion_days": 4.2,
      "pursuits_by_status": {
        "draft": 3,
        "in_review": 2,
        "submitted": 3,
        "won": 98,
        "lost": 52
      }
    },
    "usage": {
      "most_referenced": [
        {
          "pursuit_id": "uuid",
          "entity_name": "Beta Healthcare",
          "reference_count": 15
        }
      ],
      "most_tagged": [
        {
          "pursuit_id": "uuid",
          "entity_name": "Gamma Financial",
          "tag_count": 5
        }
      ]
    }
  }
}
```

---

### 11.2 Export Analytics Data

**POST** `/analytics/export`

**Description:** Generate Excel export of analytics data

**Request:**
```json
{
  "date_from": "2025-01-01",
  "date_to": "2025-11-18",
  "include_sheets": [
    "pursuit_list",
    "industry_breakdown",
    "service_type_breakdown",
    "reference_analytics"
  ]
}
```

**Response:** `202 Accepted`
```json
{
  "data": {
    "task_id": "uuid",
    "message": "Export generation started"
  }
}
```

**After Completion:**

**GET** `/analytics/export/{task_id}/download`

**Response:** `200 OK`
```http
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="analytics_2025-11-18.xlsx"

<binary file data>
```

---

### 11.3 Get Trend Data

**GET** `/analytics/trends`

**Description:** Get pursuit volume and win rate trends over time

**Query Parameters:**
- `date_from` (date)
- `date_to` (date)
- `interval` (string: "day" | "week" | "month")
- `industry` (string[], optional)

**Response:** `200 OK`
```json
{
  "data": {
    "trends": [
      {
        "date": "2025-10-01",
        "total_pursuits": 12,
        "won": 8,
        "lost": 4,
        "win_rate": 0.667
      },
      {
        "date": "2025-11-01",
        "total_pursuits": 15,
        "won": 10,
        "lost": 5,
        "win_rate": 0.667
      }
    ],
    "aggregates": {
      "total_pursuits": 27,
      "total_won": 18,
      "total_lost": 9,
      "overall_win_rate": 0.667
    }
  }
}
```

---

## 12. Audit Log Endpoints

### 12.1 Get Audit Logs

**GET** `/audit-logs`

**Description:** Get audit trail (admin/compliance)

**Query Parameters:**
- `user_id` (uuid)
- `pursuit_id` (uuid)
- `action` (string)
- `entity_type` (string)
- `date_from` (datetime)
- `date_to` (datetime)
- `page`, `limit`

**Response:** `200 OK`
```json
{
  "data": {
    "items": [
      {
        "id": "uuid",
        "user": {
          "id": "uuid",
          "full_name": "John Doe"
        },
        "action": "update_pursuit",
        "entity_type": "pursuit",
        "entity_id": "uuid",
        "details": {
          "fields_changed": ["outline_json", "progress_percentage"],
          "old_values": {...},
          "new_values": {...}
        },
        "ip_address": "192.168.1.100",
        "created_at": "2025-11-18T12:00:00Z"
      }
    ],
    "pagination": { ... }
  }
}
```

---

## 13. Error Handling

### 13.1 Error Response Format

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": [ ... ]  // Optional array of field-specific errors
  },
  "timestamp": "2025-11-18T10:30:00Z"
}
```

### 13.2 HTTP Status Codes

| Status Code | Meaning | Usage |
|-------------|---------|-------|
| 200 OK | Success | Successful GET, PATCH, PUT |
| 201 Created | Resource created | Successful POST |
| 202 Accepted | Async task started | Background job initiated |
| 204 No Content | Success, no body | Successful DELETE |
| 400 Bad Request | Validation error | Invalid input data |
| 401 Unauthorized | Not authenticated | Missing/invalid JWT token |
| 403 Forbidden | Not authorized | Insufficient permissions |
| 404 Not Found | Resource not found | Invalid resource ID |
| 409 Conflict | Resource conflict | Duplicate email, etc. |
| 422 Unprocessable Entity | Semantic error | Business logic violation |
| 429 Too Many Requests | Rate limit exceeded | Too many requests |
| 500 Internal Server Error | Server error | Unexpected server error |
| 503 Service Unavailable | Service down | External API unavailable |

### 13.3 Common Error Codes

```typescript
enum ErrorCode {
  // Validation Errors (400)
  VALIDATION_ERROR = "VALIDATION_ERROR",
  INVALID_INPUT = "INVALID_INPUT",
  MISSING_REQUIRED_FIELD = "MISSING_REQUIRED_FIELD",

  // Authentication Errors (401)
  INVALID_CREDENTIALS = "INVALID_CREDENTIALS",
  TOKEN_EXPIRED = "TOKEN_EXPIRED",
  TOKEN_INVALID = "TOKEN_INVALID",

  // Authorization Errors (403)
  INSUFFICIENT_PERMISSIONS = "INSUFFICIENT_PERMISSIONS",
  ACCOUNT_INACTIVE = "ACCOUNT_INACTIVE",

  // Resource Errors (404)
  RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND",
  PURSUIT_NOT_FOUND = "PURSUIT_NOT_FOUND",
  USER_NOT_FOUND = "USER_NOT_FOUND",

  // Business Logic Errors (422)
  PURSUIT_ALREADY_SUBMITTED = "PURSUIT_ALREADY_SUBMITTED",
  INSUFFICIENT_APPROVALS = "INSUFFICIENT_APPROVALS",
  INVALID_STATUS_TRANSITION = "INVALID_STATUS_TRANSITION",

  // External Service Errors (503)
  ANTHROPIC_API_ERROR = "ANTHROPIC_API_ERROR",
  OPENAI_API_ERROR = "OPENAI_API_ERROR",
  SEARCH_API_ERROR = "SEARCH_API_ERROR",

  // File Errors
  FILE_TOO_LARGE = "FILE_TOO_LARGE",
  INVALID_FILE_TYPE = "INVALID_FILE_TYPE",
  TEXT_EXTRACTION_FAILED = "TEXT_EXTRACTION_FAILED",
}
```

### 13.4 Validation Error Example

**Request:** `POST /pursuits` with missing required fields

**Response:** `400 Bad Request`
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      {
        "field": "entity_name",
        "message": "Field required"
      },
      {
        "field": "industry",
        "message": "Field required"
      },
      {
        "field": "service_types",
        "message": "At least one service type required"
      }
    ]
  },
  "timestamp": "2025-11-18T10:30:00Z"
}
```

---

## 14. Rate Limiting

### 14.1 Rate Limit Headers

All responses include rate limit headers:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1700316000
```

### 14.2 Rate Limits

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| Authentication | 5 requests | 15 minutes |
| File Upload | 20 requests | 1 hour |
| AI Generation | 10 requests | 1 hour |
| Standard API | 100 requests | 1 minute |

### 14.3 Rate Limit Exceeded

**Response:** `429 Too Many Requests`
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Try again in 45 seconds.",
    "retry_after": 45
  },
  "timestamp": "2025-11-18T10:30:00Z"
}
```

---

## 15. Webhooks (Future)

### 15.1 Webhook Events (Post-MVP)

Future webhook support for:
- `pursuit.created`
- `pursuit.submitted`
- `pursuit.approved`
- `outline.generated`
- `document.generated`
- `review.submitted`

**Webhook Payload:**
```json
{
  "event": "pursuit.submitted",
  "data": {
    "pursuit_id": "uuid",
    "entity_name": "Acme Healthcare",
    "submitted_by": "uuid",
    "submitted_at": "2025-11-18T15:00:00Z"
  },
  "webhook_id": "uuid",
  "timestamp": "2025-11-18T15:00:01Z"
}
```

---

## Appendix A: Pydantic Schemas

### A.1 Request Schemas

```python
# app/schemas/pursuit.py
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional
from datetime import date
from decimal import Decimal

class PursuitCreate(BaseModel):
    entity_name: str = Field(..., min_length=1, max_length=255)
    client_pursuit_owner_name: Optional[str] = None
    client_pursuit_owner_email: Optional[EmailStr] = None
    internal_pursuit_owner_name: str
    internal_pursuit_owner_email: EmailStr
    industry: str = Field(..., min_length=1, max_length=100)
    service_types: List[str] = Field(..., min_items=1)
    technologies: Optional[List[str]] = None
    geography: Optional[str] = None
    submission_due_date: Optional[date] = None
    estimated_fees_usd: Optional[Decimal] = None
    expected_format: str = Field(..., pattern="^(docx|pptx)$")
    proposal_outline_framework: Optional[str] = None

class PursuitUpdate(BaseModel):
    entity_name: Optional[str] = None
    industry: Optional[str] = None
    service_types: Optional[List[str]] = None
    technologies: Optional[List[str]] = None
    estimated_fees_usd: Optional[Decimal] = None
    outline_json: Optional[dict] = None
    current_stage: Optional[str] = None
    progress_percentage: Optional[int] = Field(None, ge=0, le=100)
```

### A.2 Response Schemas

```python
# app/schemas/pursuit.py
from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
from uuid import UUID

class PursuitResponse(BaseModel):
    id: UUID
    entity_name: str
    industry: str
    service_types: List[str]
    technologies: Optional[List[str]]
    status: str
    current_stage: Optional[str]
    progress_percentage: int
    internal_pursuit_owner_name: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True  # SQLAlchemy ORM mode
```

---

## Appendix B: FastAPI Route Implementation Examples

### B.1 Create Pursuit Endpoint

```python
# app/api/v1/pursuits.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.schemas.pursuit import PursuitCreate, PursuitResponse
from app.services.pursuit_service import PursuitService
from app.models.user import User

router = APIRouter()

@router.post("/", response_model=PursuitResponse, status_code=status.HTTP_201_CREATED)
async def create_pursuit(
    pursuit_data: PursuitCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create new pursuit with initial metadata
    """
    pursuit_service = PursuitService(db)
    pursuit = await pursuit_service.create_pursuit(pursuit_data, current_user.id)

    # Log audit event
    await pursuit_service.log_audit(
        user_id=current_user.id,
        action="create_pursuit",
        entity_type="pursuit",
        entity_id=pursuit.id,
        details={"entity_name": pursuit.entity_name}
    )

    return pursuit
```

### B.2 Search Similar Pursuits

```python
# app/api/v1/search.py
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.schemas.search import SimilarSearchRequest, SimilarSearchResponse
from app.services.search_service import SearchService

router = APIRouter()

@router.post("/similar", response_model=SimilarSearchResponse)
async def search_similar_pursuits(
    search_request: SimilarSearchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Find similar past pursuits using vector search + weighted ranking
    """
    search_service = SearchService(db)
    results = await search_service.find_similar(
        pursuit_id=search_request.pursuit_id,
        requirements_text=search_request.requirements_text,
        metadata_filters=search_request.metadata_filters,
        limit=search_request.limit or 10
    )

    return {
        "results": results,
        "search_metadata": {
            "query_embedding_generated": True,
            "total_candidates": len(results),
            "filtered_to": search_request.limit or 10
        }
    }
```

---


**Checkpoint Creation:**
- After each agent completes, a checkpoint is saved to the database
- Checkpoint contains full agent state + execution metadata
- Thread ID links checkpoints for a single workflow execution

**Resume Capability:**
```python
# If workflow fails at synthesis agent
workflow.invoke(
    state,
    config={"configurable": {"thread_id": thread_id}}
)
# Automatically resumes from last checkpoint (after research agent)
```

**API Behavior:**
- If client receives `FAILURE` status with `can_retry: true`
- Retry request with same `task_id` resumes from last checkpoint
- Avoids re-executing expensive agents (Gap Analysis, Research)

### C.5 Streaming Integration

The custom workflow supports event streaming for real-time progress updates:

**Backend Implementation:**
```python
async for event in workflow.astream_events(state, version="v1"):
    if event["event"] == "on_chat_model_start":
        await emit_sse({"type": "agent_start", "agent": current_agent})
    elif event["event"] == "on_chat_model_stream":
        await emit_sse({"type": "agent_progress", "content": chunk})
    elif event["event"] == "on_chat_model_end":
        await emit_sse({"type": "agent_complete", "agent": current_agent})
```

**Frontend Integration:**
```javascript
const eventSource = new EventSource(`/api/v1/tasks/${taskId}/stream`);

eventSource.addEventListener('agent_start', (event) => {
  const data = JSON.parse(event.data);
  updateProgress(data.agent, data.step, data.total_steps);
});

eventSource.addEventListener('agent_complete', (event) => {
  const data = JSON.parse(event.data);
  markAgentComplete(data.agent, data.duration_seconds);
});

eventSource.addEventListener('task_complete', (event) => {
  const data = JSON.parse(event.data);
  handleCompletion(data.result);
  eventSource.close();
});
```

### C.6 Error Handling

The custom workflow includes comprehensive error handling:

**Retry Logic:**
```python
# Automatic retries for transient errors
@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=4, max=10),
    retry=retry_if_exception_type(AnthropicAPIError)
)
async def gap_analysis_agent(state: PursuitAgentState) -> Dict:
    # Agent implementation
```

**Error Recovery:**
- Transient failures (API rate limits): Automatic retry with exponential backoff
- Partial failures: Checkpoint system allows resume from last successful agent
- Permanent failures: Return error details with `can_retry: false`

**API Error Response:**
```json
{
  "error": {
    "type": "AnthropicAPIError",
    "message": "API rate limit exceeded",
    "failed_agent": "synthesis",
    "can_retry": true
  },
  "langgraph_metadata": {
    "completed_agents": ["gap_analysis", "research"],
    "last_checkpoint_id": "uuid"
  }
}
```

### C.7 Implementation References

For complete implementation details, see:

- **backend-requirements.txt** - Python dependenciestion 7.2 "AI Service Integration Points"
- **backend-requirements.txt** - LangGraph dependencies

---

## Document Control

**Version:** 1.1
**Date:** 2025-11-18
**Status:** API Specification Complete
**Framework:** FastAPI
**Agent Framework:** Custom (Direct API)
**OpenAPI Docs:** `/api/docs`
