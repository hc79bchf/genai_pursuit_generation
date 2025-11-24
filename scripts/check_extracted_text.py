import asyncio
import os
import sys
from sqlalchemy import text

# Add app to path
sys.path.append(os.getcwd())

from app.core.database import AsyncSessionLocal

PURSUIT_ID = "0dfff069-2b1e-4b58-b3db-29ea740a400d"

async def main():
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            text("SELECT id, file_name, extracted_text, extraction_status FROM pursuit_files WHERE pursuit_id = :pursuit_id"),
            {"pursuit_id": PURSUIT_ID}
        )
        files = result.fetchall()
        
        print(f"Found {len(files)} files for pursuit {PURSUIT_ID}")
        for file in files:
            print(f"\nFile: {file.file_name} (ID: {file.id})")
            print(f"Status: {file.extraction_status}")
            content = file.extracted_text
            if content:
                print(f"Extracted Text Length: {len(content)}")
                print(f"Preview (first 500 chars):\n{content[:500]}")
            else:
                print("Extracted Text: <EMPTY/NULL>")

if __name__ == "__main__":
    asyncio.run(main())
