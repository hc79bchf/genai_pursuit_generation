import argparse
import uvicorn
from app.mcp.chroma import mcp as chroma_mcp
from app.mcp.postgres import mcp as postgres_mcp

def run_chroma_server(host="0.0.0.0", port=8000):
    """Run the ChromaDB MCP server using SSE"""
    print(f"Starting ChromaDB MCP Server on {host}:{port}")
    # FastMCP provides a run method, but for SSE we might need to mount it
    # For now, let's use the built-in run method if available or uvicorn
    # chroma_mcp.run(transport="sse")
    uvicorn.run(chroma_mcp.sse_app, host=host, port=port)

def run_postgres_server(host="0.0.0.0", port=8000):
    """Run the PostgreSQL MCP server using SSE"""
    print(f"Starting PostgreSQL MCP Server on {host}:{port}")
    # postgres_mcp.run(transport="sse")
    uvicorn.run(postgres_mcp.sse_app, host=host, port=port)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run MCP Servers")
    parser.add_argument("server", choices=["chroma", "postgres"], help="Which server to run")
    parser.add_argument("--host", default="0.0.0.0", help="Host to bind to")
    parser.add_argument("--port", type=int, default=8000, help="Port to bind to")
    
    args = parser.parse_args()
    
    if args.server == "chroma":
        run_chroma_server(args.host, args.port)
    elif args.server == "postgres":
        run_postgres_server(args.host, args.port)
