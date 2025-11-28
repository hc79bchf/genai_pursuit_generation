from fastapi import FastAPI, Query

from app.core.config import settings
from app.api.v1.api import api_router
from app.core.database import AsyncSessionLocal, engine, Base
from app.models import User, Pursuit, PursuitFile, AuditLog
from app.core.security import get_password_hash
from sqlalchemy.future import select

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title=settings.PROJECT_NAME)

# Build CORS origins list
cors_origins = [str(origin) for origin in settings.BACKEND_CORS_ORIGINS]

# Add FRONTEND_URL if provided (Railway sets this)
if settings.FRONTEND_URL:
    cors_origins.append(settings.FRONTEND_URL)

# Set all CORS enabled origins
if cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    # Default to allowing localhost:3000 if not configured
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/")
async def root():
    return {"message": "Pursuit Response Platform API is running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.post("/init-db")
async def init_database(secret: str = Query(..., description="Secret key to authorize")):
    """One-time database initialization endpoint. Remove after use."""
    # Simple protection - must provide SECRET_KEY to run
    if secret != settings.SECRET_KEY:
        return {"error": "Unauthorized"}

    try:
        # Create tables
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        # Create test user
        async with AsyncSessionLocal() as session:
            result = await session.execute(select(User).filter(User.email == "test@example.com"))
            user = result.scalars().first()

            if not user:
                user = User(
                    email="test@example.com",
                    password_hash=get_password_hash("password123"),
                    full_name="Test User",
                    is_active=True
                )
                session.add(user)
                await session.commit()
                return {"status": "success", "message": "Database initialized and test user created"}
            else:
                return {"status": "success", "message": "Database initialized, test user already exists"}
    except Exception as e:
        return {"status": "error", "message": str(e)}
