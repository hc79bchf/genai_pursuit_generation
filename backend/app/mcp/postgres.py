from mcp.server.fastmcp import FastMCP
import asyncpg
import os
from typing import List, Dict, Any, Optional

# Initialize FastMCP server
mcp = FastMCP("postgres-mcp")

# Database connection parameters
DB_USER = os.getenv("POSTGRES_USER", "pursuit_user")
DB_PASSWORD = os.getenv("POSTGRES_PASSWORD", "pursuit_pass")
DB_HOST = os.getenv("POSTGRES_HOST", "db")
DB_PORT = os.getenv("POSTGRES_PORT", "5432")
DB_NAME = os.getenv("POSTGRES_DB", "pursuit_db")

DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

async def get_db_connection():
    return await asyncpg.connect(DATABASE_URL)

@mcp.tool()
async def get_client_details(client_name: str) -> Dict[str, Any]:
    """
    Retrieve details about a client from the database.
    
    Args:
        client_name: Name of the client organization
        
    Returns:
        Dictionary containing client details and history
    """
    conn = None
    try:
        conn = await get_db_connection()
        # Note: This assumes a 'pursuits' table exists with 'entity_name' column
        # We'll query for pursuits related to this client to aggregate details
        rows = await conn.fetch(
            "SELECT * FROM pursuits WHERE entity_name ILIKE $1 ORDER BY created_at DESC LIMIT 5",
            f"%{client_name}%"
        )
        
        if not rows:
            return {"message": f"No records found for client: {client_name}"}
            
        history = []
        for row in rows:
            history.append({
                "id": str(row['id']),
                "project_name": row.get('project_name', 'Unknown'),
                "status": row.get('status', 'Unknown'),
                "date": str(row.get('created_at', ''))
            })
            
        return {
            "client_name": client_name,
            "recent_pursuits": history,
            "total_pursuits": len(rows)
        }
    except Exception as e:
        return {"error": str(e)}
    finally:
        if conn:
            await conn.close()

@mcp.tool()
async def get_pursuit_metadata(pursuit_id: str) -> Dict[str, Any]:
    """
    Retrieve metadata for a specific pursuit.
    
    Args:
        pursuit_id: The UUID of the pursuit
        
    Returns:
        Dictionary containing pursuit metadata
    """
    conn = None
    try:
        conn = await get_db_connection()
        row = await conn.fetchrow(
            "SELECT * FROM pursuits WHERE id = $1",
            pursuit_id
        )
        
        if not row:
            return {"error": "Pursuit not found"}
            
        return dict(row)
    except Exception as e:
        return {"error": str(e)}
    finally:
        if conn:
            await conn.close()

@mcp.resource("postgres://tables/pursuits")
async def list_pursuits() -> str:
    """
    List the most recent pursuits.
    """
    conn = None
    try:
        conn = await get_db_connection()
        rows = await conn.fetch("SELECT id, entity_name, status, created_at FROM pursuits ORDER BY created_at DESC LIMIT 20")
        
        result = "Recent Pursuits:\n"
        for row in rows:
            result += f"- {row['entity_name']} ({row['status']}) - ID: {row['id']}\n"
            
        return result
    except Exception as e:
        return f"Error: {str(e)}"
    finally:
        if conn:
            await conn.close()
