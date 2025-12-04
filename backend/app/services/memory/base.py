"""
Base memory service interfaces and types.
"""

from abc import ABC, abstractmethod
from typing import Any, Optional, Dict
from datetime import datetime
from dataclasses import dataclass


@dataclass
class MemoryItem:
    """A single memory item."""
    key: str
    value: Any
    metadata: Dict[str, Any]
    created_at: datetime
    updated_at: datetime
    ttl_seconds: Optional[int] = None


class BaseMemoryService(ABC):
    """Abstract base class for memory services."""

    @abstractmethod
    async def store(self, key: str, value: Any, metadata: Optional[Dict[str, Any]] = None, ttl_seconds: Optional[int] = None) -> None:
        """Store a memory item."""
        pass

    @abstractmethod
    async def retrieve(self, key: str) -> Optional[MemoryItem]:
        """Retrieve a memory item by key."""
        pass

    @abstractmethod
    async def update(self, key: str, value: Any, metadata: Optional[Dict[str, Any]] = None) -> None:
        """Update an existing memory item."""
        pass

    @abstractmethod
    async def delete(self, key: str) -> None:
        """Delete a memory item."""
        pass

    @abstractmethod
    async def exists(self, key: str) -> bool:
        """Check if a memory item exists."""
        pass
