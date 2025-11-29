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
    industry = Column(String(100), nullable=True, index=True)
    service_types = Column(ARRAY(String(100)), nullable=True)
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
    gap_analysis_result = Column(JSONB)
    research_result = Column(JSONB)
    selected_template_id = Column(String(100), nullable=True)  # ID of selected outline template

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
    # references = relationship("PursuitReference", back_populates="pursuit", foreign_keys="PursuitReference.pursuit_id")
    # referenced_by = relationship("PursuitReference", back_populates="referenced_pursuit", foreign_keys="PursuitReference.referenced_pursuit_id")
    # reviews = relationship("Review", back_populates="pursuit")
    # quality_tags = relationship("QualityTag", back_populates="pursuit")
    # citations = relationship("Citation", back_populates="pursuit")
