import asyncio
import os
import sys
from datetime import date, timedelta

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
                await session.refresh(user)
                print("Test user created.")
            else:
                print("Test user already exists.")

            # Create sample pursuits
            print("Creating sample pursuits...")

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
            print(f"Created {len(sample_pursuits)} sample pursuits.")

            # Create an audit log entry
            print("Creating audit log entry...")
            audit_log = AuditLog(
                user_id=user.id,
                action="create",
                entity_type="user",
                details={"message": "Database seeded with test data"}
            )
            session.add(audit_log)
            await session.commit()
            print("Audit log created.")

            print("Database seeding completed successfully!")

    except Exception as e:
        print(f"Error seeding database: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(seed_db())
