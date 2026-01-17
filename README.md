# qwery-hub

An interactive AI study buddy with chat + widget sidebar (Canvas tasks, NUSMods schedule, more).

## Structure
- apps/web: Next.js app (UI + widget sidebar)
- apps/api: FastAPI backend (RAG service with LLM integration)
- packages/shared: shared types/schemas

## Run locally

### Frontend (Next.js)
```bash
cd apps/web
npm install
npm run dev
```

### Backend (FastAPI)
```bash
cd apps/api
pip install -r requirements.txt
# Create .env file with OPENAI_API_KEY
uvicorn src.main:app --reload
```

See `apps/api/README.md` for detailed backend setup instructions.

## Team workflow
- Do not push to main directly
- Create a branch: feat/<name>-<feature>
- Open a Pull Request to merge
