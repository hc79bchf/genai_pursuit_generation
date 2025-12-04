"""
Lookup endpoints for autocomplete/combobox functionality.
Provides searchable lists of entities, users, and team members.
"""

from typing import List, Optional
from pydantic import BaseModel

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, distinct

from app.core.database import get_db
from app.models.pursuit import Pursuit
from app.models.user import User
from app.api.deps import get_current_user

router = APIRouter()


class LookupOption(BaseModel):
    """Response model for lookup options."""
    value: str
    label: str
    email: Optional[str] = None


@router.get("/entities", response_model=List[LookupOption])
async def get_entities(
    q: str = Query(default="", description="Search query"),
    limit: int = Query(default=20, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[LookupOption]:
    """
    Get distinct entity names from existing pursuits for autocomplete.
    Allows searching/filtering by query string.
    """
    query = select(distinct(Pursuit.entity_name)).where(
        Pursuit.entity_name.isnot(None),
        Pursuit.is_deleted == False
    )

    if q:
        query = query.where(Pursuit.entity_name.ilike(f"%{q}%"))

    query = query.order_by(Pursuit.entity_name).limit(limit)

    result = await db.execute(query)
    entities = result.scalars().all()

    return [
        LookupOption(value=entity, label=entity)
        for entity in entities if entity
    ]


@router.get("/users", response_model=List[LookupOption])
async def get_users(
    q: str = Query(default="", description="Search query"),
    limit: int = Query(default=20, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[LookupOption]:
    """
    Get users for autocomplete (Internal Owner, Partner, Manager).
    Searches by name or email.
    """
    query = select(User).where(User.is_active == True)

    if q:
        query = query.where(
            (User.full_name.ilike(f"%{q}%")) |
            (User.email.ilike(f"%{q}%"))
        )

    query = query.order_by(User.full_name).limit(limit)

    result = await db.execute(query)
    users = result.scalars().all()

    return [
        LookupOption(
            value=user.full_name or user.email,
            label=user.full_name or user.email,
            email=user.email
        )
        for user in users
    ]


@router.get("/team-members", response_model=List[LookupOption])
async def get_team_members(
    q: str = Query(default="", description="Search query"),
    role: str = Query(default="", description="Role filter: owner, partner, manager"),
    limit: int = Query(default=20, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[LookupOption]:
    """
    Get team members from existing pursuits for autocomplete.
    Combines data from internal owners, partners, and managers.
    """
    results = set()

    # Get from Users table first
    user_query = select(User).where(User.is_active == True)
    if q:
        user_query = user_query.where(
            (User.full_name.ilike(f"%{q}%")) |
            (User.email.ilike(f"%{q}%"))
        )
    user_query = user_query.limit(limit)
    user_result = await db.execute(user_query)
    users = user_result.scalars().all()

    for user in users:
        if user.full_name:
            results.add((user.full_name, user.email))

    # Also get from pursuit history for partners/managers who may not be system users
    if role in ("", "partner"):
        partner_query = select(
            distinct(Pursuit.pursuit_partner_name),
            Pursuit.pursuit_partner_email
        ).where(
            Pursuit.pursuit_partner_name.isnot(None),
            Pursuit.is_deleted == False
        )
        if q:
            partner_query = partner_query.where(
                Pursuit.pursuit_partner_name.ilike(f"%{q}%")
            )
        partner_result = await db.execute(partner_query)
        for name, email in partner_result.all():
            if name:
                results.add((name, email))

    if role in ("", "manager"):
        manager_query = select(
            distinct(Pursuit.pursuit_manager_name),
            Pursuit.pursuit_manager_email
        ).where(
            Pursuit.pursuit_manager_name.isnot(None),
            Pursuit.is_deleted == False
        )
        if q:
            manager_query = manager_query.where(
                Pursuit.pursuit_manager_name.ilike(f"%{q}%")
            )
        manager_result = await db.execute(manager_query)
        for name, email in manager_result.all():
            if name:
                results.add((name, email))

    # Convert to sorted list
    sorted_results = sorted(list(results), key=lambda x: x[0])[:limit]

    return [
        LookupOption(value=name, label=name, email=email)
        for name, email in sorted_results
    ]


@router.get("/industries", response_model=List[LookupOption])
async def get_industries(
    q: str = Query(default="", description="Search query"),
    limit: int = Query(default=20, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[LookupOption]:
    """
    Get distinct industries from existing pursuits for autocomplete.
    Also includes a predefined list of common industries.
    """
    # Predefined common industries
    common_industries = [
        "Technology",
        "Healthcare",
        "Financial Services",
        "Manufacturing",
        "Retail",
        "Energy",
        "Government",
        "Education",
        "Telecommunications",
        "Transportation",
        "Media & Entertainment",
        "Real Estate",
        "Professional Services",
        "Life Sciences",
        "Consumer Products",
    ]

    # Get from database
    query = select(distinct(Pursuit.industry)).where(
        Pursuit.industry.isnot(None),
        Pursuit.is_deleted == False
    )

    if q:
        query = query.where(Pursuit.industry.ilike(f"%{q}%"))

    query = query.order_by(Pursuit.industry).limit(limit)

    result = await db.execute(query)
    db_industries = result.scalars().all()

    # Combine and deduplicate
    all_industries = set(db_industries)
    for industry in common_industries:
        if not q or q.lower() in industry.lower():
            all_industries.add(industry)

    # Sort and limit
    sorted_industries = sorted([i for i in all_industries if i])[:limit]

    return [
        LookupOption(value=industry, label=industry)
        for industry in sorted_industries
    ]


@router.get("/geographies", response_model=List[LookupOption])
async def get_geographies(
    q: str = Query(default="", description="Search query"),
    limit: int = Query(default=20, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[LookupOption]:
    """
    Get distinct geographies/regions from existing pursuits for autocomplete.
    Also includes a predefined list of common regions.
    """
    # Predefined common geographies
    common_geographies = [
        "North America",
        "United States",
        "Canada",
        "Europe",
        "United Kingdom",
        "EMEA",
        "Asia Pacific",
        "APAC",
        "Latin America",
        "Middle East",
        "Africa",
        "Global",
        "Australia",
        "Germany",
        "France",
        "Japan",
        "China",
        "India",
        "Brazil",
        "Mexico",
    ]

    # Get from database
    query = select(distinct(Pursuit.geography)).where(
        Pursuit.geography.isnot(None),
        Pursuit.is_deleted == False
    )

    if q:
        query = query.where(Pursuit.geography.ilike(f"%{q}%"))

    query = query.order_by(Pursuit.geography).limit(limit)

    result = await db.execute(query)
    db_geographies = result.scalars().all()

    # Combine and deduplicate
    all_geographies = set(db_geographies)
    for geography in common_geographies:
        if not q or q.lower() in geography.lower():
            all_geographies.add(geography)

    # Sort and limit
    sorted_geographies = sorted([g for g in all_geographies if g])[:limit]

    return [
        LookupOption(value=geography, label=geography)
        for geography in sorted_geographies
    ]


@router.get("/contacts", response_model=List[LookupOption])
async def get_contacts(
    q: str = Query(default="", description="Search query"),
    limit: int = Query(default=20, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[LookupOption]:
    """
    Get client contacts from existing pursuits for autocomplete.
    Combines client pursuit owners, entity sponsors, and entity contacts.
    """
    results = set()

    # Get client pursuit owners
    client_query = select(
        distinct(Pursuit.client_pursuit_owner_name),
        Pursuit.client_pursuit_owner_email
    ).where(
        Pursuit.client_pursuit_owner_name.isnot(None),
        Pursuit.is_deleted == False
    )
    if q:
        client_query = client_query.where(
            Pursuit.client_pursuit_owner_name.ilike(f"%{q}%")
        )
    client_result = await db.execute(client_query)
    for name, email in client_result.all():
        if name:
            results.add((name, email))

    # Get entity sponsors
    sponsor_query = select(
        distinct(Pursuit.entity_sponsor_name),
        Pursuit.entity_sponsor_email
    ).where(
        Pursuit.entity_sponsor_name.isnot(None),
        Pursuit.is_deleted == False
    )
    if q:
        sponsor_query = sponsor_query.where(
            Pursuit.entity_sponsor_name.ilike(f"%{q}%")
        )
    sponsor_result = await db.execute(sponsor_query)
    for name, email in sponsor_result.all():
        if name:
            results.add((name, email))

    # Convert to sorted list
    sorted_results = sorted(list(results), key=lambda x: x[0])[:limit]

    return [
        LookupOption(value=name, label=name, email=email)
        for name, email in sorted_results
    ]
