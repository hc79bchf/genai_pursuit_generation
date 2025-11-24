import pytest
from unittest.mock import MagicMock, patch
from app.services.memory_service import MemoryService

@pytest.fixture
def mock_mem0():
    with patch('app.services.memory_service.Memory') as mock:
        yield mock

@pytest.fixture
def mock_redis():
    with patch('app.services.memory_service.redis.from_url') as mock:
        yield mock

def test_memory_service_initialization(mock_mem0, mock_redis):
    service = MemoryService()
    mock_mem0.from_config.assert_called_once()
    mock_redis.assert_called_once()

def test_add_long_term(mock_mem0, mock_redis):
    service = MemoryService()
    service.memory.add = MagicMock()
    
    service.add_long_term("test text", "user1", {"meta": "data"})
    service.memory.add.assert_called_with("test text", user_id="user1", metadata={"meta": "data"})

def test_search_long_term(mock_mem0, mock_redis):
    service = MemoryService()
    service.memory.search = MagicMock(return_value=[{"text": "result"}])
    
    results = service.search_long_term("query", "user1")
    service.memory.search.assert_called_with("query", user_id="user1", limit=5)
    assert results == [{"text": "result"}]

def test_add_short_term(mock_mem0, mock_redis):
    mock_redis_client = MagicMock()
    mock_redis.return_value = mock_redis_client
    
    service = MemoryService()
    service.add_short_term("session1", "user", "hello")
    
    mock_redis_client.rpush.assert_called()
    mock_redis_client.expire.assert_called()

def test_get_short_term(mock_mem0, mock_redis):
    mock_redis_client = MagicMock()
    mock_redis.return_value = mock_redis_client
    mock_redis_client.lrange.return_value = ['{"role": "user", "content": "hello"}']
    
    service = MemoryService()
    results = service.get_short_term("session1")
    
    mock_redis_client.lrange.assert_called()
    assert len(results) == 1
    assert results[0]["content"] == "hello"
