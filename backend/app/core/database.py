from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

def get_async_database_url(url: str) -> str:
    """Ensure the database URL uses asyncpg driver"""
    if not url:
        return url
    if url.startswith('postgres://'):
        return url.replace('postgres://', 'postgresql+asyncpg://', 1)
    elif url.startswith('postgresql://') and '+asyncpg' not in url:
        return url.replace('postgresql://', 'postgresql+asyncpg://', 1)
    elif url.startswith('postgresql+psycopg2://'):
        return url.replace('postgresql+psycopg2://', 'postgresql+asyncpg://', 1)
    return url

# Convert URL to async format
database_url = get_async_database_url(settings.DATABASE_URL)

engine = create_async_engine(database_url, echo=settings.DEBUG, future=True)

AsyncSessionLocal = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

Base = declarative_base()

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
