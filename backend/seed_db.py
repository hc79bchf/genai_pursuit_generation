import asyncio
import os
import sys
import random
from datetime import date, timedelta

# Ensure app is in path if running from /app
sys.path.append("/app")

from app.core.database import AsyncSessionLocal, engine, Base
# Import models to register them with Base
from app.models import User, Pursuit, PursuitFile, AuditLog
from app.core.security import get_password_hash
from sqlalchemy.future import select

# Realistic data pools
COMPANIES = [
    "Acme Corp", "TechStart Inc", "SecureBank Holdings", "HealthFirst Medical",
    "CityGov Municipal", "GlobalTech Solutions", "Innovate Labs", "DataDriven Analytics",
    "CloudNine Services", "NextGen Enterprises", "Pioneer Systems", "Quantum Computing Co",
    "Apex Industries", "Horizon Digital", "Synergy Partners", "Vertex Technologies",
    "Catalyst Group", "Momentum Corp", "Elevate Solutions", "Frontier Networks"
]

INDUSTRIES = [
    "Technology", "Healthcare", "Financial Services", "Government", "Manufacturing",
    "Retail", "Energy", "Education", "Telecommunications", "Transportation",
    "Media & Entertainment", "Real Estate", "Professional Services", "Life Sciences"
]

SERVICE_TYPES = [
    ["IT Services", "Cloud Migration"], ["SaaS Implementation", "System Integration"],
    ["Security Audit", "Compliance"], ["EHR Integration", "Data Migration"],
    ["Digital Transformation", "Legacy Modernization"], ["Data Analytics", "BI Reporting"],
    ["DevOps Implementation", "CI/CD Pipeline"], ["AI/ML Development", "Automation"],
    ["Mobile App Development", "UX Design"], ["Infrastructure Management", "Monitoring"]
]

TECHNOLOGIES = [
    ["AWS", "Azure", "Kubernetes"], ["Salesforce", "AWS", "Node.js"],
    ["SOC2", "ISO 27001", "NIST"], ["HL7", "FHIR", "Epic"],
    ["React", "Python", "PostgreSQL"], ["Snowflake", "Databricks", "Python"],
    ["Jenkins", "Docker", "Terraform"], ["TensorFlow", "PyTorch", "MLflow"],
    ["React Native", "Flutter", "Swift"], ["Prometheus", "Grafana", "ELK Stack"]
]

GEOGRAPHIES = [
    "United States", "North America", "Global", "EMEA", "Asia Pacific",
    "Europe", "Latin America", "United Kingdom", "Canada", "Australia"
]

FIRST_NAMES = [
    "John", "Sarah", "Michael", "Emily", "Robert", "Jennifer", "David", "Lisa",
    "James", "Amanda", "William", "Jessica", "Richard", "Ashley", "Thomas", "Michelle"
]

LAST_NAMES = [
    "Smith", "Johnson", "Chen", "Wilson", "Martinez", "Brown", "Taylor", "Anderson",
    "Thomas", "Jackson", "White", "Harris", "Clark", "Lewis", "Robinson", "Walker"
]

STATUSES = ["draft", "in_review", "ready_for_submission", "submitted", "won", "lost"]
STATUS_WEIGHTS = [30, 25, 15, 15, 10, 5]  # Percentage distribution

TEMPLATE_IDS = [
    "federal-rfp", "enterprise-saas", "cybersecurity-audit", "healthcare-it",
    "state-local", "commercial-services", "tech-proposal", "consulting-engagement"
]

def generate_email(first_name, last_name, company):
    """Generate a realistic email address."""
    domain = company.lower().replace(" ", "").replace(".", "")[:10] + ".com"
    return f"{first_name.lower()}.{last_name.lower()}@{domain}"

def generate_person():
    """Generate a random person with name and email."""
    first = random.choice(FIRST_NAMES)
    last = random.choice(LAST_NAMES)
    company = random.choice(COMPANIES)
    return first, last, generate_email(first, last, company)

def generate_entity_number():
    """Generate a realistic entity number/ID."""
    prefixes = ["ENT", "CLI", "ORG", "ACC"]
    return f"{random.choice(prefixes)}-{random.randint(10000, 99999)}"

def generate_pursuit_data(user, index):
    """Generate realistic pursuit data."""
    company = random.choice(COMPANIES)
    industry = random.choice(INDUSTRIES)

    # Client contact
    client_first, client_last, client_email = generate_person()
    client_name = f"{client_first} {client_last}"

    # Entity sponsor
    sponsor_first, sponsor_last, sponsor_email = generate_person()
    sponsor_name = f"{sponsor_first} {sponsor_last}"

    # Entity contacts (multiple)
    contacts = []
    for _ in range(random.randint(1, 3)):
        c_first, c_last, c_email = generate_person()
        contacts.append(f"{c_first} {c_last} <{c_email}>")
    entity_contacts = "\n".join(contacts)

    # Pursuit partner and manager
    partner_first, partner_last, partner_email = generate_person()
    partner_name = f"{partner_first} {partner_last}"

    manager_first, manager_last, manager_email = generate_person()
    manager_name = f"{manager_first} {manager_last}"

    # Status with weighted random selection
    status = random.choices(STATUSES, weights=STATUS_WEIGHTS, k=1)[0]

    # Progress based on status
    progress_map = {
        "draft": random.randint(5, 40),
        "in_review": random.randint(40, 70),
        "ready_for_submission": random.randint(80, 95),
        "submitted": 100,
        "won": 100,
        "lost": 100,
    }
    progress = progress_map.get(status, 50)

    # Due date based on status
    if status in ["submitted", "won", "lost"]:
        due_date = date.today() - timedelta(days=random.randint(1, 90))
    else:
        due_date = date.today() + timedelta(days=random.randint(7, 90))

    service_idx = index % len(SERVICE_TYPES)
    tech_idx = index % len(TECHNOLOGIES)

    return {
        "entity_name": f"{company} - {industry} Project",
        "entity_number": generate_entity_number(),
        "client_pursuit_owner_name": client_name,
        "client_pursuit_owner_email": client_email,
        "entity_sponsor_name": sponsor_name,
        "entity_sponsor_email": sponsor_email,
        "entity_contacts": entity_contacts,
        "internal_pursuit_owner_name": user.full_name,
        "internal_pursuit_owner_email": user.email,
        "pursuit_partner_name": partner_name,
        "pursuit_partner_email": partner_email,
        "pursuit_manager_name": manager_name,
        "pursuit_manager_email": manager_email,
        "industry": industry,
        "service_types": SERVICE_TYPES[service_idx],
        "technologies": TECHNOLOGIES[tech_idx],
        "geography": random.choice(GEOGRAPHIES),
        "submission_due_date": due_date,
        "estimated_fees_usd": random.randint(50, 1000) * 1000,  # $50k to $1M
        "expected_format": random.choice(["docx", "pptx"]),
        "status": status,
        "selected_template_id": random.choice(TEMPLATE_IDS),
        "progress_percentage": progress,
    }


async def seed_db(count=10, clear=False):
    """Seed the database with test data."""

    if clear:
        print("Resetting database...")
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)
        print("Tables recreated.")

    print("Connecting to database...")
    try:
        async with AsyncSessionLocal() as session:
            # Check/create test users
            print("Setting up test users...")

            # Main test user
            result = await session.execute(select(User).filter(User.email == "test@example.com"))
            main_user = result.scalars().first()

            if not main_user:
                main_user = User(
                    email="test@example.com",
                    password_hash=get_password_hash("password123"),
                    full_name="Test User",
                    is_active=True
                )
                session.add(main_user)
                await session.commit()
                await session.refresh(main_user)
                print("  - Created main test user (test@example.com / password123)")
            else:
                print("  - Main test user already exists")

            # Additional users for variety
            additional_users = [
                ("alice.johnson@company.com", "Alice Johnson"),
                ("bob.smith@company.com", "Bob Smith"),
                ("carol.williams@company.com", "Carol Williams"),
            ]

            users = [main_user]
            for email, full_name in additional_users:
                result = await session.execute(select(User).filter(User.email == email))
                user = result.scalars().first()
                if not user:
                    user = User(
                        email=email,
                        password_hash=get_password_hash("password123"),
                        full_name=full_name,
                        is_active=True
                    )
                    session.add(user)
                    await session.commit()
                    await session.refresh(user)
                    print(f"  - Created user: {full_name}")
                users.append(user)

            # Create pursuits
            print(f"\nCreating {count} sample pursuits...")
            pursuits_created = 0

            for i in range(count):
                # Rotate through users
                user = users[i % len(users)]
                pursuit_data = generate_pursuit_data(user, i)

                pursuit = Pursuit(
                    internal_pursuit_owner_id=user.id,
                    created_by_id=user.id,
                    **pursuit_data
                )
                session.add(pursuit)
                pursuits_created += 1

                if (i + 1) % 10 == 0:
                    print(f"  - Created {i + 1} pursuits...")

            await session.commit()
            print(f"  - Created {pursuits_created} sample pursuits.")

            # Create an audit log entry
            print("\nCreating audit log entry...")
            audit_log = AuditLog(
                user_id=main_user.id,
                action="seed",
                entity_type="database",
                details={"message": f"Database seeded with {count} pursuits", "count": count}
            )
            session.add(audit_log)
            await session.commit()

            # Summary
            print("\n" + "=" * 50)
            print("SEED COMPLETE")
            print("=" * 50)
            print(f"""
| Type      | Count | Status  |
|-----------|-------|---------|
| Users     | {len(users):5} | Created |
| Pursuits  | {pursuits_created:5} | Created |
| Audit Log | {1:5} | Created |

Test Credentials:
  Email: test@example.com
  Password: password123

Database ready for testing!
""")

    except Exception as e:
        print(f"Error seeding database: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Seed the database with test data")
    parser.add_argument("--count", type=int, default=10, help="Number of pursuits to create")
    parser.add_argument("--clear", action="store_true", help="Clear existing data before seeding")

    args = parser.parse_args()

    asyncio.run(seed_db(count=args.count, clear=args.clear))
