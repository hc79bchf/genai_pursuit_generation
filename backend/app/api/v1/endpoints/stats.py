from typing import Any
import logging

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func

from app.core.database import get_db
from app.models.pursuit import Pursuit
from app.models.user import User
from app.api.deps import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/dashboard")
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Get dashboard statistics including:
    - Active pursuits count
    - Won pursuits count
    - Win rate
    - Team members count
    """
    # Get all pursuits
    all_pursuits_result = await db.execute(select(Pursuit))
    all_pursuits = all_pursuits_result.scalars().all()

    # Calculate stats
    total_pursuits = len(all_pursuits)
    active_statuses = ['draft', 'in_review', 'ready_for_submission', 'submitted']
    inactive_statuses = ['cancelled', 'stale', 'lost']

    active_pursuits = len([p for p in all_pursuits if p.status in active_statuses])
    won_pursuits = len([p for p in all_pursuits if p.status == 'won'])
    lost_pursuits = len([p for p in all_pursuits if p.status == 'lost'])

    # Calculate win rate (won / (won + lost))
    decided_pursuits = won_pursuits + lost_pursuits
    win_rate = round((won_pursuits / decided_pursuits * 100)) if decided_pursuits > 0 else 0

    # Get unique team members (users who own pursuits)
    team_members_result = await db.execute(
        select(func.count(func.distinct(Pursuit.internal_pursuit_owner_id)))
    )
    team_members = team_members_result.scalar() or 0

    # Also count total users as a fallback
    total_users_result = await db.execute(
        select(func.count(User.id)).where(User.is_active == True)
    )
    total_users = total_users_result.scalar() or 1

    return {
        "active_pursuits": active_pursuits,
        "total_pursuits": total_pursuits,
        "won_pursuits": won_pursuits,
        "lost_pursuits": lost_pursuits,
        "win_rate": win_rate,
        "team_members": max(team_members, total_users),  # Use higher of the two
    }
