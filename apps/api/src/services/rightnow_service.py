"""RightNow Service - Prioritizes Canvas assignments by due date urgency."""
from typing import Optional
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from ..models.db_models import StudyTask, ScheduleEvent
from ..models.schemas import RightNowResponse


def get_right_now_suggestion(db: Session, user_id: str) -> RightNowResponse:
    """
    Get the most urgent task or upcoming class suggestion.
    Prioritizes Canvas assignments by due date (nearest first).
    """
    now = datetime.utcnow()
    
    # Get all user tasks, ordered by due date
    all_tasks = db.query(StudyTask).filter(
        StudyTask.user_id == user_id
    ).order_by(StudyTask.due_at.asc()).all()
    
    # Filter to upcoming tasks (due_at >= now)
    upcoming_tasks = []
    for task in all_tasks:
        try:
            due_date = datetime.fromisoformat(task.due_at.replace('Z', '+00:00'))
            if due_date.tzinfo is None:
                due_date = datetime.fromisoformat(task.due_at)
            
            # Normalize to UTC for comparison
            if due_date.tzinfo:
                due_date = due_date.replace(tzinfo=None) - timedelta(hours=8)  # Convert SGT to UTC if needed
            
            if due_date >= now:
                upcoming_tasks.append((task, due_date))
        except (ValueError, AttributeError):
            # Skip tasks with invalid date format
            continue
    
    # Sort by urgency (nearest due first)
    if upcoming_tasks:
        upcoming_tasks.sort(key=lambda x: x[1])
        most_urgent_task, due_date = upcoming_tasks[0]
        
        # Calculate time until due
        time_until_due = due_date - now
        hours_until = time_until_due.total_seconds() / 3600
        
        # Format message based on urgency
        if hours_until < 2:
            urgency = "CRITICAL"
        elif hours_until < 24:
            urgency = "URGENT"
        elif hours_until < 48:
            urgency = "HIGH"
        else:
            urgency = "NORMAL"
        
        if hours_until < 1:
            time_str = f"{int(time_until_due.total_seconds() / 60)} minutes"
        elif hours_until < 24:
            time_str = f"{int(hours_until)} hours"
        else:
            days = int(hours_until / 24)
            time_str = f"{days} days"
        
        message = f"Focus on {most_urgent_task.course} - {most_urgent_task.title} | Due in {time_str} ({urgency})"
        
        return RightNowResponse(
            type="TASK",
            message=message,
            data={
                "task": most_urgent_task.to_dict(),
                "hoursUntil": round(hours_until, 2),
                "urgency": urgency
            }
        )
    
    # No urgent tasks - check if class starting soon (within 60 min)
    all_events = db.query(ScheduleEvent).filter(
        ScheduleEvent.user_id == user_id
    ).order_by(ScheduleEvent.day, ScheduleEvent.start_time).all()
    
    # Get current day of week
    current_day = now.strftime("%A")
    current_time_str = now.strftime("%H%M")
    current_time_int = int(current_time_str)
    
    # Check events for today or next few days
    day_order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    current_day_idx = day_order.index(current_day) if current_day in day_order else 0
    
    for event in all_events:
        event_day_idx = day_order.index(event.day) if event.day in day_order else 99
        
        # Check if event is today or in the future
        days_until_event = (event_day_idx - current_day_idx) % 7
        if days_until_event == 0:  # Today
            try:
                event_start_int = int(event.start_time)
                time_diff = event_start_int - current_time_int
                # Convert to minutes
                hours = time_diff // 100
                minutes = time_diff % 100
                minutes_until = hours * 60 + minutes
                
                if 0 <= minutes_until <= 60:
                    message = f"You have {event.module} {event.type} starting at {event.start_time[:2]}:{event.start_time[2:]} in {minutes_until} minutes"
                    return RightNowResponse(
                        type="CLASS",
                        message=message,
                        data={
                            "event": event.to_dict(),
                            "minutesUntil": minutes_until
                        }
                    )
            except (ValueError, AttributeError):
                continue
        elif days_until_event > 0 and days_until_event <= 1:  # Tomorrow or next day
            try:
                event_start_int = int(event.start_time)
                if event_start_int <= 1400:  # Before 2 PM
                    message = f"You have {event.module} {event.type} tomorrow at {event.start_time[:2]}:{event.start_time[2:]}"
                    return RightNowResponse(
                        type="CLASS",
                        message=message,
                        data={
                            "event": event.to_dict(),
                            "daysUntil": days_until_event
                        }
                    )
            except (ValueError, AttributeError):
                continue
    
    # No urgent tasks or upcoming classes
    return RightNowResponse(
        type="IDLE",
        message="No urgent tasks. You can work ahead!"
    )
