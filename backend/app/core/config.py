import os
import functools
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import AnyHttpUrl

class Settings(BaseSettings):
    # App
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Pursuit Response Platform"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    
    # Security
    SECRET_KEY: str = "change_this_to_a_secure_random_string_in_production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    ALGORITHM: str = "HS256"
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:8000", "http://localhost:3001"]
    
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://pursuit_user:pursuit_pass@db:5432/pursuit_db"
    
    # AI
    ANTHROPIC_API_KEY: str
    OPENAI_API_KEY: str
    LLM_MODEL_FAST: str = "claude-3-haiku-20240307"
    LLM_MODEL_SMART: str = "claude-3-haiku-20240307"
    
    # Vector DB
    CHROMADB_HOST: str = "chroma"
    CHROMADB_PORT: int = 8000

    # Redis
    REDIS_URL: str = "redis://redis:6379/0"

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

    def model_post_init(self, __context):
        if self.ENVIRONMENT == "production" and self.SECRET_KEY == "change_this_to_a_secure_random_string_in_production":
            raise ValueError("SECRET_KEY must be changed in production environment.")

settings = Settings()
