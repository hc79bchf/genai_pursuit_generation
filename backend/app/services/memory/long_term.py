"""
Long-term memory service using PostgreSQL.

Used for persistent organizational knowledge:
- Organization's field naming conventions
- Common client patterns
"""

from datetime import datetime
from typing import Any, Optional, Dict
import json

from sqlalchemy import Column, String, JSON, DateTime, Text, select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.core.database import Base
from app.services.memory.base import BaseMemoryService, MemoryItem


class LongTermMemoryModel(Base):
    """SQLAlchemy model for long-term memory storage."""

    __tablename__ = "agent_long_term_memory"

    key = Column(String(255), primary_key=True)
    agent_type = Column(String(100), nullable=False, index=True)
    memory_type = Column(String(100), nullable=False, index=True)
    value = Column(JSON, nullable=False)
    metadata_ = Column("metadata", JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class LongTermMemoryService(BaseMemoryService):
    """PostgreSQL-backed long-term memory for persistent organizational knowledge."""

    def __init__(self, database_url: str):
        self.database_url = database_url
        self._engine = create_async_engine(database_url)
        self._session_factory = async_sessionmaker(self._engine, expire_on_commit=False)

    async def _get_session(self) -> AsyncSession:
        """Get a database session."""
        return self._session_factory()

    async def store(
        self,
        key: str,
        value: Any,
        metadata: Optional[Dict[str, Any]] = None,
        ttl_seconds: Optional[int] = None  # Ignored for long-term memory
    ) -> None:
        """Store a memory item in PostgreSQL."""
        async with self._session_factory() as session:
            # Check if exists
            result = await session.execute(
                select(LongTermMemoryModel).where(LongTermMemoryModel.key == key)
            )
            existing = result.scalar_one_or_none()

            if existing:
                existing.value = value
                existing.metadata_ = metadata or {}
                existing.updated_at = datetime.utcnow()
            else:
                memory = LongTermMemoryModel(
                    key=key,
                    agent_type=metadata.get("agent_type", "metadata_extraction") if metadata else "metadata_extraction",
                    memory_type=metadata.get("memory_type", "general") if metadata else "general",
                    value=value,
                    metadata_=metadata or {}
                )
                session.add(memory)

            await session.commit()

    async def retrieve(self, key: str) -> Optional[MemoryItem]:
        """Retrieve a memory item from PostgreSQL."""
        async with self._session_factory() as session:
            result = await session.execute(
                select(LongTermMemoryModel).where(LongTermMemoryModel.key == key)
            )
            memory = result.scalar_one_or_none()

            if memory is None:
                return None

            return MemoryItem(
                key=memory.key,
                value=memory.value,
                metadata=memory.metadata_ or {},
                created_at=memory.created_at,
                updated_at=memory.updated_at
            )

    async def update(
        self,
        key: str,
        value: Any,
        metadata: Optional[Dict[str, Any]] = None
    ) -> None:
        """Update an existing memory item."""
        async with self._session_factory() as session:
            result = await session.execute(
                select(LongTermMemoryModel).where(LongTermMemoryModel.key == key)
            )
            existing = result.scalar_one_or_none()

            if existing is None:
                raise KeyError(f"Memory key '{key}' not found")

            existing.value = value
            if metadata:
                existing.metadata_ = {**(existing.metadata_ or {}), **metadata}
            existing.updated_at = datetime.utcnow()

            await session.commit()

    async def delete(self, key: str) -> None:
        """Delete a memory item from PostgreSQL."""
        async with self._session_factory() as session:
            await session.execute(
                delete(LongTermMemoryModel).where(LongTermMemoryModel.key == key)
            )
            await session.commit()

    async def exists(self, key: str) -> bool:
        """Check if a memory item exists."""
        async with self._session_factory() as session:
            result = await session.execute(
                select(LongTermMemoryModel.key).where(LongTermMemoryModel.key == key)
            )
            return result.scalar_one_or_none() is not None

    async def get_naming_conventions(self) -> dict[str, str]:
        """Get organization's field naming conventions."""
        memory = await self.retrieve("naming_conventions")
        return memory.value if memory else {}

    async def update_naming_conventions(self, field_name: str, convention: str) -> None:
        """Update a field naming convention."""
        conventions = await self.get_naming_conventions()
        conventions[field_name] = convention

        await self.store(
            "naming_conventions",
            conventions,
            metadata={
                "agent_type": "metadata_extraction",
                "memory_type": "naming_conventions"
            }
        )

    async def get_client_patterns(self) -> list[dict]:
        """Get common client patterns learned over time."""
        memory = await self.retrieve("client_patterns")
        return memory.value if memory else []

    async def add_client_pattern(
        self,
        industry: str,
        pattern_type: str,
        pattern: dict[str, Any]
    ) -> None:
        """Add a new client pattern."""
        patterns = await self.get_client_patterns()

        patterns.append({
            "industry": industry,
            "pattern_type": pattern_type,
            "pattern": pattern,
            "created_at": datetime.utcnow().isoformat(),
            "usage_count": 1
        })

        await self.store(
            "client_patterns",
            patterns,
            metadata={
                "agent_type": "metadata_extraction",
                "memory_type": "client_patterns"
            }
        )

    async def get_patterns_for_industry(self, industry: str) -> list[dict]:
        """Get patterns specific to an industry."""
        all_patterns = await self.get_client_patterns()
        return [p for p in all_patterns if p.get("industry") == industry]

    async def query_by_type(self, agent_type: str, memory_type: str) -> list[MemoryItem]:
        """Query memories by agent type and memory type."""
        async with self._session_factory() as session:
            result = await session.execute(
                select(LongTermMemoryModel).where(
                    LongTermMemoryModel.agent_type == agent_type,
                    LongTermMemoryModel.memory_type == memory_type
                )
            )
            memories = result.scalars().all()

            return [
                MemoryItem(
                    key=m.key,
                    value=m.value,
                    metadata=m.metadata_ or {},
                    created_at=m.created_at,
                    updated_at=m.updated_at
                )
                for m in memories
            ]

    async def close(self) -> None:
        """Close database connections."""
        await self._engine.dispose()
