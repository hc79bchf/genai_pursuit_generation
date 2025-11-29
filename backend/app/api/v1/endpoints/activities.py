from typing import Any, List
from uuid import UUID
import logging

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.audit_log import AuditLog
from app.models.user import User
from app.models.pursuit import Pursuit
from app.schemas.activity import Activity
from app.api.deps import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/", response_model=List[Activity])
async def get_activities(
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 10,
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Retrieve recent activities/audit logs.
    """
    result = await db.execute(
        select(AuditLog)
        .options(selectinload(AuditLog.user), selectinload(AuditLog.pursuit))
        .order_by(AuditLog.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    logs = result.scalars().all()

    # Transform to Activity response with joined user/pursuit info
    activities = []
    for log in logs:
        activity = Activity(
            id=log.id,
            user_id=log.user_id,
            pursuit_id=log.pursuit_id,
            action=log.action,
            entity_type=log.entity_type,
            entity_id=log.entity_id,
            details=log.details,
            created_at=log.created_at,
            user_name=log.user.full_name if log.user else None,
            user_email=log.user.email if log.user else None,
            pursuit_name=log.pursuit.entity_name if log.pursuit else None,
        )
        activities.append(activity)

    return activities
