// Agora AI TTS Service - Text-to-speech conversion using Agora Conversational AI Engine
import { settings } from '../config/settings';

class AgoraTTSService {
  private appId?: string;
  private appCertificate?: string;
  private apiUrl: string;
  private enabled: boolean;

  constructor() {
    this.appId = settings.AGORA_APP_ID;
    this.appCertificate = settings.AGORA_APP_CERTIFICATE;
    this.apiUrl = settings.AGORA_API_URL || 'https://api.agora.io/v1/projects';
    this.enabled = !!(this.appId && this.appCertificate);
  }

  /**
   * Generate TTS audio from text using Agora AI.
   * Returns audio URL or null if TTS is disabled or fails.
   */
  async generateTTS(text: string): Promise<string | null> {
    if (!this.enabled) {
      return null;
    }

    try {
      // Agora Conversational AI Engine REST API integration
      // Note: This is a placeholder implementation - actual Agora TTS API may vary
      // Adjust based on Agora's actual REST API documentation

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.appCertificate}`, // Adjust based on Agora auth method
      };

      const payload = {
        text,
        voice: 'en-US-Standard-D', // Default voice, can be configured
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate: 1.0,
          pitch: 0.0,
        },
      };

      // Make request to Agora TTS API
      // Note: Update this endpoint based on actual Agora TTS API documentation
      const response = await fetch(`${this.apiUrl}/${this.appId}/tts/generate`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const result = await response.json();
        // Extract audio URL from response (adjust based on actual response structure)
        const audioUrl = result.audioUrl || result.url || result.data?.url;
        return audioUrl || null;
      } else {
        // Log error but don't fail the request
        console.error(`Agora TTS API error: ${response.status} - ${await response.text()}`);
        return null;
      }
    } catch (error) {
      // Log error but don't fail the request
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Agora TTS error: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Check if Agora TTS is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}

// Global instance
export const agoraService = new AgoraTTSService();
