from celery import Celery
import os

# Get Redis URL from environment
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")

celery_app = Celery(
    "worker",
    broker=REDIS_URL,
    backend=REDIS_URL
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)

import asyncio
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.models.pursuit import Pursuit
from app.services.ai_service.gap_analysis_agent import GapAnalysisAgent
from app.services.ai_service.research_agent import ResearchAgent
from app.services.ai_service.llm_service import LLMService

# Create sync engine for Celery
SYNC_DATABASE_URL = settings.DATABASE_URL.replace("postgresql+asyncpg", "postgresql+psycopg2")
engine = create_engine(SYNC_DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@celery_app.task
def dummy_task():
    return "Hello from Celery!"

@celery_app.task(bind=True)
def perform_gap_analysis_task(self, pursuit_id: str, template_details: dict, user_id: str):
    """
    Background task to perform gap analysis.
    """
    db: Session = SessionLocal()
    try:
        pursuit = db.query(Pursuit).filter(Pursuit.id == pursuit_id).first()
        if not pursuit:
            return {"error": "Pursuit not found"}

        # Prepare metadata
        # We can use the Pydantic schema to dump it, or just construct a dict
        # For simplicity, let's use the fields we have
        pursuit_metadata = {
            "id": str(pursuit.id),
            "entity_name": pursuit.entity_name,
            "industry": pursuit.industry,
            "service_types": pursuit.service_types,
            "technologies": pursuit.technologies,
            "requirements_text": pursuit.requirements_text,
            "submission_due_date": str(pursuit.submission_due_date) if pursuit.submission_due_date else None,
            "estimated_fees_usd": float(pursuit.estimated_fees_usd) if pursuit.estimated_fees_usd else None,
            # Add other relevant fields...
        }

        # Initialize services
        llm_service = LLMService()
        agent = GapAnalysisAgent(llm_service)

        # Run analysis (async function in sync task)
        loop = asyncio.get_event_loop()
        if loop.is_closed():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
        result = loop.run_until_complete(agent.analyze(pursuit_metadata, template_details, user_id))

        # Update pursuit
        pursuit.gap_analysis_result = result
        db.commit()
        
        return result

    except Exception as e:
        print(f"Error in gap analysis task: {e}")
        return {"error": str(e)}
    finally:
        db.close()

@celery_app.task(bind=True)
def perform_research_task(self, pursuit_id: str, user_id: str):
    """
    Background task to perform deep research using gap analysis search queries.
    """
    db: Session = SessionLocal()
    try:
        pursuit = db.query(Pursuit).filter(Pursuit.id == pursuit_id).first()
        if not pursuit:
            return {"error": "Pursuit not found"}

        if not pursuit.gap_analysis_result:
            return {"error": "Gap analysis must be completed first"}

        # Extract search queries from gap analysis
        search_queries = pursuit.gap_analysis_result.get("search_queries", [])
        if not search_queries:
            return {"error": "No search queries found in gap analysis"}

        # Prepare pursuit context
        pursuit_context = {
            "id": str(pursuit.id),
            "entity_name": pursuit.entity_name,
            "industry": pursuit.industry,
            "service_types": pursuit.service_types or [],
            "technologies": pursuit.technologies or [],
            "requirements_text": pursuit.requirements_text,
        }

        # Initialize services
        llm_service = LLMService()
        agent = ResearchAgent(llm_service)

        # Run research (async function in sync task)
        loop = asyncio.get_event_loop()
        if loop.is_closed():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        result = loop.run_until_complete(
            agent.research(search_queries, pursuit_context, user_id)
        )

        # Update pursuit
        pursuit.research_result = result
        db.commit()

        return result

    except Exception as e:
        print(f"Error in research task: {e}")
        import traceback
        traceback.print_exc()
        return {"error": str(e)}
    finally:
        db.close()
