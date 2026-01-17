"""Configuration management using Pydantic Settings."""
from typing import Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # OpenAI Configuration
    OPENAI_API_KEY: str
    
    # Agora AI Configuration (Optional)
    AGORA_APP_ID: Optional[str] = None
    AGORA_APP_CERTIFICATE: Optional[str] = None
    AGORA_API_URL: Optional[str] = "https://api.agora.io/v1/projects"
    
    # Database Configuration
    DATABASE_URL: str = "sqlite:///./study_buddy.db"
    
    # Application Configuration
    DEBUG: bool = False
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:3001"]
    
    class Config:
        env_file = ".env"
        case_sensitive = True


# Global settings instance
settings = Settings()
