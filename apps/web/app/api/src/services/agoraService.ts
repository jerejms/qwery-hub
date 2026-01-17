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
  async generateTTS(text: string): Promise<string | null> {
    if (!this.enabled) {
      console.warn('TTS is not enabled. Please configure ELEVENLABS_API_KEY');
      return null;
    }

    if (!text || text.trim().length === 0) {
      console.warn('TTS: Empty text provided');
      return null;
    }

    console.log(`TTS: Generating audio for text (${text.length} chars), voice: ${this.voiceId}, model: ${this.modelId}`);

    // Add filler words to make speech more human-like (only in audio, not in text response)
    const textWithFillers = this.addNaturalFillerWords(text);

    // Preprocess text to improve natural pauses using SSML break tags
    const processedText = this.preprocessTextForNaturalPauses(textWithFillers);

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
            voice_settings: {
              stability: 0.7, // Higher stability for more consistent, natural pacing and pauses
              similarity_boost: 0.75, // Good balance between similarity and naturalness
              style: 0.0, // Lower style for more natural, less robotic sound
              use_speaker_boost: true, // Enhances clarity and naturalness
              speed: 1.0, // Normal speech speed (range: 0.7-1.2, 1.0 is normal)
            },
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
  private addNaturalFillerWords(text: string): string {
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

    let result = '';

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];

      // Add sentence
      result += sentence;

      // Occasionally add a filler word after sentences (not every time)
      if (sentence.trim().length > 0 && /[.!?]/.test(sentence)) {
        // Add filler ~30% of the time after sentences
        if (Math.random() < 0.3 && i < sentences.length - 1) {
          const filler = fillers[Math.floor(Math.random() * fillers.length)];
          const pauseDuration = getRandomPause(filler);
          // Add filler with SSML break tag for the pause
          result += ` ${filler} <break time="${pauseDuration}"/> `;
        }
      }
    }

    // Also occasionally add fillers after commas in longer sentences
    result = result.replace(/,(\s+)([A-Z])/g, (match, space, nextChar) => {
      if (Math.random() < 0.15) { // 15% chance
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
  private preprocessTextForNaturalPauses(text: string): string {
    // Add small breaks after sentence-ending punctuation for more natural pauses
    // Replace periods, exclamation marks, question marks with break tags
    let processed = text
      // Add short break after sentence endings (but not abbreviations)
      .replace(/([.!?])\s+/g, '$1 <break time="0.3s"/> ')
      // Add very short break after commas
      .replace(/,(\s+)/g, ', <break time="0.2s"/>$1')
      // Add break after colons (lists, explanations)
      .replace(/:\s+/g, ': <break time="0.25s"/> ')
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
