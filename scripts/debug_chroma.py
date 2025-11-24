import chromadb
from mem0 import Memory
import os
import sys

def test_chroma_direct():
    print("Testing direct ChromaDB connection...")
    try:
        client = chromadb.HttpClient(host="chroma", port=8000)
        print("Connected to ChromaDB!")
        print("Heartbeat:", client.heartbeat())
        print("Collections:", client.list_collections())
    except Exception as e:
        print(f"Direct connection failed: {e}")

def test_mem0():
    print("\nTesting mem0 connection...")
    config = {
        "vector_store": {
            "provider": "chroma",
            "config": {
                "collection_name": "debug_memory",
                "host": "chroma",
                "port": 8000,
            }
        }
    }
    try:
        m = Memory.from_config(config)
        m.add("test memory", user_id="debug_user")
        print("Added to mem0!")
        print(m.search("test", user_id="debug_user"))
    except Exception as e:
        print(f"mem0 connection failed: {e}")

if __name__ == "__main__":
    test_chroma_direct()
    test_mem0()
