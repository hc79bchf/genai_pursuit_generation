import os
import chromadb
from chromadb.utils import embedding_functions
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration
CHROMA_HOST = "localhost"
CHROMA_PORT = 8001
COLLECTION_NAME = "prior_proposals"
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

if not OPENAI_API_KEY:
    raise ValueError("OPENAI_API_KEY not found in environment variables")

def main():
    print(f"Connecting to ChromaDB at {CHROMA_HOST}:{CHROMA_PORT}...")
    try:
        client = chromadb.HttpClient(host=CHROMA_HOST, port=CHROMA_PORT)
    except Exception as e:
        print(f"Failed to connect to ChromaDB HTTP client: {e}")
        print("Falling back to local PersistentClient at ./chroma_db")
        client = chromadb.PersistentClient(path="./chroma_db")

    openai_ef = embedding_functions.OpenAIEmbeddingFunction(
        api_key=OPENAI_API_KEY,
        model_name="text-embedding-3-small"
    )

    try:
        collection = client.get_collection(
            name=COLLECTION_NAME,
            embedding_function=openai_ef
        )
    except Exception as e:
        print(f"Error getting collection: {e}")
        return

    query_text = "AI Governance Framework"
    print(f"\nQuerying for: '{query_text}'")
    
    results = collection.query(
        query_texts=[query_text],
        n_results=3
    )

    for i, doc in enumerate(results['documents'][0]):
        metadata = results['metadatas'][0][i]
        print(f"\nResult {i+1}:")
        print(f"Source: {metadata['source']}")
        print(f"Content Snippet: {doc[:200]}...")

if __name__ == "__main__":
    main()
