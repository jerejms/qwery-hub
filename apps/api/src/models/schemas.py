"""Pydantic schemas for API requests and responses."""
from typing import Optional, Literal, List, Dict, Any
from pydantic import BaseModel


class ChatRequest(BaseModel):
    """Request schema for chat endpoint."""
    userId: str
    message: str
    useTTS: Optional[bool] = False


class ChatResponse(BaseModel):
    """Response schema for chat endpoint."""
    assistantMessage: str
    audioUrl: Optional[str] = None


class RightNowResponse(BaseModel):
    """Response schema for right-now widget."""
    message: str
    type: Literal["CLASS", "TASK", "IDLE"]
    data: Optional[Dict[str, Any]] = None


class ScheduleClash(BaseModel):
    """Schema for a schedule clash."""
    event1: Dict[str, Any]
    event2: Dict[str, Any]
    conflict: str


class NextClassInfo(BaseModel):
    """Schema for next class information."""
    event: Dict[str, Any]
    timeUntil: str
    formatted: str


class ScheduleClashResponse(BaseModel):
    """Response schema for schedule widget."""
    hasClash: bool
    clashes: List[ScheduleClash]
    nextClass: Optional[NextClassInfo] = None
    timeUntilNext: Optional[str] = None
