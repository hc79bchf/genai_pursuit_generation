import chromadb
import os

host = os.getenv("CHROMADB_HOST", "chroma")
port = int(os.getenv("CHROMADB_PORT", 8000))

print(f"Connecting to Chroma at {host}:{port}...")

try:
    client = chromadb.HttpClient(host=host, port=port)
    print("Client created.")
    print("Heartbeat:", client.heartbeat())
    print("Collections:", client.list_collections())
    print("Success!")
except Exception as e:
    print(f"Error: {e}")
