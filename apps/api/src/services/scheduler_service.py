"""Scheduler Service - Checks for timetable clashes and calculates time until next class."""
from typing import Optional, List, Tuple
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from ..models.db_models import ScheduleEvent
from ..models.schemas import ScheduleClashResponse, ScheduleClash, NextClassInfo


def parse_time(time_str: str) -> int:
    """Parse HHMM format time string to minutes since midnight."""
    try:
        if len(time_str) == 4:
            hours = int(time_str[:2])
            minutes = int(time_str[2:])
            return hours * 60 + minutes
        return 0
    except (ValueError, AttributeError):
        return 0


def check_overlap(start1: int, end1: int, start2: int, end2: int) -> bool:
    """Check if two time ranges overlap."""
    return start1 < end2 and start2 < end1


def check_schedule_clashes(db: Session, user_id: str) -> List[ScheduleClash]:
    """Check for overlapping schedule events on the same day."""
    all_events = db.query(ScheduleEvent).filter(
        ScheduleEvent.user_id == user_id
    ).order_by(ScheduleEvent.day, ScheduleEvent.start_time).all()
    
    clashes = []
    
    # Group events by day
    events_by_day = {}
    for event in all_events:
        if event.day not in events_by_day:
            events_by_day[event.day] = []
        events_by_day[event.day].append(event)
    
    # Check for overlaps within each day
    for day, day_events in events_by_day.items():
        for i in range(len(day_events)):
            for j in range(i + 1, len(day_events)):
                event1 = day_events[i]
                event2 = day_events[j]
                
                start1 = parse_time(event1.start_time)
                end1 = parse_time(event1.end_time)
                start2 = parse_time(event2.start_time)
                end2 = parse_time(event2.end_time)
                
                if check_overlap(start1, end1, start2, end2):
                    clashes.append(
                        ScheduleClash(
                            event1=event1.to_dict(),
                            event2=event2.to_dict(),
                            conflict=f"Overlapping time slots on {day}: {event1.start_time}-{event1.end_time} and {event2.start_time}-{event2.end_time}"
                        )
                    )
    
    return clashes


def get_next_class_reminder(db: Session, user_id: str) -> Optional[NextClassInfo]:
    """Calculate time until the next upcoming class."""
    now = datetime.utcnow()
    current_day = now.strftime("%A")
    current_time_str = now.strftime("%H%M")
    current_time_int = parse_time(current_time_str)
    
    all_events = db.query(ScheduleEvent).filter(
        ScheduleEvent.user_id == user_id
    ).order_by(ScheduleEvent.day, ScheduleEvent.start_time).all()
    
    if not all_events:
        return None
    
    day_order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    current_day_idx = day_order.index(current_day) if current_day in day_order else 0
    
    # Find next event
    next_event = None
    minutes_until = None
    
    for event in all_events:
        event_day_idx = day_order.index(event.day) if event.day in day_order else 99
        event_start_int = parse_time(event.start_time)
        
        days_until_event = (event_day_idx - current_day_idx) % 7
        
        # Check if event is in the future
        if days_until_event > 0:
            # Future day
            minutes_until = days_until_event * 24 * 60 + event_start_int - current_time_int
            next_event = event
            break
        elif days_until_event == 0 and event_start_int > current_time_int:
            # Today, but after current time
            minutes_until = event_start_int - current_time_int
            next_event = event
            break
    
    if not next_event:
        # Wrap around to next week
        first_event = all_events[0]
        first_day_idx = day_order.index(first_event.day) if first_event.day in day_order else 0
        days_until = (7 - current_day_idx + first_day_idx) % 7
        if days_until == 0:
            days_until = 7
        first_start_int = parse_time(first_event.start_time)
        minutes_until = days_until * 24 * 60 + first_start_int - current_time_int
        next_event = first_event
    
    if not next_event or minutes_until is None:
        return None
    
    # Format time until
    hours = minutes_until // 60
    minutes = minutes_until % 60
    days = hours // 24
    hours_in_day = hours % 24
    
    if days > 0:
        time_until_str = f"{days} days {hours_in_day} hours"
    elif hours > 0:
        time_until_str = f"{hours} hours {minutes} minutes"
    else:
        time_until_str = f"{minutes} minutes"
    
    # Format event start time
    start_time_str = next_event.start_time
    if len(start_time_str) == 4:
        formatted_time = f"{start_time_str[:2]}:{start_time_str[2:]}"
    else:
        formatted_time = start_time_str
    
    formatted_message = (
        f"Your next class is {next_event.module} {next_event.type} "
        f"at {formatted_time} in {next_event.venue or 'TBA'} "
        f"starting in {time_until_str}"
    )
    
    return NextClassInfo(
        event=next_event.to_dict(),
        timeUntil=time_until_str,
        formatted=formatted_message
    )


def get_schedule_info(db: Session, user_id: str) -> ScheduleClashResponse:
    """Get comprehensive schedule information including clashes and next class."""
    clashes = check_schedule_clashes(db, user_id)
    next_class = get_next_class_reminder(db, user_id)
    
    return ScheduleClashResponse(
        hasClash=len(clashes) > 0,
        clashes=clashes,
        nextClass=next_class,
        timeUntilNext=next_class.timeUntil if next_class else None
    )
