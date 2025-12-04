"""
Episodic memory service using ChromaDB.

Used for semantic similarity search on past experiences:
- Past extractions and their accuracy scores
- User corrections history
"""

import json
from datetime import datetime
from typing import Any, Optional, Dict
import hashlib

import chromadb
from chromadb.config import Settings

from app.services.memory.base import BaseMemoryService, MemoryItem


class EpisodicMemoryService(BaseMemoryService):
    """ChromaDB-backed episodic memory for past experiences with semantic search."""

    def __init__(
        self,
        persist_directory: str = "./chroma_data",
        collection_name: str = "metadata_extraction_episodes"
    ):
        self.persist_directory = persist_directory
        self.collection_name = collection_name
        self._client: chromadb.Client | None = None
        self._collection = None

    def _get_client(self) -> chromadb.Client:
        """Get or create ChromaDB client."""
        if self._client is None:
            self._client = chromadb.Client(Settings(
                persist_directory=self.persist_directory,
                anonymized_telemetry=False
            ))
        return self._client

    def _get_collection(self):
        """Get or create the collection."""
        if self._collection is None:
            client = self._get_client()
            self._collection = client.get_or_create_collection(
                name=self.collection_name,
                metadata={"hnsw:space": "cosine"}
            )
        return self._collection

    async def store(
        self,
        key: str,
        value: Any,
        metadata: Optional[Dict[str, Any]] = None,
        ttl_seconds: Optional[int] = None  # Ignored for episodic memory
    ) -> None:
        """Store a memory item in ChromaDB with embeddings."""
        collection = self._get_collection()

        # Prepare document text for embedding
        if isinstance(value, dict):
            doc_text = json.dumps(value)
        else:
            doc_text = str(value)

        # Prepare metadata (ChromaDB requires flat structure)
        chroma_metadata = {
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        }
        if metadata:
            for k, v in metadata.items():
                if isinstance(v, (str, int, float, bool)):
                    chroma_metadata[k] = v
                else:
                    chroma_metadata[k] = json.dumps(v)

        collection.upsert(
            ids=[key],
            documents=[doc_text],
            metadatas=[chroma_metadata]
        )

    async def retrieve(self, key: str) -> Optional[MemoryItem]:
        """Retrieve a memory item by key."""
        collection = self._get_collection()

        result = collection.get(
            ids=[key],
            include=["documents", "metadatas"]
        )

        if not result["ids"]:
            return None

        metadata = result["metadatas"][0] if result["metadatas"] else {}

        # Parse stored JSON back to dict if possible
        doc = result["documents"][0]
        try:
            value = json.loads(doc)
        except (json.JSONDecodeError, TypeError):
            value = doc

        return MemoryItem(
            key=key,
            value=value,
            metadata=metadata,
            created_at=datetime.fromisoformat(metadata.get("created_at", datetime.utcnow().isoformat())),
            updated_at=datetime.fromisoformat(metadata.get("updated_at", datetime.utcnow().isoformat()))
        )

    async def update(
        self,
        key: str,
        value: Any,
        metadata: Optional[Dict[str, Any]] = None
    ) -> None:
        """Update an existing memory item."""
        existing = await self.retrieve(key)
        if existing is None:
            raise KeyError(f"Memory key '{key}' not found")

        # Merge metadata
        new_metadata = existing.metadata.copy()
        if metadata:
            new_metadata.update(metadata)
        new_metadata["updated_at"] = datetime.utcnow().isoformat()

        await self.store(key, value, new_metadata)

    async def delete(self, key: str) -> None:
        """Delete a memory item."""
        collection = self._get_collection()
        collection.delete(ids=[key])

    async def exists(self, key: str) -> bool:
        """Check if a memory item exists."""
        collection = self._get_collection()
        result = collection.get(ids=[key])
        return len(result["ids"]) > 0

    async def search_similar(
        self,
        query_text: str,
        n_results: int = 5,
        filter_metadata: Optional[Dict[str, Any]] = None
    ) -> list[dict]:
        """Search for similar memories using semantic similarity."""
        collection = self._get_collection()

        where_clause = None
        if filter_metadata:
            where_clause = {k: v for k, v in filter_metadata.items() if isinstance(v, (str, int, float, bool))}

        results = collection.query(
            query_texts=[query_text],
            n_results=n_results,
            where=where_clause if where_clause else None,
            include=["documents", "metadatas", "distances"]
        )

        similar_items = []
        for i, id_ in enumerate(results["ids"][0]):
            doc = results["documents"][0][i]
            try:
                value = json.loads(doc)
            except (json.JSONDecodeError, TypeError):
                value = doc

            similar_items.append({
                "key": id_,
                "value": value,
                "metadata": results["metadatas"][0][i] if results["metadatas"] else {},
                "distance": results["distances"][0][i] if results["distances"] else None
            })

        return similar_items

    async def store_extraction_episode(
        self,
        pursuit_id: str,
        rfp_text: str,
        extracted_fields: dict[str, Any],
        accuracy_score: Optional[float] = None,
        user_corrections: Optional[list] = None
    ) -> str:
        """Store a complete extraction episode for learning."""
        # Create unique key
        key = f"extraction:{pursuit_id}:{hashlib.md5(rfp_text[:500].encode()).hexdigest()[:8]}"

        episode_data = {
            "rfp_text_preview": rfp_text[:1000],  # Store preview for context
            "extracted_fields": extracted_fields,
            "accuracy_score": accuracy_score,
            "user_corrections": user_corrections or [],
            "pursuit_id": pursuit_id
        }

        metadata = {
            "episode_type": "extraction",
            "pursuit_id": pursuit_id,
            "accuracy_score": accuracy_score if accuracy_score else 0.0,
            "had_corrections": len(user_corrections or []) > 0
        }

        # Add industry/entity for filtering if available
        if "industry" in extracted_fields:
            industry_val = extracted_fields["industry"]
            if isinstance(industry_val, dict):
                metadata["industry"] = industry_val.get("value", "")
            else:
                metadata["industry"] = str(industry_val)

        await self.store(key, episode_data, metadata)
        return key

    async def get_similar_extractions(
        self,
        rfp_text: str,
        industry: Optional[str] = None,
        n_results: int = 5
    ) -> list[dict]:
        """Find similar past extractions for learning."""
        filter_metadata = {"episode_type": "extraction"}
        if industry:
            filter_metadata["industry"] = industry

        return await self.search_similar(
            query_text=rfp_text[:1000],  # Use preview length
            n_results=n_results,
            filter_metadata=filter_metadata
        )

    async def get_correction_patterns(
        self,
        field_name: str,
        n_results: int = 10
    ) -> list[dict]:
        """Find past corrections for a specific field."""
        results = await self.search_similar(
            query_text=f"correction for field {field_name}",
            n_results=n_results,
            filter_metadata={"had_corrections": True}
        )

        # Filter to only episodes with corrections for this field
        relevant = []
        for item in results:
            corrections = item["value"].get("user_corrections", [])
            field_corrections = [c for c in corrections if c.get("field") == field_name]
            if field_corrections:
                relevant.append({
                    **item,
                    "field_corrections": field_corrections
                })

        return relevant

    async def get_high_accuracy_extractions(
        self,
        min_accuracy: float = 0.9,
        industry: Optional[str] = None,
        n_results: int = 10
    ) -> list[dict]:
        """Get past extractions with high accuracy scores for learning."""
        collection = self._get_collection()

        where_clause = {
            "episode_type": "extraction",
            "accuracy_score": {"$gte": min_accuracy}
        }
        if industry:
            where_clause["industry"] = industry

        results = collection.get(
            where=where_clause,
            include=["documents", "metadatas"],
            limit=n_results
        )

        items = []
        for i, id_ in enumerate(results["ids"]):
            doc = results["documents"][i]
            try:
                value = json.loads(doc)
            except (json.JSONDecodeError, TypeError):
                value = doc

            items.append({
                "key": id_,
                "value": value,
                "metadata": results["metadatas"][i] if results["metadatas"] else {}
            })

        return items

    async def close(self) -> None:
        """Close ChromaDB connection."""
        self._collection = None
        self._client = None
