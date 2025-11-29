from typing import Optional, Dict, Any
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime

from app.models.audit_log import AuditLog


async def log_activity(
    db: AsyncSession,
    user_id: UUID,
    action: str,
    entity_type: str,
    entity_id: Optional[UUID] = None,
    pursuit_id: Optional[UUID] = None,
    details: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> AuditLog:
    """
    Log an activity/audit event.

    Args:
        db: Database session
        user_id: ID of the user performing the action
        action: Action type (e.g., 'create', 'update', 'delete', 'extract', 'gap_analysis', 'research', 'generate_ppt')
        entity_type: Type of entity (e.g., 'pursuit', 'file', 'proposal')
        entity_id: ID of the entity being acted upon
        pursuit_id: ID of related pursuit (if applicable)
        details: Additional details about the action
        ip_address: Client IP address
        user_agent: Client user agent

    Returns:
        The created AuditLog entry
    """
    log_entry = AuditLog(
        user_id=user_id,
        pursuit_id=pursuit_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=details,
        ip_address=ip_address,
        user_agent=user_agent,
        created_at=datetime.utcnow(),
    )
    db.add(log_entry)
    await db.commit()
    await db.refresh(log_entry)
    return log_entry
