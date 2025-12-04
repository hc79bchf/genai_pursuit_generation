from typing import Optional
from pydantic import BaseModel
from uuid import UUID
from datetime import datetime

class PursuitFileBase(BaseModel):
    file_name: str
    file_type: str
    file_size_bytes: int
    mime_type: str
    extraction_status: Optional[str] = "pending"
    description: Optional[str] = None
    uploaded_by_name: Optional[str] = None

class PursuitFileCreate(PursuitFileBase):
    pursuit_id: UUID
    file_path: str

class PursuitFileUpdate(BaseModel):
    extraction_status: Optional[str] = None
    extracted_text: Optional[str] = None

class PursuitFile(PursuitFileBase):
    id: UUID
    pursuit_id: UUID
    uploaded_at: datetime
    file_path: str # Usually we might not want to expose the full path, but for MVP it's fine or we can hide it

    class Config:
        from_attributes = True
