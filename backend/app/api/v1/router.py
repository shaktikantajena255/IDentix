"""
IDentix — API v1 Router
"""
from fastapi import APIRouter
from app.api.v1.endpoints import screening, audit, auth

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(screening.router)
api_router.include_router(audit.router)
