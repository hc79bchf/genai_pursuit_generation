"""
Migration script to add pursuit_partner and pursuit_manager fields to pursuits table.

Run this script to add the new columns without losing existing data.

Usage:
    # From backend directory
    python scripts/migrate_add_pursuit_team_fields.py

    # Or in Docker
    docker exec pursuit_backend python scripts/migrate_add_pursuit_team_fields.py
"""

import asyncio
import sys
import os

# Add the backend directory to the path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.core.database import engine


async def migrate():
    """Add pursuit team fields to pursuits table."""

    columns_to_add = [
        ("pursuit_partner_name", "VARCHAR(255)"),
        ("pursuit_partner_email", "VARCHAR(255)"),
        ("pursuit_manager_name", "VARCHAR(255)"),
        ("pursuit_manager_email", "VARCHAR(255)"),
    ]

    async with engine.begin() as conn:
        for column_name, column_type in columns_to_add:
            # Check if column exists
            result = await conn.execute(text(f"""
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'pursuits' AND column_name = '{column_name}'
            """))

            exists = result.fetchone() is not None

            if exists:
                print(f"Column '{column_name}' already exists, skipping...")
            else:
                print(f"Adding column '{column_name}'...")
                await conn.execute(text(f"""
                    ALTER TABLE pursuits
                    ADD COLUMN {column_name} {column_type}
                """))
                print(f"Column '{column_name}' added successfully!")

    print("\nMigration completed!")


if __name__ == "__main__":
    asyncio.run(migrate())
