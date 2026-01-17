"""RAG Service - Retrieves and formats data from database for LLM context."""
from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from ..models.db_models import StudyTask, ScheduleEvent


def get_user_tasks(db: Session, user_id: str, limit: int = 20) -> List[StudyTask]:
    """Get all tasks for a user, ordered by due date."""
    tasks = db.query(StudyTask).filter(
        StudyTask.user_id == user_id
    ).order_by(StudyTask.due_at.asc()).limit(limit).all()
    return tasks


def get_user_schedule(db: Session, user_id: str, day: Optional[str] = None) -> List[ScheduleEvent]:
    """Get schedule events for a user, optionally filtered by day."""
    query = db.query(ScheduleEvent).filter(ScheduleEvent.user_id == user_id)
    
    if day:
        query = query.filter(ScheduleEvent.day == day)
    
    events = query.order_by(ScheduleEvent.day, ScheduleEvent.start_time).all()
    return events


def format_context_for_llm(
    tasks: List[StudyTask],
    events: List[ScheduleEvent],
    current_time: datetime
) -> str:
    """Format database data into structured text for LLM system prompt."""
    context_lines = []
    
    # Format current time
    context_lines.append(f"Current Time: {current_time.strftime('%Y-%m-%d %H:%M:%S')} UTC")
    context_lines.append("")
    
    # Format tasks section
    context_lines.append("=== USER'S STUDY TASKS (from Canvas) ===")
    if tasks:
        for task in tasks:
            due_date_str = task.due_at
            context_lines.append(
                f"- Task: {task.title} | Course: {task.course} | Due: {due_date_str} | Link: {task.link or 'N/A'}"
            )
    else:
        context_lines.append("- No tasks found.")
    context_lines.append("")
    
    # Format schedule section
    context_lines.append("=== USER'S CLASS SCHEDULE (from NUSMods) ===")
    if events:
        # Group by day
        events_by_day = {}
        for event in events:
            if event.day not in events_by_day:
                events_by_day[event.day] = []
            events_by_day[event.day].append(event)
        
        # Sort days
        day_order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        sorted_days = sorted(events_by_day.keys(), key=lambda d: day_order.index(d) if d in day_order else 99)
        
        for day in sorted_days:
            day_events = events_by_day[day]
            context_lines.append(f"\n{day}:")
            for event in day_events:
                start_time = f"{event.start_time[:2]}:{event.start_time[2:]}" if len(event.start_time) == 4 else event.start_time
                end_time = f"{event.end_time[:2]}:{event.end_time[2:]}" if len(event.end_time) == 4 else event.end_time
                context_lines.append(
                    f"  - {event.module} ({event.type}) | {start_time}-{end_time} | Venue: {event.venue or 'N/A'}"
                )
    else:
        context_lines.append("- No schedule events found.")
    
    return "\n".join(context_lines)
