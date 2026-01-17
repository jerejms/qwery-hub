"""FastAPI main application entry point."""
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from .config.database import init_db
from .middleware.cors import setup_cors
from .routers import chat, widgets

# Create FastAPI app
app = FastAPI(
    title="AI Study Buddy API",
    description="RAG backend for AI Study Buddy with RightNow and Schedule widgets",
    version="1.0.0"
)

# Setup CORS
setup_cors(app)

# Initialize database tables
@app.on_event("startup")
async def startup_event():
    """Initialize database on startup."""
    init_db()


# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return JSONResponse(content={"status": "healthy", "service": "ai-study-buddy-api"})


# Register routers
app.include_router(chat.router)
app.include_router(widgets.router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
