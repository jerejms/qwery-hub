# AI Study Buddy API - RAG Backend

RAG (Retrieval-Augmented Generation) backend for AI Study Buddy that reads from database and provides context to LLM for grounded responses.

## Overview

This backend:
- **Reads** `StudyTask` (Canvas data) and `ScheduleEvent` (NUSMods data) from database
- **RightNow Widget**: Prioritizes Canvas assignments by due date urgency
- **NUS Scheduler Widget**: Checks for timetable clashes and calculates time until next class
- Provides context to OpenAI LLM for grounded responses (only uses information from database)
- Integrates Agora AI TTS for voice responses (optional)

**Important**: This backend does NOT call Canvas or NUSMods APIs. It assumes the database is already populated with data by a separate API calling service.

## Architecture

```
apps/api/src/
├── main.py                 # FastAPI app entry point
├── routers/
│   ├── chat.py            # POST /chat endpoint (RAG query)
│   └── widgets.py         # GET /widgets/right-now, /widgets/schedule
├── services/
│   ├── llm_service.py     # OpenAI integration with RAG context
│   ├── rag_service.py     # Database retrieval + context formatting
│   ├── rightnow_service.py # Assignment prioritization by due date
│   ├── scheduler_service.py # Timetable clash detection + next class reminder
│   └── agora_service.py   # Agora AI TTS integration
├── models/
│   ├── db_models.py       # SQLAlchemy models (StudyTask, ScheduleEvent)
│   └── schemas.py         # Pydantic schemas for API requests/responses
├── config/
│   ├── settings.py        # Environment variables + config
│   └── database.py        # SQLAlchemy setup + session management
└── middleware/
    └── cors.py            # CORS configuration
```

## Database Schema

### StudyTask Table (populated by Canvas API caller)

```sql
CREATE TABLE study_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    course TEXT NOT NULL,
    due_at TEXT NOT NULL,  -- ISO timestamp
    link TEXT,
    user_id TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### ScheduleEvent Table (populated by NUSMods API caller)

```sql
CREATE TABLE schedule_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    module TEXT NOT NULL,
    type TEXT NOT NULL,  -- LEC, TUT, LAB
    day TEXT NOT NULL,   -- Monday, Tuesday, etc.
    start_time TEXT NOT NULL,  -- e.g., "1400"
    end_time TEXT NOT NULL,    -- e.g., "1500"
    venue TEXT,
    user_id TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

## Setup

1. **Install dependencies:**
   ```bash
   cd apps/api
   pip install -r requirements.txt
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env and add your OPENAI_API_KEY
   ```

3. **Run the server:**
   ```bash
   uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
   ```

The server will be available at `http://localhost:8000`

## API Endpoints

### Chat Endpoint

**POST /chat**

Chat with AI using RAG context from database.

**Request:**
```json
{
  "userId": "user123",
  "message": "What assignments are due soon?",
  "useTTS": false
}
```

**Response:**
```json
{
  "assistantMessage": "Based on your tasks, you have...",
  "audioUrl": null
}
```

### RightNow Widget

**GET /widgets/right-now?userId=user123**

Get the most urgent task or upcoming class suggestion.

**Response:**
```json
{
  "message": "Focus on CS1010 - Assignment 1 | Due in 2 hours (URGENT)",
  "type": "TASK",
  "data": {
    "task": {...},
    "hoursUntil": 2.0,
    "urgency": "URGENT"
  }
}
```

### Schedule Widget

**GET /widgets/schedule?userId=user123**

Get schedule information including clashes and next class.

**Response:**
```json
{
  "hasClash": false,
  "clashes": [],
  "nextClass": {
    "event": {...},
    "timeUntil": "2 hours 30 minutes",
    "formatted": "Your next class is CS1010 LEC at 14:00 in LT1 starting in 2 hours 30 minutes"
  },
  "timeUntilNext": "2 hours 30 minutes"
}
```

## Environment Variables

Required:
- `OPENAI_API_KEY`: OpenAI API key for LLM

Optional:
- `AGORA_APP_ID`: Agora app ID for TTS (if using TTS)
- `AGORA_APP_CERTIFICATE`: Agora app certificate for TTS
- `DATABASE_URL`: Database connection string (default: `sqlite:///./study_buddy.db`)
- `CORS_ORIGINS`: List of allowed CORS origins (default: `["http://localhost:3000","http://localhost:3001"]`)

## Key Features

### RightNow Service
- Prioritizes Canvas assignments by due date (nearest first)
- Calculates urgency levels: CRITICAL (<2h), URGENT (<24h), HIGH (<48h), NORMAL
- Falls back to upcoming class if no urgent tasks

### Scheduler Service
- **Clash Detection**: Identifies overlapping time slots on the same day
- **Next Class Reminder**: Calculates time until next class with human-readable format

### LLM Service
- Enforces grounded responses (only uses information from database context)
- System prompt instructs model to not invent information
- Returns error message if information not available

### RAG Service
- Retrieves user's tasks and schedule from database
- Formats data as structured text for LLM system prompt
- Includes current time for context-aware responses

## Development

**Run with auto-reload:**
```bash
uvicorn src.main:app --reload
```

**Check health:**
```bash
curl http://localhost:8000/health
```

**View API docs:**
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Testing

The database will be initialized automatically on startup. To populate test data, you need to insert records into `study_tasks` and `schedule_events` tables using the API calling service.

## Notes

- All queries filter by `user_id` for user isolation
- Database tables are created automatically on startup
- Agora TTS is optional and only used if credentials are provided
- Time calculations assume UTC timezone (adjust as needed for your timezone)
