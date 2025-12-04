from fastapi import APIRouter
from app.api.v1.endpoints import auth, pursuits, chat, activities, stats, lookup

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(pursuits.router, prefix="/pursuits", tags=["pursuits"])
api_router.include_router(chat.router, prefix="/pursuits", tags=["chat"])
api_router.include_router(activities.router, prefix="/activities", tags=["activities"])
api_router.include_router(stats.router, prefix="/stats", tags=["stats"])
api_router.include_router(lookup.router, prefix="/lookup", tags=["lookup"])
