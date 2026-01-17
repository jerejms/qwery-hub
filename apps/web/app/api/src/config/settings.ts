// Configuration management using environment variables
// Note: In Next.js, environment variables are automatically loaded from .env.local, .env, etc.
// No need for dotenv.config() - Next.js handles this automatically

export interface Settings {
  OPENAI_API_KEY: string;
  AGORA_APP_ID?: string;
  AGORA_APP_CERTIFICATE?: string;
  AGORA_API_URL?: string;
  DATA_FILE_PATH?: string;
  PORT?: number;
  DEBUG?: boolean;
  CORS_ORIGINS?: string[];
}

export const settings: Settings = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  AGORA_APP_ID: process.env.AGORA_APP_ID,
  AGORA_APP_CERTIFICATE: process.env.AGORA_APP_CERTIFICATE,
  AGORA_API_URL: process.env.AGORA_API_URL || 'https://api.agora.io/v1/projects',
  DATA_FILE_PATH: process.env.DATA_FILE_PATH || './data.json',
  PORT: parseInt(process.env.PORT || '8000', 10),
  DEBUG: process.env.DEBUG === 'true',
  CORS_ORIGINS: process.env.CORS_ORIGINS 
    ? JSON.parse(process.env.CORS_ORIGINS) 
    : ['http://localhost:3000', 'http://localhost:3001'],
};
