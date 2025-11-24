import asyncio
import sys
import os

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), "../backend"))

from app.core.database import AsyncSessionLocal
from app.models.user import User
from app.core.security import get_password_hash
from sqlalchemy.future import select

async def seed_db():
    async with AsyncSessionLocal() as session:
        # Check if user exists
        result = await session.execute(select(User).filter(User.email == "test@example.com"))
        user = result.scalars().first()
        
        if not user:
            print("Creating test user...")
            user = User(
                email="test@example.com",
                hashed_password=get_password_hash("password123"),
                full_name="Test User",
                is_active=True
            )
            session.add(user)
            await session.commit()
            print("Test user created.")
        else:
            print("Test user already exists.")

if __name__ == "__main__":
    # Ensure we use localhost for DB connection when running from host
    os.environ["DATABASE_URL"] = "postgresql://postgres:postgres@localhost:5432/pursuit_response"
    asyncio.run(seed_db())
