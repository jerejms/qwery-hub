# API Keys Setup Guide

## Where to Store API Keys

API keys are stored in a **`.env` file** in the `apps/api/` directory. This file is **git-ignored** (already configured in `.gitignore`) to keep your keys secure.

## Step-by-Step Setup

### 1. Create the `.env` file

In the `apps/api/` directory, create a file named `.env`:

```bash
cd apps/api
touch .env
```

### 2. Add your API keys

Open the `.env` file and add your keys:

```bash
# OpenAI Configuration (Required)
OPENAI_API_KEY=sk-your-actual-openai-api-key-here

# Agora AI Configuration (Optional - for TTS)
AGORA_APP_ID=your-agora-app-id
AGORA_APP_CERTIFICATE=your-agora-certificate
AGORA_API_URL=https://api.agora.io/v1/projects

# Database Configuration
DATABASE_URL=sqlite:///./study_buddy.db

# Application Configuration
DEBUG=false
CORS_ORIGINS=["http://localhost:3000","http://localhost:3001"]
```

### 3. Required vs Optional Keys

**Required:**
- `OPENAI_API_KEY` - **Required** for LLM chat functionality

**Optional:**
- `AGORA_APP_ID` - Only needed if using TTS features
- `AGORA_APP_CERTIFICATE` - Only needed if using TTS features
- `AGORA_API_URL` - Defaults to Agora's API URL if not specified

**Optional (with defaults):**
- `DATABASE_URL` - Defaults to `sqlite:///./study_buddy.db`
- `DEBUG` - Defaults to `false`
- `CORS_ORIGINS` - Defaults to `["http://localhost:3000","http://localhost:3001"]`

## How It Works

The backend uses **Pydantic Settings** (configured in `src/config/settings.py`) to:
1. Automatically load environment variables from the `.env` file
2. Validate that required keys are present
3. Provide defaults for optional keys
4. Make keys accessible via `settings.OPENAI_API_KEY`, etc.

## Security Best Practices

✅ **DO:**
- Store keys in `.env` file (already git-ignored)
- Never commit `.env` to git
- Use different keys for development and production
- Keep `.env` file local (don't share via email/Slack)

❌ **DON'T:**
- Hardcode keys in source code
- Commit `.env` to git (it's already in `.gitignore`)
- Share `.env` files publicly
- Store production keys in development `.env`

## Example `.env` File Template

```bash
# ===========================================
# AI Study Buddy API - Environment Variables
# ===========================================

# OpenAI Configuration (Required)
# Get your key from: https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Agora AI Configuration (Optional - for TTS)
# Get credentials from: https://console.agora.io/
AGORA_APP_ID=
AGORA_APP_CERTIFICATE=
AGORA_API_URL=https://api.agora.io/v1/projects

# Database Configuration
DATABASE_URL=sqlite:///./study_buddy.db

# Application Configuration
DEBUG=false
CORS_ORIGINS=["http://localhost:3000","http://localhost:3001"]
```

## Getting Your API Keys

### OpenAI API Key
1. Go to https://platform.openai.com/api-keys
2. Sign in or create an account
3. Click "Create new secret key"
4. Copy the key (starts with `sk-`)
5. Add to `.env` as `OPENAI_API_KEY`

### Agora AI Credentials (Optional)
1. Go to https://console.agora.io/
2. Sign in or create an account
3. Create a project
4. Get your App ID and App Certificate
5. Add to `.env` as `AGORA_APP_ID` and `AGORA_APP_CERTIFICATE`

## Verification

After creating your `.env` file, verify it's working:

```bash
cd apps/api
python -c "from src.config.settings import settings; print('OpenAI API Key:', '✅ Set' if settings.OPENAI_API_KEY else '❌ Missing')"
```

Or run the server - it will error if required keys are missing:

```bash
uvicorn src.main:app --reload
```

## Troubleshooting

### "OPENAI_API_KEY is required"
- Make sure `.env` file exists in `apps/api/` directory
- Check that the key name is exactly `OPENAI_API_KEY` (case-sensitive)
- Verify the `.env` file doesn't have quotes around values (unless needed for arrays)

### Keys not loading
- Ensure `.env` file is in `apps/api/` directory (same level as `src/`)
- Check for typos in variable names
- Restart the server after changing `.env`

### File location
The `.env` file should be at:
```
apps/api/.env
```

Not at:
- `apps/.env` ❌
- `apps/api/src/.env` ❌
- Root `.env` ❌ (unless you configure it differently)
