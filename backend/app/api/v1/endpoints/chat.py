from typing import Any
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel

from app.core.database import get_db
from app.models.pursuit import Pursuit
from app.models.pursuit_file import PursuitFile
from app.models.user import User
from app.api.deps import get_current_user
from app.services.ai_service.llm_service import LLMService
from app.services.ai_service.metadata_agent import MetadataExtractionAgent

router = APIRouter()

class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    response: str

@router.post("/{pursuit_id}/chat", response_model=ChatResponse)
async def chat_with_pursuit(
    *,
    db: AsyncSession = Depends(get_db),
    pursuit_id: UUID,
    chat_request: ChatRequest,
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Chat with the AI about a specific pursuit.
    """
    # 1. Get Pursuit
    result = await db.execute(select(Pursuit).where(Pursuit.id == pursuit_id))
    pursuit = result.scalars().first()
    if not pursuit:
        raise HTTPException(status_code=404, detail="Pursuit not found")

    # 2. Get Latest RFP File
    result = await db.execute(
        select(PursuitFile)
        .where(PursuitFile.pursuit_id == pursuit_id, PursuitFile.file_type == "rfp")
        .order_by(PursuitFile.uploaded_at.desc())
    )
    pursuit_file = result.scalars().first()
    
    rfp_text = ""
    if pursuit_file:
        try:
            with open(pursuit_file.file_path, "r", errors="ignore") as f:
                rfp_text = f.read()
        except Exception:
            # If file read fails, we proceed with empty text, but log it
            pass

    # 3. Initialize Agent
    llm_service = LLMService()
    agent = MetadataExtractionAgent(llm_service)

    # 4. Prepare Context
    pursuit_context = {
        "id": str(pursuit.id),
        "entity_name": pursuit.entity_name,
        "status": pursuit.status,
        "industry": pursuit.industry,
        "service_types": pursuit.service_types,
        "technologies": pursuit.technologies,
        "metadata": pursuit.outline_json  # Assuming this is where we stored full extraction
    }

    # 5. Chat
    try:
        response_text = await agent.chat(
            message=chat_request.message,
            pursuit_context=pursuit_context,
            rfp_text=rfp_text,
            user_id=str(current_user.id)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")

    return ChatResponse(response=response_text)
