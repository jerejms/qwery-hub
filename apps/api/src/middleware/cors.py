"""CORS middleware configuration."""
from fastapi.middleware.cors import CORSMiddleware
from ..config.settings import settings


def setup_cors(app):
    """Setup CORS middleware for FastAPI app."""
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
