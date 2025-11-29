from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from uuid import UUID


class ActivityBase(BaseModel):
    action: str
    entity_type: str
    entity_id: Optional[UUID] = None
    details: Optional[dict] = None


class ActivityCreate(ActivityBase):
    pursuit_id: Optional[UUID] = None


class Activity(ActivityBase):
    id: UUID
    user_id: Optional[UUID] = None
    pursuit_id: Optional[UUID] = None
    created_at: datetime

    # Joined fields
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    pursuit_name: Optional[str] = None

    class Config:
        from_attributes = True
