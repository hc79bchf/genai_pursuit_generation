from mcp.server.fastmcp import FastMCP
import chromadb
import os
from typing import List, Dict, Any

# Initialize FastMCP server
mcp = FastMCP("chroma-mcp")

# Initialize ChromaDB client
# We use the environment variables to connect to the ChromaDB service
CHROMA_HOST = os.getenv("CHROMADB_HOST", "chroma")
CHROMA_PORT = int(os.getenv("CHROMADB_PORT", "8000"))

try:
    chroma_client = chromadb.HttpClient(host=CHROMA_HOST, port=CHROMA_PORT)
except Exception as e:
    print(f"Warning: Could not connect to ChromaDB at {CHROMA_HOST}:{CHROMA_PORT}. Error: {e}")
    chroma_client = None

@mcp.tool()
async def search_similar_pursuits(query: str, limit: int = 5) -> List[Dict[str, Any]]:
    """
    Search for similar past pursuits based on a semantic query.
    
    Args:
        query: The semantic search query (e.g., "healthcare data migration projects")
        limit: Number of results to return (default: 5)
        
    Returns:
        List of similar pursuits with metadata and distances
    """
    if not chroma_client:
        return [{"error": "ChromaDB client not initialized"}]
        
    try:
        collection = chroma_client.get_or_create_collection("pursuits")
        results = collection.query(
            query_texts=[query],
            n_results=limit
        )
        
        # Format results
        formatted_results = []
        if results and results['ids']:
            for i in range(len(results['ids'][0])):
                formatted_results.append({
                    "id": results['ids'][0][i],
                    "metadata": results['metadatas'][0][i] if results['metadatas'] else {},
                    "document": results['documents'][0][i] if results['documents'] else "",
                    "distance": results['distances'][0][i] if results['distances'] else 0.0
                })
                
        return formatted_results
    except Exception as e:
        return [{"error": str(e)}]

@mcp.tool()
async def search_rfp_content(query: str, rfp_id: str, limit: int = 5) -> List[Dict[str, Any]]:
    """
    Search for relevant content within a specific RFP document.
    
    Args:
        query: The semantic search query
        rfp_id: The ID of the RFP to search within
        limit: Number of results to return (default: 5)
        
    Returns:
        List of relevant RFP sections
    """
    if not chroma_client:
        return [{"error": "ChromaDB client not initialized"}]
        
    try:
        collection = chroma_client.get_or_create_collection("rfp_contents")
        results = collection.query(
            query_texts=[query],
            n_results=limit,
            where={"rfp_id": rfp_id}
        )
        
        formatted_results = []
        if results and results['ids']:
            for i in range(len(results['ids'][0])):
                formatted_results.append({
                    "id": results['ids'][0][i],
                    "content": results['documents'][0][i] if results['documents'] else "",
                    "metadata": results['metadatas'][0][i] if results['metadatas'] else {}
                })
                
        return formatted_results
    except Exception as e:
        return [{"error": str(e)}]

@mcp.resource("pursuit://{id}/embeddings")
async def get_pursuit_embeddings(id: str) -> str:
    """
    Get the raw embeddings for a specific pursuit.
    """
    if not chroma_client:
        return "Error: ChromaDB client not initialized"
        
    try:
        collection = chroma_client.get_or_create_collection("pursuits")
        result = collection.get(ids=[id], include=["embeddings"])
        
        if result and result['embeddings']:
            return str(result['embeddings'][0])
        return "No embeddings found"
    except Exception as e:
        return f"Error: {str(e)}"
