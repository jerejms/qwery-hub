# Changes Summary - FastAPI RAG Backend

## Overview
This document summarizes all the changes made to create the FastAPI RAG backend for the AI Study Buddy application.

---

## 1. Project Structure Created

Created a complete FastAPI backend structure at `apps/api/`:

```
apps/api/
├── requirements.txt          # Python dependencies
├── pyproject.toml            # Poetry configuration
├── README.md                 # API documentation
└── src/
    ├── __init__.py
    ├── main.py               # FastAPI app entry point
    ├── config/
    │   ├── __init__.py
    │   ├── settings.py       # Environment configuration
    │   └── database.py       # Database setup
    ├── models/
    │   ├── __init__.py
    │   ├── db_models.py      # SQLAlchemy models
    │   └── schemas.py        # Pydantic schemas
    ├── services/
    │   ├── __init__.py
    │   ├── rag_service.py            # RAG context retrieval
    │   ├── rightnow_service.py       # Assignment prioritization
    │   ├── scheduler_service.py      # Clash detection & reminders
    │   ├── llm_service.py            # OpenAI integration
    │   └── agora_service.py          # Agora TTS integration
    ├── routers/
    │   ├── __init__.py
    │   ├── chat.py           # POST /chat endpoint
    │   └── widgets.py        # Widget endpoints
    └── middleware/
        ├── __init__.py
        └── cors.py           # CORS configuration
```

---

## 2. Configuration Files

### `apps/api/src/config/settings.py`
- **Purpose**: Environment variable management using Pydantic Settings
- **Features**:
  - OpenAI API key configuration
  - Agora AI credentials (optional)
  - Database URL configuration
  - CORS origins configuration
- **Key Settings**:
  - `OPENAI_API_KEY` (required)
  - `AGORA_APP_ID`, `AGORA_APP_CERTIFICATE` (optional)
  - `DATABASE_URL` (defaults to SQLite)

### `apps/api/src/config/database.py`
- **Purpose**: SQLAlchemy database setup and session management
- **Features**:
  - Database engine creation
  - Session factory configuration
  - Database initialization function
  - Dependency injection for database sessions

---

## 3. Database Models (`apps/api/src/models/`)

### `db_models.py`
Created two SQLAlchemy models:

#### `StudyTask` Model
- **Table**: `study_tasks`
- **Purpose**: Stores Canvas assignments/tasks
- **Fields**:
  - `id` (Primary Key)
  - `title`, `course`, `due_at` (ISO timestamp)
  - `link` (optional)
  - `user_id` (indexed for queries)
  - `created_at`, `updated_at` (timestamps)

#### `ScheduleEvent` Model
- **Table**: `schedule_events`
- **Purpose**: Stores NUSMods timetable events
- **Fields**:
  - `id` (Primary Key)
  - `module`, `type` (LEC/TUT/LAB)
  - `day`, `start_time`, `end_time` (HHMM format)
  - `venue` (optional)
  - `user_id` (indexed for queries)
  - `created_at`, `updated_at` (timestamps)

### `schemas.py`
Created Pydantic schemas for API contracts:
- `ChatRequest` / `ChatResponse`
- `RightNowResponse`
- `ScheduleClashResponse`, `ScheduleClash`, `NextClassInfo`

---

## 4. Services (`apps/api/src/services/`)

### `rag_service.py`
**Purpose**: Retrieves and formats database data for LLM context

**Functions**:
- `get_user_tasks(db, user_id, limit=20)` - Retrieves tasks ordered by due date
- `get_user_schedule(db, user_id, day=None)` - Retrieves schedule events
- `format_context_for_llm(tasks, events, current_time)` - Formats data as structured text

**Output Format**:
```
=== USER'S STUDY TASKS (from Canvas) ===
- Task: ... | Course: ... | Due: ... | Link: ...

=== USER'S CLASS SCHEDULE (from NUSMods) ===
Monday:
  - CS1010 (LEC) | 14:00-15:00 | Venue: ...
```

### `rightnow_service.py`
**Purpose**: Prioritizes Canvas assignments by due date urgency

**Function**: `get_right_now_suggestion(db, user_id)`

**Logic**:
1. Retrieves all user tasks ordered by due date
2. Filters to upcoming tasks (due_at >= now)
3. Sorts by urgency (nearest due first)
4. Calculates urgency levels:
   - CRITICAL (<2 hours)
   - URGENT (<24 hours)
   - HIGH (<48 hours)
   - NORMAL (>=48 hours)
5. Falls back to upcoming class if no urgent tasks

**Returns**: `RightNowResponse` with type `TASK`, `CLASS`, or `IDLE`

### `scheduler_service.py`
**Purpose**: Timetable clash detection and next class reminders

**Functions**:
- `check_schedule_clashes(db, user_id)` - Detects overlapping time slots on same day
- `get_next_class_reminder(db, user_id)` - Calculates time until next class
- `get_schedule_info(db, user_id)` - Combines both functions

**Clash Detection**:
- Groups events by day
- Checks for time overlaps: `start1 < end2 AND start2 < end1`
- Returns list of clashes with conflict descriptions

**Next Class Calculation**:
- Finds next event (today after current time, or future days)
- Calculates time delta: "X hours Y minutes" or "X days Y hours"
- Handles week wrap-around

### `llm_service.py`
**Purpose**: OpenAI integration with RAG context for grounded responses

**Class**: `LLMService`

**Method**: `chat(user_id, message, rag_context)`

**Features**:
- Builds system prompt with RAG context
- Enforces grounded responses (only uses provided context)
- Uses `gpt-4o-mini` model (cost-efficient)
- Error handling for API failures

**System Prompt Rules**:
1. Only use information from provided context
2. Do NOT invent tasks, due dates, or class times
3. Say "I don't have that information" if not in context
4. Be helpful and concise

### `agora_service.py`
**Purpose**: Agora AI TTS integration for text-to-speech

**Class**: `AgoraTTSService`

**Method**: `generate_tts(text)` - Returns audio URL or None

**Features**:
- Optional TTS (only enabled if credentials provided)
- REST API integration with Agora Conversational AI Engine
- Graceful error handling (doesn't fail chat request if TTS fails)

---

## 5. API Routers (`apps/api/src/routers/`)

### `chat.py`
**Endpoint**: `POST /chat`

**Request**:
```json
{
  "userId": "user123",
  "message": "What assignments are due soon?",
  "useTTS": false
}
```

**Response**:
```json
{
  "assistantMessage": "Based on your tasks...",
  "audioUrl": null
}
```

**Flow**:
1. Retrieve user's tasks and schedule from database
2. Format context for LLM
3. Call LLM service with context
4. Optionally generate TTS audio
5. Return response

### `widgets.py`
**Endpoints**:

#### `GET /widgets/right-now?userId=xxx`
- Calls `get_right_now_suggestion()`
- Returns most urgent task or upcoming class

#### `GET /widgets/schedule?userId=xxx`
- Calls `get_schedule_info()`
- Returns clash detection + next class reminder

---

## 6. Main Application (`apps/api/src/main.py`)

**Features**:
- FastAPI app initialization
- CORS middleware setup
- Database table initialization on startup
- Health check endpoint: `GET /health`
- Router registration (chat, widgets)

**Startup Event**:
- Automatically creates database tables if they don't exist

---

## 7. Dependencies (`apps/api/requirements.txt`)

**Packages Installed**:
- `fastapi==0.104.1` - Web framework
- `uvicorn[standard]==0.24.0` - ASGI server
- `openai==1.3.0` - OpenAI API client
- `sqlalchemy==2.0.23` - ORM
- `pydantic==2.9.0` - Data validation (fixed version conflict)
- `pydantic-settings==2.5.0` - Settings management
- `python-dotenv==1.0.0` - Environment variables
- `httpx==0.25.0` - HTTP client (for Agora TTS)
- `python-dateutil==2.8.2` - Date utilities

**Note**: Fixed pydantic version conflict (changed from 2.5.0 to 2.9.0) to satisfy `pydantic-settings 2.5.0` requirement.

---

## 8. Documentation

### `apps/api/README.md`
Comprehensive documentation including:
- Architecture overview
- Database schema
- API endpoint documentation with examples
- Setup instructions
- Environment variables
- Development guide
- Testing scenarios

---

## 9. Repository Integration Changes

### Updated `.gitignore`
Added Python-specific ignores:
- `__pycache__/`, `*.pyc`, `*.pyo`
- Virtual environments (`venv/`, `.venv/`, `env/`)
- Database files (`*.db`, `*.sqlite`)
- IDE files (`.vscode/`, `.idea/`)

### Updated Root `README.md`
- Added `apps/api` backend documentation
- Added backend setup instructions
- Updated structure section

### Updated `packages/shared/src/types.ts`
Added TypeScript interfaces matching backend schemas:
- `StudyTask`
- `ScheduleEvent`
- `RightNowResponse`
- `ScheduleClashResponse`
- `ChatRequest` / `ChatResponse`

**Purpose**: Ensures frontend and backend share the same API contract.

---

## 10. Key Features Implemented

✅ **RAG Backend**: Reads from database and provides context to LLM  
✅ **RightNow Widget**: Prioritizes Canvas assignments by due date  
✅ **Schedule Widget**: Detects timetable clashes and calculates time until next class  
✅ **LLM Integration**: OpenAI with grounded responses (only uses database context)  
✅ **Optional TTS**: Agora AI TTS integration  
✅ **User Isolation**: All queries filter by `user_id`  
✅ **Auto Database Init**: Tables created automatically on startup  

---

## 11. File Statistics

- **Total Files Created**: 20+ Python files
- **Directories**: 6 directories
- **API Endpoints**: 3 endpoints
- **Services**: 5 core services
- **Database Models**: 2 models
- **API Schemas**: 6 Pydantic schemas

---

## 12. Usage

### Run the Server:
```bash
cd apps/api
pip install -r requirements.txt
# Create .env file with OPENAI_API_KEY
uvicorn src.main:app --reload
```

### API Endpoints:
- `GET /health` - Health check
- `POST /chat` - Chat with RAG context
- `GET /widgets/right-now?userId=xxx` - Get urgent task/class
- `GET /widgets/schedule?userId=xxx` - Get schedule info

### Documentation:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

---

## Summary

The backend is a complete RAG (Retrieval-Augmented Generation) system that:
1. Reads `StudyTask` and `ScheduleEvent` from database
2. Formats data as context for LLM
3. Provides grounded responses (only uses database context)
4. Supports RightNow and Schedule widgets
5. Includes optional TTS integration

All code follows the architecture plan and is ready for deployment. The modular structure can be easily maintained and extended.
