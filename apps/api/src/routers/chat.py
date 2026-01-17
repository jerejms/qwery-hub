"""Chat router - POST /chat endpoint with RAG context."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from ..models.schemas import ChatRequest, ChatResponse
from ..config.database import get_db
from ..services.rag_service import get_user_tasks, get_user_schedule, format_context_for_llm
from ..services.llm_service import llm_service
from ..services.agora_service import agora_service

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    db: Session = Depends(get_db)
):
    """
    Chat endpoint that uses RAG context to provide grounded responses.
    
    1. Retrieve user's tasks and schedule from database
    2. Format context for LLM
    3. Call LLM with context
    4. Optionally generate TTS audio
    """
    try:
        # Get user's data from database
        tasks = get_user_tasks(db, request.userId)
        events = get_user_schedule(db, request.userId)
        
        # Format context for LLM
        current_time = datetime.utcnow()
        rag_context = format_context_for_llm(tasks, events, current_time)
        
        # Call LLM with context
        assistant_message = llm_service.chat(request.userId, request.message, rag_context)
        
        # Optionally generate TTS audio
        audio_url = None
        if request.useTTS:
            audio_url = agora_service.generate_tts(assistant_message)
        
        return ChatResponse(
            assistantMessage=assistant_message,
            audioUrl=audio_url
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing chat request: {str(e)}")
