from fastapi import APIRouter
from app.api.v1.endpoints import auth, pursuits, chat

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(pursuits.router, prefix="/pursuits", tags=["pursuits"])
api_router.include_router(chat.router, prefix="/pursuits", tags=["chat"])
