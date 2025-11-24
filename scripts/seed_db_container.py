import asyncio
import os
import sys

# Ensure app is in path if running from /app
sys.path.append("/app")

from app.core.database import AsyncSessionLocal, engine, Base
# Import models to register them with Base
from app.models import User, Pursuit, PursuitFile, AuditLog
from app.core.security import get_password_hash
from sqlalchemy.future import select

async def seed_db():
    print("Resetting database...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    print("Tables recreated.")

    print("Connecting to database...")
    try:
        async with AsyncSessionLocal() as session:
            print("Checking for existing user...")
            result = await session.execute(select(User).filter(User.email == "test@example.com"))
            user = result.scalars().first()
            
            if not user:
                print("Creating test user...")
                user = User(
                    email="test@example.com",
                    password_hash=get_password_hash("password123"),
                    full_name="Test User",
                    is_active=True
                )
                session.add(user)
                await session.commit()
                print("Test user created.")
            else:
                print("Test user already exists.")
    except Exception as e:
        print(f"Error seeding database: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(seed_db())
