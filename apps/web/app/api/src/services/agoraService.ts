// TTS Service - ElevenLabs Text-to-Speech
import { settings } from '../config/settings';

class TTSService {
  private apiKey?: string;
  private enabled: boolean;
  private voiceId: string;
  private modelId: string;

  constructor() {
    // Use settings (which loads from process.env) for consistency
    this.apiKey = settings.ELEVENLABS_API_KEY;
    this.enabled = !!this.apiKey;
    // Default voice ID - using "Rachel" which is a popular natural-sounding voice
    // Users can change this to any voice ID from their ElevenLabs account
    this.voiceId = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'; // Rachel voice
    // Using multilingual v2 for natural, expressive speech
    this.modelId = process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2';

    // Debug log (first 8 chars of API key for verification, rest hidden)
    if (this.enabled) {
      const keyPreview = this.apiKey!.substring(0, 8) + '...';
      console.log(`TTS Service initialized: voice=${this.voiceId}, model=${this.modelId}, apiKey=${keyPreview}`);
    } else {
      console.warn('TTS Service: ELEVENLABS_API_KEY not configured');
    }
  }

  /**
   * Generate TTS audio from text using ElevenLabs TTS API.
   * Returns a base64 data URL for the audio or null if it fails.
   */
  async generateTTS(text: string, mood: "normal" | "stressed" | "happy" = "normal"): Promise<string | null> {
    if (!this.enabled) {
      console.warn('TTS is not enabled. Please configure ELEVENLABS_API_KEY');
      return null;
    }

    if (!text || text.trim().length === 0) {
      console.warn('TTS: Empty text provided');
      return null;
    }

    console.log(`TTS: Generating audio for text (${text.length} chars), voice: ${this.voiceId}, model: ${this.modelId}, mood: ${mood}`);

    // Add filler words based on mood (stressed = no fillers, normal/happy = fillers)
    const textWithFillers = mood === "stressed" ? text : this.addNaturalFillerWords(text, mood);

    // Preprocess text to improve natural pauses using SSML break tags
    const processedText = this.preprocessTextForNaturalPauses(textWithFillers, mood);

    // Voice settings based on mood
    let voiceSettings: any;
    
    switch (mood) {
      case "stressed":
        // Urgent, fast, direct - no pauses, high energy
        voiceSettings = {
          stability: 0.5,           // Lower stability for more urgent/frantic energy
          similarity_boost: 0.8,    // Keep voice recognizable
          style: 0.4,               // More expressive/emotional
          use_speaker_boost: true,
          speed: 1.2,               // Faster speech for urgency (max allowed by API)
        };
        break;
      
      case "happy":
        // Relaxed, cheerful, friendly
        voiceSettings = {
          stability: 0.6,           // Slightly lower for more expression
          similarity_boost: 0.75,
          style: 0.2,               // Some style for happiness
          use_speaker_boost: true,
          speed: 0.95,              // Slightly slower, more relaxed
        };
        break;
      
      case "normal":
      default:
        // Balanced, natural
        voiceSettings = {
          stability: 0.7,           // Higher stability for consistent pacing
          similarity_boost: 0.75,
          style: 0.0,               // Natural, not robotic
          use_speaker_boost: true,
          speed: 1.0,               // Normal speed
        };
        break;
    }

    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'xi-api-key': this.apiKey!,
          },
          body: JSON.stringify({
            model_id: this.modelId,
            text: processedText,
            voice_settings: voiceSettings,
            output_format: 'mp3_44100_128', // MP3 format for browser compatibility
          }),
        }
      );

      console.log(`TTS: API response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`ElevenLabs TTS API error: ${response.status} - ${errorText}`);
        return null;
      }

      // Convert the response to a base64 data URL
      const arrayBuffer = await response.arrayBuffer();
      console.log(`TTS: Received ${arrayBuffer.byteLength} bytes of audio data`);

      // Debug: Check if we got audio data
      if (arrayBuffer.byteLength === 0) {
        console.error('ElevenLabs TTS returned empty audio data');
        return null;
      }

      const buffer = Buffer.from(arrayBuffer);
      const base64 = buffer.toString('base64');
      console.log(`TTS: Successfully generated audio, base64 length: ${base64.length}`);

      // Use audio/mpeg instead of audio/mp3 for better browser compatibility
      return `data:audio/mpeg;base64,${base64}`;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`ElevenLabs TTS error: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Add natural filler words to make speech sound more human-like
   * These are only added to the audio, not to the displayed text
   * Different fillers have random pause durations within ranges for natural variation
   */
  private addNaturalFillerWords(text: string, mood: "normal" | "stressed" | "happy" = "normal"): string {
    // Filler words with their pause duration ranges (min, max in seconds)
    // "um" has longer pauses, "uh" has shorter pauses
    const fillerConfig: Record<string, { min: number; max: number }> = {
      'um': { min: 0.4, max: 0.7 },        // Longer pause range for "um"
      'uh': { min: 0.15, max: 0.3 },        // Shorter pause range for "uh"
      'well': { min: 0.25, max: 0.45 },     // Medium pause range for "well"
      'you know': { min: 0.3, max: 0.5 },   // Medium-long pause range for "you know"
      'like': { min: 0.2, max: 0.4 },       // Medium pause range for "like"
    };

    /**
     * Get a random pause duration for a filler word within its range
     */
    const getRandomPause = (filler: string): string => {
      const config = fillerConfig[filler];
      if (!config) return '0.3s';
      const duration = config.min + Math.random() * (config.max - config.min);
      // Round to 2 decimal places for cleaner SSML
      return `${duration.toFixed(2)}s`;
    };

    const fillers = Object.keys(fillerConfig);
    const sentences = text.split(/([.!?]+\s+)/);

    // Adjust filler frequency based on mood
    const fillerChanceAfterSentence = mood === "happy" ? 0.4 : 0.25; // More fillers when happy
    const fillerChanceAfterComma = mood === "happy" ? 0.2 : 0.12;    // More fillers when happy

    let result = '';

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];

      // Add sentence
      result += sentence;

      // Occasionally add a filler word after sentences (not every time)
      if (sentence.trim().length > 0 && /[.!?]/.test(sentence)) {
        // Add filler based on mood frequency
        if (Math.random() < fillerChanceAfterSentence && i < sentences.length - 1) {
          const filler = fillers[Math.floor(Math.random() * fillers.length)];
          const pauseDuration = getRandomPause(filler);
          // Add filler with SSML break tag for the pause
          result += ` ${filler} <break time="${pauseDuration}"/> `;
        }
      }
    }

    // Also occasionally add fillers after commas in longer sentences
    result = result.replace(/,(\s+)([A-Z])/g, (match, space, nextChar) => {
      if (Math.random() < fillerChanceAfterComma) {
        // Use shorter fillers after commas (um, uh, well)
        const shortFillers = ['um', 'uh', 'well'];
        const filler = shortFillers[Math.floor(Math.random() * shortFillers.length)];
        const pauseDuration = getRandomPause(filler);
        // Add filler with SSML break tag
        return `, ${filler} <break time="${pauseDuration}"/>${space}${nextChar}`;
      }
      return match;
    });

    return result.trim();
  }

  /**
   * Preprocess text to add natural pauses using SSML break tags
   * For V2 models like eleven_multilingual_v2, SSML break tags are supported
   */
  private preprocessTextForNaturalPauses(text: string, mood: "normal" | "stressed" | "happy" = "normal"): string {
    // Adjust pause durations based on mood
    let sentencePause = "0.3s";
    let commaPause = "0.2s";
    let colonPause = "0.25s";
    
    switch (mood) {
      case "stressed":
        // Minimal pauses for urgency
        sentencePause = "0.1s";
        commaPause = "0.05s";
        colonPause = "0.1s";
        break;
      case "happy":
        // Longer, relaxed pauses
        sentencePause = "0.4s";
        commaPause = "0.25s";
        colonPause = "0.3s";
        break;
      case "normal":
      default:
        // Default pauses
        sentencePause = "0.3s";
        commaPause = "0.2s";
        colonPause = "0.25s";
        break;
    }
    
    // Add small breaks after sentence-ending punctuation for more natural pauses
    // Replace periods, exclamation marks, question marks with break tags
    let processed = text
      // Add short break after sentence endings (but not abbreviations)
      .replace(/([.!?])\s+/g, `$1 <break time="${sentencePause}"/> `)
      // Add very short break after commas
      .replace(/,(\s+)/g, `, <break time="${commaPause}"/>$1`)
      // Add break after colons (lists, explanations)
      .replace(/:\s+/g, `: <break time="${colonPause}"/> `)
      // Clean up multiple spaces
      .replace(/\s+/g, ' ')
      .trim();

    return processed;
  }

  /**
   * Check if TTS is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}

// Global instance
export const agoraService = new TTSService();
