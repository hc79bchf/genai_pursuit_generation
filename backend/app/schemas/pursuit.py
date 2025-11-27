from pydantic import BaseModel, Field, EmailStr, field_validator
from typing import List, Optional, Dict, Any
from datetime import date, datetime
from uuid import UUID

# Import the existing metadata schema or redefine it
# Since we are updating the file, we will include the metadata fields in the Base schema

class PursuitBase(BaseModel):
    entity_name: Optional[str] = None
    client_pursuit_owner_name: Optional[str] = None
    client_pursuit_owner_email: Optional[str] = None
    internal_pursuit_owner_name: Optional[str] = None
    internal_pursuit_owner_email: Optional[str] = None
    industry: Optional[str] = None
    service_types: List[str] = []
    technologies: List[str] = []
    geography: Optional[str] = None
    submission_due_date: Optional[date] = None
    estimated_fees_usd: Optional[float] = None
    expected_format: Optional[str] = "docx"
    status: Optional[str] = "draft"
    requirements_text: Optional[str] = None
    outline_json: Optional[Dict[str, Any]] = None
    conversation_history: Optional[List[Dict[str, Any]]] = None
    proposal_outline_framework: Optional[str] = None
    gap_analysis_result: Optional[Dict[str, Any]] = None
    research_result: Optional[Dict[str, Any]] = None
    current_stage: Optional[str] = None
    progress_percentage: Optional[int] = 0

class PursuitCreate(PursuitBase):
    entity_name: str
    internal_pursuit_owner_id: Optional[UUID] = None
    internal_pursuit_owner_name: Optional[str] = None
    internal_pursuit_owner_email: Optional[str] = None

class PursuitUpdate(PursuitBase):
    pass

    class Config:
        from_attributes = True

# Forward reference for PursuitFile
from .file import PursuitFile

class Pursuit(PursuitBase):
    id: UUID
    internal_pursuit_owner_id: UUID
    created_by_id: UUID
    created_at: datetime
    updated_at: datetime
    submitted_at: Optional[datetime] = None
    is_deleted: bool = False
    files: List[PursuitFile] = []

    class Config:
        from_attributes = True

# Re-export PursuitMetadata for agent compatibility if needed, 
# or we can just use PursuitBase/PursuitUpdate for the agent result.
class PursuitMetadata(PursuitBase):
    @field_validator("submission_due_date", mode="before")
    @classmethod
    def parse_submission_due_date(cls, v):
        if isinstance(v, str) and v.upper() == "UNKNOWN":
            return None
        return v
