"""Agora AI TTS Service - Text-to-speech conversion using Agora Conversational AI Engine."""
import httpx
from typing import Optional
from ..config.settings import settings


class AgoraTTSService:
    """Service for Agora AI text-to-speech conversion."""
    
    def __init__(self):
        """Initialize Agora TTS service."""
        self.app_id = settings.AGORA_APP_ID
        self.app_certificate = settings.AGORA_APP_CERTIFICATE
        self.api_url = settings.AGORA_API_URL or "https://api.agora.io/v1/projects"
        self.enabled = bool(self.app_id and self.app_certificate)
    
    def generate_tts(self, text: str) -> Optional[str]:
        """
        Generate TTS audio from text using Agora AI.
        Returns audio URL or None if TTS is disabled or fails.
        """
        if not self.enabled:
            return None
        
        try:
            # Agora Conversational AI Engine REST API integration
            # Note: This is a placeholder implementation - actual Agora TTS API may vary
            # Adjust based on Agora's actual REST API documentation
            
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.app_certificate}"  # Adjust based on Agora auth method
            }
            
            payload = {
                "text": text,
                "voice": "en-US-Standard-D",  # Default voice, can be configured
                "audioConfig": {
                    "audioEncoding": "MP3",
                    "speakingRate": 1.0,
                    "pitch": 0.0
                }
            }
            
            # Make request to Agora TTS API
            # Note: Update this endpoint based on actual Agora TTS API documentation
            with httpx.Client(timeout=10.0) as client:
                response = client.post(
                    f"{self.api_url}/{self.app_id}/tts/generate",
                    json=payload,
                    headers=headers
                )
                
                if response.status_code == 200:
                    result = response.json()
                    # Extract audio URL from response (adjust based on actual response structure)
                    audio_url = result.get("audioUrl") or result.get("url") or result.get("data", {}).get("url")
                    return audio_url
                else:
                    # Log error but don't fail the request
                    print(f"Agora TTS API error: {response.status_code} - {response.text}")
                    return None
        
        except Exception as e:
            # Log error but don't fail the request
            print(f"Agora TTS error: {str(e)}")
            return None
    
    def is_enabled(self) -> bool:
        """Check if Agora TTS is enabled."""
        return self.enabled


# Global instance
agora_service = AgoraTTSService()
