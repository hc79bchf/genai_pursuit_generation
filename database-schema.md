# Database Schema Specification
# Pursuit Response Platform

**Version:** 1.0
**Date:** 2025-11-18
**Database:** PostgreSQL 15+
**Vector Database:** ChromaDB
**ORM:** SQLAlchemy 2.x (Async)

---

## Table of Contents

1. [Schema Overview](#1-schema-overview)
2. [Database Configuration](#2-database-configuration)
3. [Table Definitions](#3-table-definitions)
4. [Relationships & Foreign Keys](#4-relationships--foreign-keys)
5. [Indexes](#5-indexes)
6. [Constraints & Validation](#6-constraints--validation)
7. [Migrations](#7-migrations)
8. [Sample Queries](#8-sample-queries)

---

## 1. Schema Overview

### 1.1 Entity-Relationship Diagram

```
┌─────────────┐
│    users    │
└──────┬──────┘
       │
       │ 1:N (created_by)
       │
┌──────▼──────────────────────────────────────────────────────┐
│                        pursuits                              │
│  - Core pursuit entity with metadata                        │
│  - Contains JSONB fields for flexible data                  │
│  - Vector embedding for similarity search                   │
└──┬────┬─────┬─────┬──────┬──────┬──────────────────────────┘
   │    │     │     │      │      │
   │1:N │1:N  │1:N  │1:N   │1:N   │1:N
   │    │     │     │      │      │
   │    │     │     │      │      └───────────────────┐
   │    │     │     │      │                          │
┌──▼────────┐│     │      │                    ┌─────▼────────┐
│ pursuit_  ││     │      │                    │ audit_logs   │
│   files   ││     │      │                    │              │
└───────────┘│     │      │                    └──────────────┘
             │     │      │
       ┌─────▼────────┐  │                    ┌───────────────┐
       │ pursuit_     │  │                    │  citations    │
       │ references   │  │                    │               │
       │              │  │                    └───────┬───────┘
       └──────────────┘  │                            │
                         │                            │
                  ┌──────▼─────────┐          ┌──────▼────────┐
                  │   reviews      │          │ quality_tags  │
                  │                │          │               │
                  └────────┬───────┘          └───────────────┘
                           │
                           │ N:1 (reviewer)
                           │
                  ┌────────▼───────┐
                  │     users      │
                  │                │
                  └────────────────┘
```

### 1.2 Table Summary

| Table | Purpose | Row Estimate (1 Year) |
|-------|---------|----------------------|
| users | User accounts and authentication | ~50 |
| pursuits | Core pursuit records | ~500 |
| pursuit_files | Uploaded files (RFPs, documents) | ~2,000 |
| pursuit_references | Links between pursuits | ~1,500 |
| quality_tags | User-applied quality markers | ~300 |
| reviews | Approval workflow records | ~1,000 |
| citations | Source citations for AI content | ~5,000 |
| audit_logs | Audit trail for compliance | ~20,000 |
| pursuit_metrics | Pre-aggregated analytics | ~1,000 |

---

## 2. Database Configuration

### 2.1 PostgreSQL Extensions

```sql
-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable full-text search (future)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

### 2.2 Database Settings

```sql
-- PostgreSQL configuration recommendations
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '128MB';
ALTER SYSTEM SET work_mem = '16MB';
ALTER SYSTEM SET max_connections = 100;

-- Enable auto-vacuum
ALTER SYSTEM SET autovacuum = on;
ALTER SYSTEM SET autovacuum_naptime = '1min';
```

### 2.3 Connection String

```
# Development
postgresql+asyncpg://pursuit_user:pursuit_pass@localhost:5432/pursuit_db

# Production
postgresql+asyncpg://pursuit_user:${DB_PASSWORD}@db.example.com:5432/pursuit_db?ssl=require
```

---

## 3. Table Definitions

### 3.1 users

**Purpose:** User accounts and authentication

```sql
CREATE TABLE users (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Authentication
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,

    -- Profile
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    title VARCHAR(100),
    department VARCHAR(100),

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_superuser BOOLEAN NOT NULL DEFAULT false,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP WITH TIME ZONE,

    -- Soft Delete
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_users_email ON users(email) WHERE is_deleted = false;
CREATE INDEX idx_users_is_active ON users(is_active) WHERE is_deleted = false;

COMMENT ON TABLE users IS 'User accounts with authentication and profile information';
```

**SQLAlchemy Model:**
```python
# app/models/user.py
from sqlalchemy import Column, String, Boolean, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime

from app.core.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    phone = Column(String(50))
    title = Column(String(100))
    department = Column(String(100))
    is_active = Column(Boolean, default=True, nullable=False)
    is_superuser = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    last_login_at = Column(DateTime(timezone=True))
    is_deleted = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime(timezone=True))

    # Relationships
    pursuits_created = relationship("Pursuit", back_populates="created_by", foreign_keys="Pursuit.created_by_id")
    reviews = relationship("Review", back_populates="reviewer")
    quality_tags = relationship("QualityTag", back_populates="tagged_by")
```

---

### 3.2 pursuits

**Purpose:** Core pursuit entity with all metadata and content

```sql
CREATE TABLE pursuits (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Client Information
    entity_name VARCHAR(255) NOT NULL,
    client_pursuit_owner_name VARCHAR(255),
    client_pursuit_owner_email VARCHAR(255),

    -- Internal Information
    internal_pursuit_owner_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    internal_pursuit_owner_name VARCHAR(255) NOT NULL,
    internal_pursuit_owner_email VARCHAR(255) NOT NULL,

    -- Classification Metadata
    industry VARCHAR(100) NOT NULL,
    service_types VARCHAR(100)[] NOT NULL,  -- Array: ['Engineering', 'Risk', 'Data']
    technologies VARCHAR(100)[],            -- Array: ['Azure', 'AWS', 'M365']
    geography VARCHAR(100),

    -- Pursuit Details
    submission_due_date DATE,
    estimated_fees_usd DECIMAL(12, 2),
    expected_format VARCHAR(20) NOT NULL,   -- 'docx' or 'pptx'

    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    -- Status values: draft, in_review, ready_for_submission, submitted, won, lost, cancelled, stale

    -- Content
    requirements_text TEXT,                 -- Extracted RFP text
    outline_json JSONB,                     -- AI-generated outline structure
    conversation_history JSONB,             -- Chat refinement history
    proposal_outline_framework TEXT,        -- User-specified section structure (optional)

    -- AI/Search
    -- Vector embeddings are stored in ChromaDB, linked by pursuit_id

    -- Progress Tracking
    current_stage VARCHAR(50),              -- For save/resume: 'metadata_entry', 'search', 'outline_editing', etc.
    progress_percentage INTEGER DEFAULT 0,  -- 0-100

    -- Audit
    created_by_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    submitted_at TIMESTAMP WITH TIME ZONE,

    -- Soft Delete
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    deleted_at TIMESTAMP WITH TIME ZONE,

    -- Concurrent Edit Prevention (Optimistic Locking)
    version INTEGER NOT NULL DEFAULT 1,
    last_edited_by_id UUID REFERENCES users(id),
    last_edited_session_id VARCHAR(255),

    -- Constraints
    CONSTRAINT valid_status CHECK (status IN (
        'draft', 'in_review', 'ready_for_submission', 'submitted',
        'won', 'lost', 'cancelled', 'stale'
    )),
    CONSTRAINT valid_format CHECK (expected_format IN ('docx', 'pptx')),
    CONSTRAINT valid_progress CHECK (progress_percentage BETWEEN 0 AND 100)
);

-- Indexes
CREATE INDEX idx_pursuits_status ON pursuits(status) WHERE is_deleted = false;
CREATE INDEX idx_pursuits_industry ON pursuits(industry) WHERE is_deleted = false;
CREATE INDEX idx_pursuits_service_types ON pursuits USING GIN(service_types) WHERE is_deleted = false;
CREATE INDEX idx_pursuits_technologies ON pursuits USING GIN(technologies) WHERE is_deleted = false;
CREATE INDEX idx_pursuits_created_at ON pursuits(created_at DESC) WHERE is_deleted = false;
CREATE INDEX idx_pursuits_internal_owner ON pursuits(internal_pursuit_owner_id) WHERE is_deleted = false;
CREATE INDEX idx_pursuits_outline_json ON pursuits USING GIN(outline_json) WHERE is_deleted = false;

-- Vector index for similarity search
CREATE INDEX idx_pursuits_embedding ON pursuits
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100)
WHERE is_deleted = false AND embedding IS NOT NULL;

COMMENT ON TABLE pursuits IS 'Core pursuit records with metadata, content, and AI embeddings';
COMMENT ON COLUMN pursuits.service_types IS 'Array of service types (Engineering, Risk, Data, etc.)';
COMMENT ON COLUMN pursuits.technologies IS 'Array of technologies (Azure, AWS, M365, etc.)';
COMMENT ON COLUMN pursuits.outline_json IS 'Structured outline with sections, bullets, and citations';
COMMENT ON COLUMN pursuits.embedding IS 'Vector embedding for semantic similarity search (1536 dimensions)';
```

**SQLAlchemy Model:**
```python
# app/models/pursuit.py
from sqlalchemy import Column, String, Text, Integer, Numeric, Date, DateTime, Boolean, ForeignKey, CheckConstraint, ARRAY
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

import uuid
from datetime import datetime

from app.core.database import Base

class Pursuit(Base):
    __tablename__ = "pursuits"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Client Information
    entity_name = Column(String(255), nullable=False)
    client_pursuit_owner_name = Column(String(255))
    client_pursuit_owner_email = Column(String(255))

    # Internal Information
    internal_pursuit_owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    internal_pursuit_owner_name = Column(String(255), nullable=False)
    internal_pursuit_owner_email = Column(String(255), nullable=False)

    # Classification
    industry = Column(String(100), nullable=False, index=True)
    service_types = Column(ARRAY(String(100)), nullable=False)
    technologies = Column(ARRAY(String(100)))
    geography = Column(String(100))

    # Details
    submission_due_date = Column(Date)
    estimated_fees_usd = Column(Numeric(12, 2))
    expected_format = Column(String(20), nullable=False)

    # Status
    status = Column(String(50), nullable=False, default='draft', index=True)

    # Content
    requirements_text = Column(Text)
    outline_json = Column(JSONB)
    conversation_history = Column(JSONB)
    proposal_outline_framework = Column(Text)

    # AI/Search
    # Vector embeddings are stored in ChromaDB, linked by pursuit_id
    # embedding = Column(Vector(1536))

    # Progress
    current_stage = Column(String(50))
    progress_percentage = Column(Integer, default=0)

    # Audit
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    submitted_at = Column(DateTime(timezone=True))

    # Soft Delete
    is_deleted = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime(timezone=True))

    # Constraints
    __table_args__ = (
        CheckConstraint(
            "status IN ('draft', 'in_review', 'ready_for_submission', 'submitted', 'won', 'lost', 'cancelled', 'stale')",
            name='valid_status'
        ),
        CheckConstraint("expected_format IN ('docx', 'pptx')", name='valid_format'),
        CheckConstraint("progress_percentage BETWEEN 0 AND 100", name='valid_progress'),
    )

    # Relationships
    created_by = relationship("User", back_populates="pursuits_created", foreign_keys=[created_by_id])
    internal_owner = relationship("User", foreign_keys=[internal_pursuit_owner_id])
    files = relationship("PursuitFile", back_populates="pursuit", cascade="all, delete-orphan")
    references = relationship("PursuitReference", back_populates="pursuit", foreign_keys="PursuitReference.pursuit_id")
    referenced_by = relationship("PursuitReference", back_populates="referenced_pursuit", foreign_keys="PursuitReference.referenced_pursuit_id")
    reviews = relationship("Review", back_populates="pursuit")
    quality_tags = relationship("QualityTag", back_populates="pursuit")
    citations = relationship("Citation", back_populates="pursuit")
```

---

### 3.3 pursuit_files

**Purpose:** Store uploaded files and generated documents

```sql
CREATE TABLE pursuit_files (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Foreign Key
    pursuit_id UUID NOT NULL REFERENCES pursuits(id) ON DELETE CASCADE,

    -- File Metadata
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    -- File types: rfp, rfp_appendix, additional_reference, output_docx, output_pptx, seed
    file_path VARCHAR(500) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,

    -- Extracted Content
    extracted_text TEXT,
    extraction_status VARCHAR(50) DEFAULT 'pending',
    -- Status: pending, processing, completed, failed

    -- Timestamps
    uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Soft Delete
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    deleted_at TIMESTAMP WITH TIME ZONE,

    -- Constraints
    CONSTRAINT valid_file_type CHECK (file_type IN (
        'rfp', 'rfp_appendix', 'additional_reference',
        'output_docx', 'output_pptx', 'seed'
    )),
    CONSTRAINT valid_extraction_status CHECK (extraction_status IN (
        'pending', 'processing', 'completed', 'failed'
    ))
);

CREATE INDEX idx_pursuit_files_pursuit_id ON pursuit_files(pursuit_id) WHERE is_deleted = false;
CREATE INDEX idx_pursuit_files_file_type ON pursuit_files(file_type) WHERE is_deleted = false;
CREATE INDEX idx_pursuit_files_extraction_status ON pursuit_files(extraction_status) WHERE is_deleted = false;

COMMENT ON TABLE pursuit_files IS 'Uploaded RFP files, reference documents, and generated outputs';
```

**SQLAlchemy Model:**
```python
# app/models/pursuit_file.py
from sqlalchemy import Column, String, Text, BigInteger, DateTime, Boolean, ForeignKey, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime

from app.core.database import Base

class PursuitFile(Base):
    __tablename__ = "pursuit_files"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pursuit_id = Column(UUID(as_uuid=True), ForeignKey("pursuits.id", ondelete="CASCADE"), nullable=False, index=True)
    file_name = Column(String(255), nullable=False)
    file_type = Column(String(50), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size_bytes = Column(BigInteger, nullable=False)
    mime_type = Column(String(100), nullable=False)
    extracted_text = Column(Text)
    extraction_status = Column(String(50), default='pending')
    uploaded_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    is_deleted = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime(timezone=True))

    __table_args__ = (
        CheckConstraint(
            "file_type IN ('rfp', 'rfp_appendix', 'additional_reference', 'output_docx', 'output_pptx', 'seed')",
            name='valid_file_type'
        ),
        CheckConstraint(
            "extraction_status IN ('pending', 'processing', 'completed', 'failed')",
            name='valid_extraction_status'
        ),
    )

    # Relationships
    pursuit = relationship("Pursuit", back_populates="files")
```

---

### 3.4 pursuit_references

**Purpose:** Track which past pursuits were referenced in new pursuits

```sql
CREATE TABLE pursuit_references (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Foreign Keys
    pursuit_id UUID NOT NULL REFERENCES pursuits(id) ON DELETE CASCADE,
    referenced_pursuit_id UUID NOT NULL REFERENCES pursuits(id) ON DELETE CASCADE,

    -- Reference Metadata
    selected_by_ai BOOLEAN NOT NULL DEFAULT false,
    selected_by_user BOOLEAN NOT NULL DEFAULT false,
    similarity_score DECIMAL(5, 4),         -- 0.0000 to 1.0000
    selection_reason TEXT,

    -- Timestamps
    selected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    UNIQUE(pursuit_id, referenced_pursuit_id),
    CHECK (pursuit_id != referenced_pursuit_id)
);

CREATE INDEX idx_pursuit_references_pursuit_id ON pursuit_references(pursuit_id);
CREATE INDEX idx_pursuit_references_referenced_id ON pursuit_references(referenced_pursuit_id);
CREATE INDEX idx_pursuit_references_similarity ON pursuit_references(similarity_score DESC);

COMMENT ON TABLE pursuit_references IS 'Tracks which past pursuits were referenced in new pursuits';
COMMENT ON COLUMN pursuit_references.similarity_score IS 'Vector cosine similarity score (0.0-1.0)';
```

**SQLAlchemy Model:**
```python
# app/models/pursuit_reference.py
from sqlalchemy import Column, Numeric, Text, DateTime, Boolean, ForeignKey, CheckConstraint, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime

from app.core.database import Base

class PursuitReference(Base):
    __tablename__ = "pursuit_references"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pursuit_id = Column(UUID(as_uuid=True), ForeignKey("pursuits.id", ondelete="CASCADE"), nullable=False)
    referenced_pursuit_id = Column(UUID(as_uuid=True), ForeignKey("pursuits.id", ondelete="CASCADE"), nullable=False)
    selected_by_ai = Column(Boolean, default=False, nullable=False)
    selected_by_user = Column(Boolean, default=False, nullable=False)
    similarity_score = Column(Numeric(5, 4))
    selection_reason = Column(Text)
    selected_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint('pursuit_id', 'referenced_pursuit_id', name='uq_pursuit_reference'),
        CheckConstraint('pursuit_id != referenced_pursuit_id', name='different_pursuits'),
    )

    # Relationships
    pursuit = relationship("Pursuit", back_populates="references", foreign_keys=[pursuit_id])
    referenced_pursuit = relationship("Pursuit", back_populates="referenced_by", foreign_keys=[referenced_pursuit_id])
```

---

### 3.5 quality_tags

**Purpose:** User-applied quality markers on pursuits

```sql
CREATE TABLE quality_tags (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Foreign Keys
    pursuit_id UUID NOT NULL REFERENCES pursuits(id) ON DELETE CASCADE,
    tagged_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Tag Information
    tag_type VARCHAR(50) NOT NULL,
    -- Types: high_quality, exemplary, good_approach, well_written, effective
    section_reference VARCHAR(255),         -- Optional: which section was tagged
    notes TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT valid_tag_type CHECK (tag_type IN (
        'high_quality', 'exemplary', 'good_approach', 'well_written', 'effective'
    ))
);

CREATE INDEX idx_quality_tags_pursuit_id ON quality_tags(pursuit_id);
CREATE INDEX idx_quality_tags_tagged_by ON quality_tags(tagged_by_user_id);
CREATE INDEX idx_quality_tags_tag_type ON quality_tags(tag_type);

COMMENT ON TABLE quality_tags IS 'User-applied quality markers to identify exemplary content';
```

**SQLAlchemy Model:**
```python
# app/models/quality_tag.py
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime

from app.core.database import Base

class QualityTag(Base):
    __tablename__ = "quality_tags"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pursuit_id = Column(UUID(as_uuid=True), ForeignKey("pursuits.id", ondelete="CASCADE"), nullable=False)
    tagged_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    tag_type = Column(String(50), nullable=False)
    section_reference = Column(String(255))
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    __table_args__ = (
        CheckConstraint(
            "tag_type IN ('high_quality', 'exemplary', 'good_approach', 'well_written', 'effective')",
            name='valid_tag_type'
        ),
    )

    # Relationships
    pursuit = relationship("Pursuit", back_populates="quality_tags")
    tagged_by = relationship("User", back_populates="quality_tags")
```

---

### 3.6 reviews

**Purpose:** Approval workflow records

```sql
CREATE TABLE reviews (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Foreign Keys
    pursuit_id UUID NOT NULL REFERENCES pursuits(id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Review Information
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    -- Status: pending, approved, changes_requested
    feedback TEXT,

    -- Timestamps
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT valid_review_status CHECK (status IN (
        'pending', 'approved', 'changes_requested'
    ))
);

CREATE INDEX idx_reviews_pursuit_id ON reviews(pursuit_id);
CREATE INDEX idx_reviews_reviewer_id ON reviews(reviewer_id);
CREATE INDEX idx_reviews_status ON reviews(status);

COMMENT ON TABLE reviews IS 'Pursuit approval workflow with minimum 2 reviewers';
```

**SQLAlchemy Model:**
```python
# app/models/review.py
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime

from app.core.database import Base

class Review(Base):
    __tablename__ = "reviews"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pursuit_id = Column(UUID(as_uuid=True), ForeignKey("pursuits.id", ondelete="CASCADE"), nullable=False)
    reviewer_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(50), nullable=False, default='pending')
    feedback = Column(Text)
    reviewed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'approved', 'changes_requested')",
            name='valid_review_status'
        ),
    )

    # Relationships
    pursuit = relationship("Pursuit", back_populates="reviews")
    reviewer = relationship("User", back_populates="reviews")
```

---

### 3.7 citations

**Purpose:** Source citations for AI-generated content

```sql
CREATE TABLE citations (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Foreign Keys
    pursuit_id UUID NOT NULL REFERENCES pursuits(id) ON DELETE CASCADE,
    source_pursuit_id UUID REFERENCES pursuits(id) ON DELETE SET NULL,

    -- Citation Information
    source_type VARCHAR(50) NOT NULL,
    -- Types: past_pursuit, web, additional_reference, synthesized
    section_reference VARCHAR(255),         -- Which section this citation applies to
    content_snippet TEXT,                   -- Excerpt from source
    source_details JSONB,                   -- Flexible JSON for different source types
    /*
    For past_pursuit: {"pursuit_name": "...", "section": "...", "page": 5}
    For web: {"url": "...", "title": "...", "accessed_date": "...", "relevance_score": 0.95}
    For additional_reference: {"file_name": "...", "section": "...", "page": 3}
    For synthesized: {"sources": [citation_id1, citation_id2]}
    */

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT valid_source_type CHECK (source_type IN (
        'past_pursuit', 'web', 'additional_reference', 'synthesized'
    ))
);

CREATE INDEX idx_citations_pursuit_id ON citations(pursuit_id);
CREATE INDEX idx_citations_source_pursuit_id ON citations(source_pursuit_id);
CREATE INDEX idx_citations_source_type ON citations(source_type);
CREATE INDEX idx_citations_source_details ON citations USING GIN(source_details);

COMMENT ON TABLE citations IS 'Source citations for all AI-generated content';
COMMENT ON COLUMN citations.source_details IS 'JSONB field for flexible citation metadata';
```

**SQLAlchemy Model:**
```python
# app/models/citation.py
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime

from app.core.database import Base

class Citation(Base):
    __tablename__ = "citations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pursuit_id = Column(UUID(as_uuid=True), ForeignKey("pursuits.id", ondelete="CASCADE"), nullable=False)
    source_pursuit_id = Column(UUID(as_uuid=True), ForeignKey("pursuits.id", ondelete="SET NULL"))
    source_type = Column(String(50), nullable=False)
    section_reference = Column(String(255))
    content_snippet = Column(Text)
    source_details = Column(JSONB)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    __table_args__ = (
        CheckConstraint(
            "source_type IN ('past_pursuit', 'web', 'additional_reference', 'synthesized')",
            name='valid_source_type'
        ),
    )

    # Relationships
    pursuit = relationship("Pursuit", back_populates="citations", foreign_keys=[pursuit_id])
    source_pursuit = relationship("Pursuit", foreign_keys=[source_pursuit_id])
```

---

### 3.8 audit_logs

**Purpose:** Audit trail for compliance and debugging

```sql
CREATE TABLE audit_logs (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Foreign Keys
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    pursuit_id UUID REFERENCES pursuits(id) ON DELETE SET NULL,

    -- Action Information
    action VARCHAR(100) NOT NULL,
    -- Actions: create_pursuit, update_pursuit, delete_pursuit, submit_review, etc.
    entity_type VARCHAR(50) NOT NULL,
    -- Entities: pursuit, review, user, file, etc.
    entity_id UUID,

    -- Details
    details JSONB,                          -- Flexible JSON for action-specific data
    ip_address INET,
    user_agent VARCHAR(500),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_pursuit_id ON audit_logs(pursuit_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_details ON audit_logs USING GIN(details);

COMMENT ON TABLE audit_logs IS 'Comprehensive audit trail for all significant actions';
```

**SQLAlchemy Model:**
```python
# app/models/audit_log.py
from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB, INET
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime

from app.core.database import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    pursuit_id = Column(UUID(as_uuid=True), ForeignKey("pursuits.id", ondelete="SET NULL"))
    action = Column(String(100), nullable=False)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(UUID(as_uuid=True))
    details = Column(JSONB)
    ip_address = Column(INET)
    user_agent = Column(String(500))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False, index=True)

    # Relationships
    user = relationship("User")
    pursuit = relationship("Pursuit")
```

---

### 3.1 Vector Storage (ChromaDB)

Vector embeddings are stored in **ChromaDB**, a dedicated vector database, rather than in PostgreSQL.

**Collections:**
1.  **rfp_chunks**: Embeddings of RFP document sections.
    - Metadata: `pursuit_id`, `doc_id`, `chunk_index`, `text_content`
2.  **pursuit_chunks**: Embeddings of past pursuit content.
    - Metadata: `pursuit_id`, `section_id`, `text_content`

**Linking:**
- ChromaDB items are linked to PostgreSQL records via `pursuit_id` stored in metadata.

### 3.9 pursuit_metrics (Optional - Pre-aggregated Analytics)

**Purpose:** Pre-computed analytics for dashboard performance

```sql
CREATE TABLE pursuit_metrics (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Dimensions
    metric_date DATE NOT NULL,
    dimension_type VARCHAR(50) NOT NULL,    -- 'industry', 'service_type', 'technology', 'owner', 'overall'
    dimension_value VARCHAR(100),           -- e.g., 'Healthcare' for industry dimension

    -- Metrics
    total_pursuits INTEGER DEFAULT 0,
    won_count INTEGER DEFAULT 0,
    lost_count INTEGER DEFAULT 0,
    in_progress_count INTEGER DEFAULT 0,
    win_rate DECIMAL(5, 4),                 -- Calculated: won / (won + lost)
    avg_time_to_completion_days DECIMAL(6, 2),
    avg_estimated_fees_usd DECIMAL(12, 2),

    -- Timestamps
    computed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    UNIQUE(metric_date, dimension_type, dimension_value),
    CONSTRAINT valid_dimension_type CHECK (dimension_type IN (
        'overall', 'industry', 'service_type', 'technology', 'owner'
    ))
);

CREATE INDEX idx_metrics_date ON pursuit_metrics(metric_date DESC);
CREATE INDEX idx_metrics_dimension ON pursuit_metrics(dimension_type, dimension_value);

COMMENT ON TABLE pursuit_metrics IS 'Pre-aggregated analytics for dashboard performance';
```

---

## 4. Relationships & Foreign Keys

### 4.1 Relationship Summary

```sql
-- Users → Pursuits (created_by)
ALTER TABLE pursuits
ADD CONSTRAINT fk_pursuits_created_by
FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE RESTRICT;

-- Users → Pursuits (internal owner)
ALTER TABLE pursuits
ADD CONSTRAINT fk_pursuits_internal_owner
FOREIGN KEY (internal_pursuit_owner_id) REFERENCES users(id) ON DELETE RESTRICT;

-- Pursuits → Pursuit Files
ALTER TABLE pursuit_files
ADD CONSTRAINT fk_pursuit_files_pursuit
FOREIGN KEY (pursuit_id) REFERENCES pursuits(id) ON DELETE CASCADE;

-- Pursuits → Pursuit References (both directions)
ALTER TABLE pursuit_references
ADD CONSTRAINT fk_pursuit_references_pursuit
FOREIGN KEY (pursuit_id) REFERENCES pursuits(id) ON DELETE CASCADE;

ALTER TABLE pursuit_references
ADD CONSTRAINT fk_pursuit_references_referenced
FOREIGN KEY (referenced_pursuit_id) REFERENCES pursuits(id) ON DELETE CASCADE;

-- Pursuits → Reviews
ALTER TABLE reviews
ADD CONSTRAINT fk_reviews_pursuit
FOREIGN KEY (pursuit_id) REFERENCES pursuits(id) ON DELETE CASCADE;

-- Users → Reviews
ALTER TABLE reviews
ADD CONSTRAINT fk_reviews_reviewer
FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE CASCADE;

-- Pursuits → Quality Tags
ALTER TABLE quality_tags
ADD CONSTRAINT fk_quality_tags_pursuit
FOREIGN KEY (pursuit_id) REFERENCES pursuits(id) ON DELETE CASCADE;

-- Users → Quality Tags
ALTER TABLE quality_tags
ADD CONSTRAINT fk_quality_tags_user
FOREIGN KEY (tagged_by_user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Pursuits → Citations
ALTER TABLE citations
ADD CONSTRAINT fk_citations_pursuit
FOREIGN KEY (pursuit_id) REFERENCES pursuits(id) ON DELETE CASCADE;

ALTER TABLE citations
ADD CONSTRAINT fk_citations_source_pursuit
FOREIGN KEY (source_pursuit_id) REFERENCES pursuits(id) ON DELETE SET NULL;
```

### 4.2 Cascade Behavior

| Relationship | On Delete | Rationale |
|--------------|-----------|-----------|
| Users → Pursuits (created_by) | RESTRICT | Prevent deletion of users who created pursuits |
| Pursuits → Files | CASCADE | Delete files when pursuit deleted |
| Pursuits → References | CASCADE | Delete references when pursuit deleted |
| Pursuits → Reviews | CASCADE | Delete reviews when pursuit deleted |
| Pursuits → Tags | CASCADE | Delete tags when pursuit deleted |
| Pursuits → Citations | CASCADE | Delete citations when pursuit deleted |
| Users → Reviews | CASCADE | Delete reviews when user deleted |
| Citations → Source Pursuit | SET NULL | Preserve citation even if source deleted |

---

## 5. Indexes

### 5.1 B-Tree Indexes (Standard Queries)

```sql
-- users table
CREATE INDEX idx_users_email ON users(email) WHERE is_deleted = false;
CREATE INDEX idx_users_is_active ON users(is_active) WHERE is_deleted = false;

-- pursuits table
CREATE INDEX idx_pursuits_status ON pursuits(status) WHERE is_deleted = false;
CREATE INDEX idx_pursuits_industry ON pursuits(industry) WHERE is_deleted = false;
CREATE INDEX idx_pursuits_created_at ON pursuits(created_at DESC) WHERE is_deleted = false;
CREATE INDEX idx_pursuits_internal_owner ON pursuits(internal_pursuit_owner_id) WHERE is_deleted = false;
CREATE INDEX idx_pursuits_submission_due_date ON pursuits(submission_due_date) WHERE is_deleted = false;

-- pursuit_files table
CREATE INDEX idx_pursuit_files_pursuit_id ON pursuit_files(pursuit_id) WHERE is_deleted = false;
CREATE INDEX idx_pursuit_files_file_type ON pursuit_files(file_type) WHERE is_deleted = false;

-- reviews table
CREATE INDEX idx_reviews_pursuit_id ON reviews(pursuit_id);
CREATE INDEX idx_reviews_reviewer_id ON reviews(reviewer_id);
CREATE INDEX idx_reviews_status ON reviews(status);

-- audit_logs table
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
```

### 5.2 GIN Indexes (JSONB & Arrays)

```sql
-- pursuits table
CREATE INDEX idx_pursuits_service_types ON pursuits USING GIN(service_types) WHERE is_deleted = false;
CREATE INDEX idx_pursuits_technologies ON pursuits USING GIN(technologies) WHERE is_deleted = false;
CREATE INDEX idx_pursuits_outline_json ON pursuits USING GIN(outline_json) WHERE is_deleted = false;
CREATE INDEX idx_pursuits_conversation_history ON pursuits USING GIN(conversation_history) WHERE is_deleted = false;

-- citations table
CREATE INDEX idx_citations_source_details ON citations USING GIN(source_details);

-- audit_logs table
CREATE INDEX idx_audit_logs_details ON audit_logs USING GIN(details);
```

### 5.3 Vector Indexes (Similarity Search)

```sql
-- Note: lists parameter should be sqrt(total_rows) for optimal performance
-- Adjust as data grows: 100 lists for ~10K rows, 316 for 100K rows
```

### 5.4 Partial Indexes (Filtered)

```sql
-- Index only active, non-deleted records for common queries
CREATE INDEX idx_pursuits_active ON pursuits(status, created_at DESC)
WHERE is_deleted = false AND status IN ('draft', 'in_review', 'ready_for_submission');

CREATE INDEX idx_pursuits_completed ON pursuits(status, created_at DESC)
WHERE is_deleted = false AND status IN ('submitted', 'won', 'lost');
```

---

## 6. Constraints & Validation

### 6.1 Check Constraints

```sql
-- pursuits table
ALTER TABLE pursuits ADD CONSTRAINT valid_status CHECK (status IN (
    'draft', 'in_review', 'ready_for_submission', 'submitted', 'won', 'lost', 'cancelled', 'stale'
));

ALTER TABLE pursuits ADD CONSTRAINT valid_format CHECK (expected_format IN ('docx', 'pptx'));
ALTER TABLE pursuits ADD CONSTRAINT valid_progress CHECK (progress_percentage BETWEEN 0 AND 100);

-- pursuit_files table
ALTER TABLE pursuit_files ADD CONSTRAINT valid_file_type CHECK (file_type IN (
    'rfp', 'rfp_appendix', 'additional_reference', 'output_docx', 'output_pptx', 'seed'
));

ALTER TABLE pursuit_files ADD CONSTRAINT valid_extraction_status CHECK (extraction_status IN (
    'pending', 'processing', 'completed', 'failed'
));

-- reviews table
ALTER TABLE reviews ADD CONSTRAINT valid_review_status CHECK (status IN (
    'pending', 'approved', 'changes_requested'
));

-- quality_tags table
ALTER TABLE quality_tags ADD CONSTRAINT valid_tag_type CHECK (tag_type IN (
    'high_quality', 'exemplary', 'good_approach', 'well_written', 'effective'
));

-- citations table
ALTER TABLE citations ADD CONSTRAINT valid_source_type CHECK (source_type IN (
    'past_pursuit', 'web', 'additional_reference', 'synthesized'
));
```

### 6.2 Unique Constraints

```sql
-- users table
ALTER TABLE users ADD CONSTRAINT uq_users_email UNIQUE (email);

-- pursuit_references table
ALTER TABLE pursuit_references ADD CONSTRAINT uq_pursuit_reference
UNIQUE (pursuit_id, referenced_pursuit_id);

-- pursuit_metrics table
ALTER TABLE pursuit_metrics ADD CONSTRAINT uq_pursuit_metrics
UNIQUE (metric_date, dimension_type, dimension_value);
```

### 6.3 Not Null Constraints

```sql
-- All critical fields enforce NOT NULL at table definition
-- See individual table DDL above for full NOT NULL specification
```

---

## 7. Migrations

### 7.1 Alembic Configuration

```python
# alembic.ini
[alembic]
script_location = alembic
sqlalchemy.url = postgresql+asyncpg://pursuit_user:pursuit_pass@localhost/pursuit_db

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic
```

### 7.2 Migration Script Structure

```python
# alembic/versions/001_initial_schema.py
"""Initial schema

Revision ID: 001
Revises:
Create Date: 2025-11-18
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from pgvector.sqlalchemy import Vector

revision = '001'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # Enable extensions
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
    op.execute('CREATE EXTENSION IF NOT EXISTS vector')

    # Create users table
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('email', sa.String(255), nullable=False, unique=True),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('full_name', sa.String(255), nullable=False),
        # ... rest of columns
    )

    # Create pursuits table
    op.create_table(
        'pursuits',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('entity_name', sa.String(255), nullable=False),
        # ... rest of columns
        sa.Column('embedding', Vector(1536)),
    )

    # Create indexes
    op.create_index('idx_pursuits_embedding', 'pursuits', ['embedding'],
                    postgresql_using='ivfflat',
                    postgresql_ops={'embedding': 'vector_cosine_ops'},
                    postgresql_with={'lists': 100})

def downgrade():
    op.drop_index('idx_pursuits_embedding')
    op.drop_table('pursuits')
    op.drop_table('users')
    op.execute('DROP EXTENSION vector')
    op.execute('DROP EXTENSION "uuid-ossp"')
```

### 7.3 Running Migrations

```bash
# Create a new migration
alembic revision --autogenerate -m "Add new column"

# Apply migrations
alembic upgrade head

# Rollback one version
alembic downgrade -1

# Show current version
alembic current

# Show migration history
alembic history
```

---

## 8. Sample Queries

### 8.1 Vector Similarity Search

```sql
-- Find top 10 similar pursuits using vector search
SELECT
    p.id,
    p.entity_name,
    p.industry,
    p.service_types,
    p.status,
    1 - (p.embedding <=> :query_embedding) AS similarity_score
FROM pursuits p
WHERE
    p.is_deleted = false
    AND p.status IN ('submitted', 'won', 'lost')
    AND p.embedding IS NOT NULL
ORDER BY p.embedding <=> :query_embedding
LIMIT 10;
```

### 8.2 Weighted Ranking Algorithm

```sql
-- Similarity search with weighted ranking
WITH similarity_scores AS (
    SELECT
        p.id,
        p.entity_name,
        p.industry,
        p.service_types,
        p.technologies,
        p.status,
        p.created_at,
        1 - (p.embedding <=> :query_embedding) AS vector_similarity,
        -- Metadata match score (industry, service, tech)
        CASE
            WHEN p.industry = :target_industry THEN 0.3
            ELSE 0
        END +
        CASE
            WHEN p.service_types && :target_services::varchar[] THEN 0.2
            ELSE 0
        END +
        CASE
            WHEN p.technologies && :target_technologies::varchar[] THEN 0.1
            ELSE 0
        END AS metadata_score,
        -- Quality tag score
        COALESCE((SELECT COUNT(*) FROM quality_tags WHERE pursuit_id = p.id), 0) * 0.05 AS quality_score,
        -- Win status score
        CASE
            WHEN p.status = 'won' THEN 0.15
            WHEN p.status = 'submitted' THEN 0.075
            ELSE 0.05
        END AS win_score,
        -- Recency score
        GREATEST(0, 0.10 * (1 - EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - p.created_at)) / 31536000)) AS recency_score
    FROM pursuits p
    WHERE
        p.is_deleted = false
        AND p.status IN ('submitted', 'won', 'lost')
        AND p.embedding IS NOT NULL
    ORDER BY p.embedding <=> :query_embedding
    LIMIT 50  -- Get top 50 by vector similarity first
)
SELECT
    id,
    entity_name,
    industry,
    service_types,
    technologies,
    status,
    vector_similarity,
    metadata_score,
    quality_score,
    win_score,
    recency_score,
    (0.40 * vector_similarity +
     0.20 * metadata_score +
     0.15 * quality_score +
     0.15 * win_score +
     0.10 * recency_score) AS final_score
FROM similarity_scores
ORDER BY final_score DESC
LIMIT 10;
```

### 8.3 Analytics Queries

```sql
-- Win rate by industry
SELECT
    industry,
    COUNT(*) FILTER (WHERE status = 'won') AS won_count,
    COUNT(*) FILTER (WHERE status = 'lost') AS lost_count,
    COUNT(*) AS total_count,
    ROUND(
        COUNT(*) FILTER (WHERE status = 'won')::numeric /
        NULLIF(COUNT(*) FILTER (WHERE status IN ('won', 'lost')), 0),
        4
    ) AS win_rate
FROM pursuits
WHERE
    is_deleted = false
    AND status IN ('won', 'lost')
    AND created_at >= :start_date
    AND created_at <= :end_date
GROUP BY industry
ORDER BY win_rate DESC;

-- Most referenced pursuits
SELECT
    p.id,
    p.entity_name,
    p.industry,
    p.status,
    COUNT(pr.id) AS reference_count
FROM pursuits p
INNER JOIN pursuit_references pr ON p.id = pr.referenced_pursuit_id
WHERE p.is_deleted = false
GROUP BY p.id, p.entity_name, p.industry, p.status
ORDER BY reference_count DESC
LIMIT 10;

-- Average time to completion
SELECT
    AVG(EXTRACT(EPOCH FROM (submitted_at - created_at)) / 86400) AS avg_days_to_submission
FROM pursuits
WHERE
    is_deleted = false
    AND status = 'submitted'
    AND submitted_at IS NOT NULL;
```

### 8.4 Review Workflow Queries

```sql
-- Check if pursuit ready for submission (2+ approvals)
SELECT
    p.id,
    p.entity_name,
    COUNT(r.id) FILTER (WHERE r.status = 'approved') AS approval_count,
    COUNT(r.id) FILTER (WHERE r.status = 'changes_requested') AS changes_count
FROM pursuits p
LEFT JOIN reviews r ON p.id = r.pursuit_id
WHERE p.id = :pursuit_id
GROUP BY p.id, p.entity_name;

-- Pending reviews for a user
SELECT
    p.id,
    p.entity_name,
    p.industry,
    p.internal_pursuit_owner_name,
    p.created_at,
    (SELECT COUNT(*) FROM reviews WHERE pursuit_id = p.id AND status = 'approved') AS approval_count
FROM pursuits p
WHERE
    p.is_deleted = false
    AND p.status = 'in_review'
    AND NOT EXISTS (
        SELECT 1 FROM reviews
        WHERE pursuit_id = p.id
        AND reviewer_id = :user_id
    )
ORDER BY p.created_at ASC;
```

### 8.5 Audit Log Queries

```sql
-- Recent actions by user
SELECT
    al.action,
    al.entity_type,
    al.details,
    al.created_at
FROM audit_logs al
WHERE al.user_id = :user_id
ORDER BY al.created_at DESC
LIMIT 50;

-- All changes to a specific pursuit
SELECT
    al.action,
    u.full_name AS user_name,
    al.details,
    al.created_at
FROM audit_logs al
LEFT JOIN users u ON al.user_id = u.id
WHERE al.pursuit_id = :pursuit_id
ORDER BY al.created_at DESC;
```

---

## Appendix A: JSONB Field Schemas

### A.1 pursuits.outline_json

```json
{
  "sections": [
    {
      "id": "uuid",
      "heading": "Executive Summary",
      "subtitle": "Overview of our proposed approach",
      "order": 1,
      "bullets": [
        {
          "id": "uuid",
          "text": "Bullet point content here",
          "order": 1,
          "is_gap": false,
          "gap_explanation": null,
          "citations": ["citation-uuid-1", "citation-uuid-2"]
        }
      ]
    }
  ],
  "metadata": {
    "generated_at": "2025-11-18T10:30:00Z",
    "total_sections": 7,
    "total_gaps": 2,
    "agents_used": ["gap_analysis", "research", "synthesis"]
  }
}
```

### A.2 pursuits.conversation_history

```json
[
  {
    "id": "uuid",
    "role": "system",
    "content": "Outline generated successfully. You can now refine it by asking questions or making direct edits.",
    "timestamp": "2025-11-18T10:30:00Z"
  },
  {
    "id": "uuid",
    "role": "user",
    "content": "Add more healthcare case studies to the Technical Approach section",
    "timestamp": "2025-11-18T10:35:00Z"
  },
  {
    "id": "uuid",
    "role": "assistant",
    "content": "I've added 2 healthcare case studies to the Technical Approach section, citing from the Acme Healthcare pursuit.",
    "timestamp": "2025-11-18T10:35:30Z",
    "outline_changes": {
      "section_id": "uuid",
      "bullets_added": ["uuid1", "uuid2"]
    }
  }
]
```

### A.3 citations.source_details (Examples)

**Past Pursuit Citation:**
```json
{
  "pursuit_name": "Acme Healthcare Digital Transformation",
  "pursuit_id": "uuid",
  "section": "Technical Approach",
  "page": 12,
  "excerpt": "Our phased approach begins with..."
}
```

**Web Citation:**
```json
{
  "url": "https://azure.microsoft.com/...",
  "title": "Azure Healthcare Solutions Best Practices",
  "accessed_date": "2025-11-18",
  "relevance_score": 0.95,
  "metadata_match": {
    "industry_match": true,
    "technology_match": true,
    "service_match": false
  }
}
```

**Additional Reference Citation:**
```json
{
  "file_name": "Company_Case_Studies_2024.pdf",
  "file_id": "uuid",
  "section": "Healthcare Projects",
  "page": 8,
  "excerpt": "Completed 15 data migration projects..."
}
```

---

## Appendix B: Database Sizing Estimates

### B.1 Storage Estimates (1 Year, 500 Pursuits)

| Table | Rows | Avg Row Size | Total Size |
|-------|------|--------------|------------|
| users | 50 | 1 KB | 50 KB |
| pursuits | 500 | 50 KB | 25 MB |
| pursuit_files | 2,000 | 2 KB (metadata only) | 4 MB |
| pursuit_references | 1,500 | 500 B | 750 KB |
| quality_tags | 300 | 500 B | 150 KB |
| reviews | 1,000 | 1 KB | 1 MB |
| citations | 5,000 | 2 KB | 10 MB |
| audit_logs | 20,000 | 2 KB | 40 MB |
| **Total Database** | | | **~81 MB** |
| **File Storage** | | | **~30 GB** |
| **Total System** | | | **~30 GB** |

### B.2 Performance Benchmarks

| Operation | Target | Notes |
|-----------|--------|-------|
| Vector similarity search | < 5 seconds | 1,000 pursuits |
| Metadata filter query | < 100ms | B-tree indexes |
| JSONB query | < 200ms | GIN indexes |
| Insert pursuit | < 50ms | Single transaction |
| Update outline_json | < 100ms | JSONB update |
| Aggregate analytics | < 1 second | With metrics table |

---

## Document Control

**Version:** 1.0
**Date:** 2025-11-18
**Status:** Database Schema Complete
**Database:** PostgreSQL 15+
**Vector Database:** ChromaDB
**ORM:** SQLAlchemy 2.x (Async)
