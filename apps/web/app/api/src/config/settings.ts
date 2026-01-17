// Configuration management using environment variables
// Note: In Next.js, environment variables are automatically loaded from .env.local, .env, etc.
// No need for dotenv.config() - Next.js handles this automatically

export interface Settings {
  OPENAI_API_KEY: string;
  ELEVENLABS_API_KEY?: string;
  DATA_FILE_PATH?: string;
  PORT?: number;
  DEBUG?: boolean;
  CORS_ORIGINS?: string[];
}

export const settings: Settings = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
  DATA_FILE_PATH: process.env.DATA_FILE_PATH || './data.json',
  PORT: parseInt(process.env.PORT || '8000', 10),
  DEBUG: process.env.DEBUG === 'true',
  CORS_ORIGINS: process.env.CORS_ORIGINS
    ? JSON.parse(process.env.CORS_ORIGINS)
    : ['http://localhost:3000', 'http://localhost:3001'],
};
