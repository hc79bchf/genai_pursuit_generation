import os
import functools
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import AnyHttpUrl, field_validator

class Settings(BaseSettings):
    # App
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Pursuit Response Platform"
    ENVIRONMENT: str = "development"
    DEBUG: bool = False

    # Security
    SECRET_KEY: str = "change_this_to_a_secure_random_string_in_production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    ALGORITHM: str = "HS256"

    # CORS - Railway will set FRONTEND_URL
    BACKEND_CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:8000", "http://localhost:3001"]
    FRONTEND_URL: Optional[str] = None

    # Database - Railway provides DATABASE_URL (may need conversion)
    DATABASE_URL: str = "postgresql+asyncpg://pursuit_user:pursuit_pass@db:5432/pursuit_db"
    DATABASE_PRIVATE_URL: Optional[str] = None  # Railway private networking

    # AI
    ANTHROPIC_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    BRAVE_API_KEY: str = ""
    LLM_MODEL_FAST: str = "claude-3-haiku-20240307"
    LLM_MODEL_SMART: str = "claude-3-haiku-20240307"

    # Vector DB - Optional for Railway (can use in-memory ChromaDB)
    CHROMADB_HOST: str = "localhost"
    CHROMADB_PORT: int = 8000
    CHROMA_PERSIST_DIR: str = "/app/chroma_data"

    # Redis - Railway provides REDIS_URL
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_PRIVATE_URL: Optional[str] = None  # Railway private networking

    @field_validator('DATABASE_URL', mode='before')
    @classmethod
    def convert_database_url(cls, v: str) -> str:
        """Convert any postgres URL to postgresql+asyncpg:// for async SQLAlchemy"""
        if not v:
            return v
        # Handle all possible postgres URL formats
        if v.startswith('postgres://'):
            return v.replace('postgres://', 'postgresql+asyncpg://', 1)
        elif v.startswith('postgresql://') and '+asyncpg' not in v:
            return v.replace('postgresql://', 'postgresql+asyncpg://', 1)
        elif v.startswith('postgresql+psycopg2://'):
            return v.replace('postgresql+psycopg2://', 'postgresql+asyncpg://', 1)
        return v

    @field_validator('BACKEND_CORS_ORIGINS', mode='before')
    @classmethod
    def assemble_cors_origins(cls, v):
        """Add FRONTEND_URL to CORS origins if provided"""
        if isinstance(v, str):
            origins = [i.strip() for i in v.split(',')]
        else:
            origins = list(v) if v else []
        return origins

    @functools.cached_property
    def MEM0_CONFIG(self):
        return {
            "vector_store": {
                "provider": "chroma",
                "config": {
                    "collection_name": "debug_memory",
                    "host": self.CHROMADB_HOST,
                    "port": self.CHROMADB_PORT,
                }
            },
            "llm": {
                "provider": "openai",
                "config": {
                    "model": "gpt-4o-mini",
                    "api_key": self.OPENAI_API_KEY,
                }
            },
            "embedder": {
                "provider": "openai",
                "config": {
                    "api_key": self.OPENAI_API_KEY
                }
            }
        }

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True, extra="ignore")

settings = Settings()
