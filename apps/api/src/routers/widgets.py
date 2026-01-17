"""Widgets router - RightNow and Schedule widgets."""
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from ..models.schemas import RightNowResponse, ScheduleClashResponse
from ..config.database import get_db
from ..services.rightnow_service import get_right_now_suggestion
from ..services.scheduler_service import get_schedule_info

router = APIRouter(prefix="/widgets", tags=["widgets"])


@router.get("/right-now", response_model=RightNowResponse)
async def get_right_now(
    userId: str = Query(..., description="User ID"),
    db: Session = Depends(get_db)
):
    """
    Get RightNow widget suggestion - prioritizes Canvas assignments by due date.
    
    Returns the most urgent task or upcoming class suggestion.
    """
    try:
        return get_right_now_suggestion(db, userId)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting right now suggestion: {str(e)}")


@router.get("/schedule", response_model=ScheduleClashResponse)
async def get_schedule(
    userId: str = Query(..., description="User ID"),
    db: Session = Depends(get_db)
):
    """
    Get Schedule widget information - clash detection and next class reminder.
    
    Returns:
    - hasClash: Whether there are overlapping schedule events
    - clashes: List of detected clashes
    - nextClass: Information about the next upcoming class
    - timeUntilNext: Time until next class
    """
    try:
        return get_schedule_info(db, userId)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting schedule info: {str(e)}")
