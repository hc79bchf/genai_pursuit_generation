import pytest
from httpx import AsyncClient, ASGITransport
import asyncio

import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool

from app.main import app
from app.core.config import settings
from app.core.database import Base, get_db
# Import models
from app.models import user, pursuit, pursuit_file, audit_log

# Create a test engine with NullPool to avoid connection sharing issues
test_engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    future=True,
    poolclass=NullPool,
)

TestingSessionLocal = sessionmaker(
    test_engine, class_=AsyncSession, expire_on_commit=False
)

async def override_get_db():
    async with TestingSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

@pytest.fixture(scope="session")
def event_loop():
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
    yield loop
    loop.close()

@pytest_asyncio.fixture(scope="function", autouse=True)
async def init_db():
    # Override the dependency
    app.dependency_overrides[get_db] = override_get_db
    
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    
    yield
    
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    
    app.dependency_overrides.pop(get_db, None)

@pytest_asyncio.fixture
async def async_client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client

from app.api.deps import get_current_user
from uuid import uuid4
from app.models.user import User

@pytest_asyncio.fixture
async def db_user():
    # Create a fresh user object for each test
    user = User(
        id=uuid4(),
        email="test@example.com",
        full_name="Test User",
        password_hash="hashed_secret",
        is_active=True,
        is_superuser=False
    )
    
    async with TestingSessionLocal() as session:
        session.add(user)
        await session.commit()
        await session.refresh(user)
    
    # Override dependency to return this user
    app.dependency_overrides[get_current_user] = lambda: user
    
    yield user
    
    # Cleanup override
    app.dependency_overrides.pop(get_current_user, None)
