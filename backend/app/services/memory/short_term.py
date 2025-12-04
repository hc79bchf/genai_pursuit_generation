"""
Short-term memory service using Redis.

Used for session-scoped, ephemeral data:
- Current RFP text
- User corrections in session
"""

import json
from datetime import datetime
from typing import Any, Optional, Dict

import redis.asyncio as redis

from app.services.memory.base import BaseMemoryService, MemoryItem


class ShortTermMemoryService(BaseMemoryService):
    """Redis-backed short-term memory for session data."""

    DEFAULT_TTL = 3600  # 1 hour default TTL for session data

    def __init__(self, redis_url: str = "redis://localhost:6379/0"):
        self.redis_url = redis_url
        self._client: Optional[redis.Redis] = None

    async def _get_client(self) -> redis.Redis:
        """Get or create Redis client."""
        if self._client is None:
            self._client = redis.from_url(self.redis_url, decode_responses=True)
        return self._client

    def _make_key(self, key: str) -> str:
        """Create namespaced Redis key."""
        return f"short_term:{key}"

    async def store(
        self,
        key: str,
        value: Any,
        metadata: Optional[Dict[str, Any]] = None,
        ttl_seconds: Optional[int] = None
    ) -> None:
        """Store a memory item in Redis with optional TTL."""
        client = await self._get_client()
        redis_key = self._make_key(key)

        now = datetime.utcnow().isoformat()
        data = {
            "value": value,
            "metadata": metadata or {},
            "created_at": now,
            "updated_at": now
        }

        ttl = ttl_seconds or self.DEFAULT_TTL
        await client.setex(redis_key, ttl, json.dumps(data))

    async def retrieve(self, key: str) -> Optional[MemoryItem]:
        """Retrieve a memory item from Redis."""
        client = await self._get_client()
        redis_key = self._make_key(key)

        data = await client.get(redis_key)
        if data is None:
            return None

        parsed = json.loads(data)
        return MemoryItem(
            key=key,
            value=parsed["value"],
            metadata=parsed["metadata"],
            created_at=datetime.fromisoformat(parsed["created_at"]),
            updated_at=datetime.fromisoformat(parsed["updated_at"]),
            ttl_seconds=await client.ttl(redis_key)
        )

    async def update(
        self,
        key: str,
        value: Any,
        metadata: Optional[Dict[str, Any]] = None
    ) -> None:
        """Update an existing memory item, preserving TTL."""
        client = await self._get_client()
        redis_key = self._make_key(key)

        # Get existing data and TTL
        existing = await client.get(redis_key)
        if existing is None:
            raise KeyError(f"Memory key '{key}' not found")

        parsed = json.loads(existing)
        ttl = await client.ttl(redis_key)

        # Update data
        parsed["value"] = value
        if metadata:
            parsed["metadata"].update(metadata)
        parsed["updated_at"] = datetime.utcnow().isoformat()

        # Store with remaining TTL
        if ttl > 0:
            await client.setex(redis_key, ttl, json.dumps(parsed))
        else:
            await client.set(redis_key, json.dumps(parsed))

    async def delete(self, key: str) -> None:
        """Delete a memory item from Redis."""
        client = await self._get_client()
        await client.delete(self._make_key(key))

    async def exists(self, key: str) -> bool:
        """Check if a memory item exists in Redis."""
        client = await self._get_client()
        return await client.exists(self._make_key(key)) > 0

    async def store_session_correction(
        self,
        session_id: str,
        field_name: str,
        original_value: Any,
        corrected_value: Any
    ) -> None:
        """Store a user correction made during a session."""
        key = f"session:{session_id}:corrections"

        # Get existing corrections
        existing = await self.retrieve(key)
        corrections = existing.value if existing else []

        corrections.append({
            "field": field_name,
            "original": original_value,
            "corrected": corrected_value,
            "timestamp": datetime.utcnow().isoformat()
        })

        await self.store(key, corrections, ttl_seconds=7200)  # 2 hours for corrections

    async def get_session_corrections(self, session_id: str) -> list:
        """Get all corrections made in a session."""
        key = f"session:{session_id}:corrections"
        existing = await self.retrieve(key)
        return existing.value if existing else []

    async def store_rfp_text(self, pursuit_id: str, rfp_text: str) -> None:
        """Store current RFP text for a pursuit."""
        key = f"pursuit:{pursuit_id}:rfp_text"
        await self.store(key, rfp_text, ttl_seconds=3600)

    async def get_rfp_text(self, pursuit_id: str) -> Optional[str]:
        """Get stored RFP text for a pursuit."""
        key = f"pursuit:{pursuit_id}:rfp_text"
        existing = await self.retrieve(key)
        return existing.value if existing else None

    async def close(self) -> None:
        """Close Redis connection."""
        if self._client:
            await self._client.close()
            self._client = None
