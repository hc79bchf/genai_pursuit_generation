import json
import logging
from typing import List, Dict, Any, Optional
from app.core.config import settings

logger = logging.getLogger(__name__)

class MemoryService:
    def __init__(self):
        self.memory = None
        self.redis_client = None

        # Try to initialize mem0 (ChromaDB) - gracefully handle if unavailable
        try:
            from mem0 import Memory
            self.memory = Memory.from_config(settings.MEM0_CONFIG)
            logger.info("Memory service initialized with mem0/ChromaDB")
        except Exception as e:
            logger.warning(f"Could not initialize mem0/ChromaDB: {e}. Long-term memory disabled.")

        # Try to initialize Redis - gracefully handle if unavailable
        try:
            import redis
            self.redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
            # Test connection
            self.redis_client.ping()
            logger.info("Memory service initialized with Redis")
        except Exception as e:
            logger.warning(f"Could not connect to Redis: {e}. Short-term memory disabled.")

    def add_long_term(self, text: str, user_id: str, metadata: Optional[Dict[str, Any]] = None):
        """
        Add text to long-term memory (mem0/ChromaDB).
        """
        if not self.memory:
            logger.debug("Long-term memory not available, skipping add")
            return None
        try:
            result = self.memory.add(text, user_id=user_id, metadata=metadata)
            logger.info(f"Added to long-term memory for user {user_id}. Result: {result}")
            return result
        except Exception as e:
            logger.error(f"Error adding to long-term memory: {e}", exc_info=True)

    def search_long_term(self, query: str, user_id: str, limit: int = 5) -> List[Dict[str, Any]]:
        """
        Search long-term memory.
        """
        if not self.memory:
            logger.debug("Long-term memory not available, returning empty results")
            return []
        try:
            results = self.memory.search(query, user_id=user_id, limit=limit)
            logger.info(f"Memory search raw results type: {type(results)}")
            logger.info(f"Memory search raw results: {results}")

            if isinstance(results, dict) and "results" in results:
                return results["results"]
            return results
        except Exception as e:
            logger.error(f"Error searching long-term memory: {e}", exc_info=True)
            return []

    def add_short_term(self, session_id: str, role: str, content: str):
        """
        Add a message to short-term memory (Redis list).
        """
        if not self.redis_client:
            logger.debug("Short-term memory not available, skipping add")
            return
        try:
            try:
                message = json.dumps({"role": role, "content": content})
            except TypeError:
                logger.error(f"Failed to serialize message content for session {session_id}")
                return

            key = f"session:{session_id}:history"
            self.redis_client.rpush(key, message)
            # Set expiry to 24 hours
            self.redis_client.expire(key, 86400)
            logger.info(f"Added to short-term memory for session {session_id}")
        except Exception as e:
            logger.error(f"Error adding to short-term memory: {e}", exc_info=True)

    def get_short_term(self, session_id: str, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Get recent conversation history from short-term memory.
        """
        if not self.redis_client:
            logger.debug("Short-term memory not available, returning empty results")
            return []
        try:
            key = f"session:{session_id}:history"
            # Get last 'limit' messages
            messages = self.redis_client.lrange(key, -limit, -1)
            return [json.loads(msg) for msg in messages]
        except Exception as e:
            logger.error(f"Error getting short-term memory: {e}", exc_info=True)
            return []

    def clear_short_term(self, session_id: str):
        """
        Clear short-term memory for a session.
        """
        if not self.redis_client:
            logger.debug("Short-term memory not available, skipping clear")
            return
        try:
            key = f"session:{session_id}:history"
            self.redis_client.delete(key)
            logger.info(f"Cleared short-term memory for session {session_id}")
        except Exception as e:
            logger.error(f"Error clearing short-term memory: {e}", exc_info=True)
