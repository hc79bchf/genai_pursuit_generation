from fastapi import FastAPI, Query
from datetime import date, timedelta

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
async def init_database(
    secret: str = Query(..., description="Secret key to authorize"),
    reset: bool = Query(False, description="Drop and recreate all tables")
):
    """Database initialization endpoint with optional reset."""
    # Simple protection - must provide SECRET_KEY to run
    if secret != settings.SECRET_KEY:
        return {"error": "Unauthorized"}

    try:
        # Optionally reset tables
        if reset:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.drop_all)
                await conn.run_sync(Base.metadata.create_all)
        else:
            # Just create tables (won't affect existing)
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)

        # Create test user and sample data
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
                await session.refresh(user)

            # Create sample pursuits if reset or no pursuits exist
            result = await session.execute(select(Pursuit))
            existing_pursuits = result.scalars().all()

            if reset or len(existing_pursuits) == 0:
                sample_pursuits = [
                    {
                        "entity_name": "Acme Corp Federal Contract",
                        "client_pursuit_owner_name": "John Smith",
                        "client_pursuit_owner_email": "john.smith@acme.com",
                        "internal_pursuit_owner_name": user.full_name,
                        "internal_pursuit_owner_email": user.email,
                        "industry": "Government",
                        "service_types": ["IT Services", "Cloud Migration"],
                        "technologies": ["AWS", "Azure", "Kubernetes"],
                        "geography": "United States",
                        "submission_due_date": date.today() + timedelta(days=30),
                        "estimated_fees_usd": 500000.00,
                        "expected_format": "docx",
                        "status": "draft",
                        "selected_template_id": "federal-rfp",
                        "progress_percentage": 25,
                    },
                    {
                        "entity_name": "TechStart SaaS Implementation",
                        "client_pursuit_owner_name": "Sarah Johnson",
                        "client_pursuit_owner_email": "sarah@techstart.io",
                        "internal_pursuit_owner_name": user.full_name,
                        "internal_pursuit_owner_email": user.email,
                        "industry": "Technology",
                        "service_types": ["SaaS Implementation", "System Integration"],
                        "technologies": ["Salesforce", "AWS", "Node.js"],
                        "geography": "North America",
                        "submission_due_date": date.today() + timedelta(days=14),
                        "estimated_fees_usd": 250000.00,
                        "expected_format": "pptx",
                        "status": "in_review",
                        "selected_template_id": "enterprise-saas",
                        "progress_percentage": 60,
                    },
                    {
                        "entity_name": "SecureBank Cybersecurity Audit",
                        "client_pursuit_owner_name": "Michael Chen",
                        "client_pursuit_owner_email": "mchen@securebank.com",
                        "internal_pursuit_owner_name": user.full_name,
                        "internal_pursuit_owner_email": user.email,
                        "industry": "Finance",
                        "service_types": ["Security Audit", "Compliance"],
                        "technologies": ["SOC2", "ISO 27001", "NIST"],
                        "geography": "Global",
                        "submission_due_date": date.today() + timedelta(days=45),
                        "estimated_fees_usd": 150000.00,
                        "expected_format": "docx",
                        "status": "draft",
                        "selected_template_id": "cybersecurity-audit",
                        "progress_percentage": 10,
                    },
                    {
                        "entity_name": "HealthFirst EHR Integration",
                        "client_pursuit_owner_name": "Dr. Emily Wilson",
                        "client_pursuit_owner_email": "ewilson@healthfirst.org",
                        "internal_pursuit_owner_name": user.full_name,
                        "internal_pursuit_owner_email": user.email,
                        "industry": "Healthcare",
                        "service_types": ["EHR Integration", "Data Migration"],
                        "technologies": ["HL7", "FHIR", "Epic"],
                        "geography": "United States",
                        "submission_due_date": date.today() + timedelta(days=60),
                        "estimated_fees_usd": 750000.00,
                        "expected_format": "docx",
                        "status": "draft",
                        "selected_template_id": "healthcare-it",
                        "progress_percentage": 5,
                    },
                    {
                        "entity_name": "CityGov Modernization Project",
                        "client_pursuit_owner_name": "Robert Martinez",
                        "client_pursuit_owner_email": "rmartinez@citygov.gov",
                        "internal_pursuit_owner_name": user.full_name,
                        "internal_pursuit_owner_email": user.email,
                        "industry": "Government",
                        "service_types": ["Digital Transformation", "Legacy Modernization"],
                        "technologies": ["React", "Python", "PostgreSQL"],
                        "geography": "United States",
                        "submission_due_date": date.today() + timedelta(days=21),
                        "estimated_fees_usd": 300000.00,
                        "expected_format": "pptx",
                        "status": "ready_for_submission",
                        "selected_template_id": "state-local",
                        "progress_percentage": 90,
                    },
                ]

                for pursuit_data in sample_pursuits:
                    pursuit = Pursuit(
                        internal_pursuit_owner_id=user.id,
                        created_by_id=user.id,
                        **pursuit_data
                    )
                    session.add(pursuit)

                await session.commit()
                return {"status": "success", "message": f"Database {'reset and ' if reset else ''}initialized with {len(sample_pursuits)} sample pursuits"}

            return {"status": "success", "message": "Database initialized, data already exists"}
    except Exception as e:
        import traceback
        return {"status": "error", "message": str(e), "traceback": traceback.format_exc()}
