#!/usr/bin/env python3
"""
Seed script to populate the database with realistic test data.

Usage:
    python scripts/seed_data.py [--count=10] [--type=all] [--clear]
"""

import asyncio
import argparse
import random
import uuid
from datetime import datetime, timedelta
from decimal import Decimal
import sys
import os

# Add the parent directory to the path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from passlib.context import CryptContext
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.models.user import User
from app.models.pursuit import Pursuit
from app.models.pursuit_file import PursuitFile

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Realistic data pools
COMPANIES = [
    "Acme Healthcare Systems", "TechVision Global", "FinanceFirst Solutions",
    "Apex Manufacturing Co", "CloudNine Technologies", "Meridian Energy Partners",
    "Quantum Retail Group", "Horizon Logistics Inc", "Nexus Pharmaceuticals",
    "Stellar Insurance Group", "Pacific Banking Corp", "Vertex Aerospace",
    "Pinnacle Consulting Group", "Atlas Mining Industries", "Fusion Media Networks",
    "Evergreen Environmental", "Catalyst Biotech", "Summit Real Estate Holdings",
    "Vanguard Defense Systems", "Beacon Healthcare Network"
]

INDUSTRIES = [
    "Healthcare", "Technology", "Financial Services", "Manufacturing",
    "Energy", "Retail", "Logistics", "Pharmaceuticals", "Insurance",
    "Banking", "Aerospace", "Consulting", "Mining", "Media",
    "Environmental", "Biotech", "Real Estate", "Defense", "Telecommunications"
]

SERVICE_TYPES = [
    ["IT Strategy", "Digital Transformation"],
    ["System Integration", "Cloud Migration"],
    ["Data Analytics", "Business Intelligence"],
    ["Cybersecurity", "Risk Assessment"],
    ["Process Optimization", "Change Management"],
    ["ERP Implementation", "SAP Integration"],
    ["Mobile Development", "API Development"],
    ["AI/ML Solutions", "Predictive Analytics"],
    ["Infrastructure Modernization", "DevOps"],
    ["Compliance & Audit", "Regulatory Advisory"]
]

TECHNOLOGIES = [
    ["AWS", "Python", "PostgreSQL"],
    ["Azure", "C#", ".NET"],
    ["GCP", "Java", "Kubernetes"],
    ["Salesforce", "Apex", "Lightning"],
    ["SAP", "ABAP", "HANA"],
    ["Oracle", "PL/SQL", "OCI"],
    ["React", "Node.js", "MongoDB"],
    ["Angular", "TypeScript", "GraphQL"],
    ["Terraform", "Docker", "Jenkins"],
    ["Snowflake", "dbt", "Airflow"]
]

GEOGRAPHIES = [
    "North America", "EMEA", "APAC", "Latin America", "Global"
]

RFP_REQUIREMENTS = [
    """The client requires a comprehensive digital transformation initiative to modernize their legacy systems.
Key requirements include:
- Migration of on-premise applications to cloud infrastructure
- Implementation of modern CI/CD pipelines
- Integration with existing enterprise systems
- Training and change management support
- 24/7 production support for first 6 months""",

    """Enterprise resource planning system replacement project.
Scope includes:
- Current state assessment and gap analysis
- Selection and implementation of modern ERP platform
- Data migration from legacy systems
- Custom module development for industry-specific needs
- User training and adoption support""",

    """Data analytics and business intelligence platform development.
Requirements:
- Centralized data warehouse design and implementation
- Self-service reporting and dashboard capabilities
- Predictive analytics models for key business metrics
- Real-time data integration from multiple sources
- Mobile-friendly analytics access""",

    """Cybersecurity assessment and remediation program.
Deliverables expected:
- Comprehensive security audit of current infrastructure
- Penetration testing and vulnerability assessment
- Security policy and procedure development
- Implementation of security monitoring tools
- Incident response planning and tabletop exercises""",

    """Customer experience transformation initiative.
Key areas:
- Omnichannel customer engagement platform
- CRM system implementation and customization
- Customer journey mapping and optimization
- Personalization and recommendation engine
- Customer feedback and sentiment analysis"""
]

FIRST_NAMES = ["James", "Sarah", "Michael", "Emily", "David", "Jennifer", "Robert", "Lisa", "William", "Amanda"]
LAST_NAMES = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez"]
DEPARTMENTS = ["Technology", "Operations", "Finance", "Strategy", "Delivery", "Sales", "Marketing"]
TITLES = ["Partner", "Senior Manager", "Manager", "Senior Consultant", "Consultant", "Associate"]


def generate_email(first_name: str, last_name: str, domain: str = "consulting.com") -> str:
    return f"{first_name.lower()}.{last_name.lower()}@{domain}"


def generate_phone() -> str:
    return f"+1-{random.randint(200,999)}-{random.randint(100,999)}-{random.randint(1000,9999)}"


async def clear_data(session: AsyncSession):
    """Clear existing data from tables."""
    print("Clearing existing data...")
    await session.execute(text("TRUNCATE pursuit_files, pursuits, users CASCADE"))
    await session.commit()
    print("  Data cleared successfully")


async def seed_users(session: AsyncSession, count: int) -> list[User]:
    """Create test users."""
    print(f"Creating {count} users...")
    users = []

    # Always create a known test user first
    test_user = User(
        id=uuid.uuid4(),
        email="test@example.com",
        password_hash=pwd_context.hash("password123"),
        full_name="Test User",
        phone=generate_phone(),
        title="Senior Consultant",
        department="Technology",
        is_active=True,
        is_superuser=False,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    session.add(test_user)
    users.append(test_user)

    # Create additional random users
    for i in range(count - 1):
        first_name = random.choice(FIRST_NAMES)
        last_name = random.choice(LAST_NAMES)
        user = User(
            id=uuid.uuid4(),
            email=generate_email(first_name, last_name),
            password_hash=pwd_context.hash("password123"),
            full_name=f"{first_name} {last_name}",
            phone=generate_phone(),
            title=random.choice(TITLES),
            department=random.choice(DEPARTMENTS),
            is_active=True,
            is_superuser=(i == 0),  # First additional user is superuser
            created_at=datetime.utcnow() - timedelta(days=random.randint(1, 365)),
            updated_at=datetime.utcnow()
        )
        session.add(user)
        users.append(user)

    await session.commit()
    print(f"  Created {len(users)} users")
    return users


async def seed_pursuits(session: AsyncSession, users: list[User], count: int) -> list[Pursuit]:
    """Create test pursuits."""
    print(f"Creating {count} pursuits...")
    pursuits = []
    statuses = ['draft', 'in_review', 'ready_for_submission', 'submitted', 'won', 'lost']
    status_weights = [0.3, 0.2, 0.15, 0.15, 0.1, 0.1]

    for i in range(count):
        company = random.choice(COMPANIES)
        industry = random.choice(INDUSTRIES)
        owner = random.choice(users)
        creator = random.choice(users)
        services = random.choice(SERVICE_TYPES)
        techs = random.choice(TECHNOLOGIES)

        # Client contact names
        client_first = random.choice(FIRST_NAMES)
        client_last = random.choice(LAST_NAMES)
        sponsor_first = random.choice(FIRST_NAMES)
        sponsor_last = random.choice(LAST_NAMES)

        # Partner and manager (optional)
        partner_first = random.choice(FIRST_NAMES)
        partner_last = random.choice(LAST_NAMES)
        manager_first = random.choice(FIRST_NAMES)
        manager_last = random.choice(LAST_NAMES)

        status = random.choices(statuses, weights=status_weights)[0]

        # Calculate dates based on status
        created_days_ago = random.randint(7, 180)
        created_at = datetime.utcnow() - timedelta(days=created_days_ago)
        due_date = datetime.utcnow() + timedelta(days=random.randint(-30, 90))

        # Progress based on status
        progress_map = {
            'draft': random.randint(0, 30),
            'in_review': random.randint(30, 60),
            'ready_for_submission': random.randint(60, 90),
            'submitted': 100,
            'won': 100,
            'lost': 100
        }

        pursuit = Pursuit(
            id=uuid.uuid4(),
            entity_name=company,
            entity_number=f"ENT-{random.randint(10000, 99999)}",
            client_pursuit_owner_name=f"{client_first} {client_last}",
            client_pursuit_owner_email=generate_email(client_first, client_last, company.lower().replace(" ", "") + ".com"),
            entity_sponsor_name=f"{sponsor_first} {sponsor_last}",
            entity_sponsor_email=generate_email(sponsor_first, sponsor_last, company.lower().replace(" ", "") + ".com"),
            internal_pursuit_owner_id=owner.id,
            internal_pursuit_owner_name=owner.full_name,
            internal_pursuit_owner_email=owner.email,
            pursuit_partner_name=f"{partner_first} {partner_last}" if random.random() > 0.3 else None,
            pursuit_partner_email=generate_email(partner_first, partner_last) if random.random() > 0.3 else None,
            pursuit_manager_name=f"{manager_first} {manager_last}" if random.random() > 0.4 else None,
            pursuit_manager_email=generate_email(manager_first, manager_last) if random.random() > 0.4 else None,
            industry=industry,
            service_types=services,
            technologies=techs,
            geography=random.choice(GEOGRAPHIES),
            submission_due_date=due_date.date(),
            estimated_fees_usd=Decimal(str(random.randint(50, 500) * 10000)),
            expected_format=random.choice(['docx', 'pptx']),
            status=status,
            requirements_text=random.choice(RFP_REQUIREMENTS),
            current_stage=random.choice(['metadata_extraction', 'gap_analysis', 'research', 'synthesis', 'document_generation']),
            progress_percentage=progress_map[status],
            created_by_id=creator.id,
            created_at=created_at,
            updated_at=datetime.utcnow(),
            submitted_at=datetime.utcnow() - timedelta(days=random.randint(1, 30)) if status in ['submitted', 'won', 'lost'] else None,
            outline_json={
                "extracted_objectives": [
                    {"text": "Modernize legacy infrastructure", "priority": "high"},
                    {"text": "Improve operational efficiency", "priority": "medium"},
                    {"text": "Enhance customer experience", "priority": "high"}
                ],
                "extracted_requirements": [
                    {"text": "Cloud migration within 12 months", "category": "timeline"},
                    {"text": "99.9% uptime SLA", "category": "technical"},
                    {"text": "Compliance with industry regulations", "category": "regulatory"}
                ],
                "metadata_extraction": {
                    "industry": industry,
                    "services": services,
                    "technologies": techs
                }
            }
        )
        session.add(pursuit)
        pursuits.append(pursuit)

    await session.commit()
    print(f"  Created {len(pursuits)} pursuits")
    return pursuits


async def seed_files(session: AsyncSession, pursuits: list[Pursuit], users: list[User]) -> list[PursuitFile]:
    """Create test files for pursuits."""
    print("Creating pursuit files...")
    files = []
    file_types = ['rfp', 'rfp_appendix', 'additional_reference']

    for pursuit in pursuits:
        # Each pursuit gets 1-3 files
        num_files = random.randint(1, 3)
        uploader = random.choice(users)

        for j in range(num_files):
            file_type = random.choice(file_types)
            ext = random.choice(['.pdf', '.docx', '.xlsx'])

            file = PursuitFile(
                id=uuid.uuid4(),
                pursuit_id=pursuit.id,
                file_name=f"{file_type}_{pursuit.entity_name.replace(' ', '_').lower()}{ext}",
                file_type=file_type,
                file_path=f"/uploads/{pursuit.id}/{uuid.uuid4()}{ext}",
                file_size_bytes=random.randint(100000, 5000000),
                mime_type='application/pdf' if ext == '.pdf' else 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                description=f"Sample {file_type} document for {pursuit.entity_name}",
                uploaded_by_id=uploader.id,
                uploaded_by_name=uploader.full_name,
                extraction_status=random.choice(['pending', 'completed']),
                uploaded_at=pursuit.created_at + timedelta(hours=random.randint(1, 48))
            )
            session.add(file)
            files.append(file)

    await session.commit()
    print(f"  Created {len(files)} files")
    return files


async def generate_embeddings(pursuits: list[Pursuit]):
    """Generate embeddings for pursuits in ChromaDB."""
    print("Generating embeddings in ChromaDB...")

    try:
        import chromadb
        from chromadb.config import Settings

        # Connect to ChromaDB
        client = chromadb.HttpClient(host="chroma", port=8000)

        # Get or create collection
        collection = client.get_or_create_collection(
            name="pursuit_embeddings",
            metadata={"description": "Pursuit content embeddings for similarity search"}
        )

        # Add documents
        ids = []
        documents = []
        metadatas = []

        for pursuit in pursuits:
            if pursuit.requirements_text:
                ids.append(str(pursuit.id))
                documents.append(pursuit.requirements_text[:5000])  # Limit text length
                metadatas.append({
                    "entity_name": pursuit.entity_name,
                    "industry": pursuit.industry or "",
                    "status": pursuit.status,
                    "created_at": pursuit.created_at.isoformat()
                })

        if ids:
            collection.add(
                ids=ids,
                documents=documents,
                metadatas=metadatas
            )
            print(f"  Generated embeddings for {len(ids)} pursuits")
        else:
            print("  No documents to embed")

    except Exception as e:
        print(f"  Warning: Could not generate embeddings: {e}")
        print("  (ChromaDB may not be available)")


async def main():
    parser = argparse.ArgumentParser(description="Seed test data into the database")
    parser.add_argument("--count", type=int, default=10, help="Number of base records to create")
    parser.add_argument("--type", choices=["users", "pursuits", "files", "all"], default="all", help="Type of data to seed")
    parser.add_argument("--clear", action="store_true", help="Clear existing data before seeding")
    args = parser.parse_args()

    print("\n" + "="*60)
    print("  DATABASE SEEDING SCRIPT")
    print("="*60 + "\n")

    async with AsyncSessionLocal() as session:
        # Clear data if requested
        if args.clear:
            await clear_data(session)

        users = []
        pursuits = []
        files = []

        # Seed based on type
        if args.type in ["users", "all"]:
            users = await seed_users(session, args.count)

        if args.type in ["pursuits", "all"]:
            if not users:
                # Need users for pursuits
                result = await session.execute(text("SELECT COUNT(*) FROM users"))
                user_count = result.scalar()
                if user_count == 0:
                    users = await seed_users(session, 5)
                else:
                    from sqlalchemy import select
                    result = await session.execute(select(User).limit(10))
                    users = list(result.scalars().all())

            pursuits = await seed_pursuits(session, users, args.count * 3)  # 3 pursuits per user

        if args.type in ["files", "all"]:
            if not pursuits:
                from sqlalchemy import select
                result = await session.execute(select(Pursuit).limit(50))
                pursuits = list(result.scalars().all())

            if pursuits:
                files = await seed_files(session, pursuits, users or [])

        # Generate embeddings
        if args.type in ["pursuits", "all"] and pursuits:
            await generate_embeddings(pursuits)

        # Print summary
        print("\n" + "="*60)
        print("  SEED COMPLETE")
        print("="*60)
        print("\n| Type      | Count  | Status  |")
        print("|-----------|--------|---------|")
        print(f"| Users     | {len(users):>6} | Created |")
        print(f"| Pursuits  | {len(pursuits):>6} | Created |")
        print(f"| Files     | {len(files):>6} | Created |")
        embeddings_count = len([p for p in pursuits if p.requirements_text]) if pursuits else 0
        print(f"| Embeddings| {embeddings_count:>6} | Generated |")
        print("\nDatabase ready for testing.")
        print("\nTest user credentials:")
        print("  Email: test@example.com")
        print("  Password: password123")
        print()


if __name__ == "__main__":
    asyncio.run(main())
