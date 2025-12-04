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
    description = Column(Text, nullable=True)
    uploaded_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    uploaded_by_name = Column(String(255), nullable=True)
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
