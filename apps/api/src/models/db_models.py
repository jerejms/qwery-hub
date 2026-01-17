"""SQLAlchemy database models."""
from sqlalchemy import Column, Integer, String, Text
from sqlalchemy.sql import func
from datetime import datetime
from ..config.database import Base


class StudyTask(Base):
    """StudyTask model - populated by Canvas API caller."""
    __tablename__ = "study_tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    course = Column(String, nullable=False)
    due_at = Column(String, nullable=False)  # ISO timestamp
    link = Column(Text, nullable=True)
    user_id = Column(String, nullable=False, index=True)
    created_at = Column(String, default=lambda: datetime.utcnow().isoformat())
    updated_at = Column(String, default=lambda: datetime.utcnow().isoformat(), onupdate=lambda: datetime.utcnow().isoformat())
    
    def to_dict(self):
        """Convert model to dictionary."""
        return {
            "id": self.id,
            "title": self.title,
            "course": self.course,
            "dueAt": self.due_at,
            "link": self.link,
            "userId": self.user_id,
            "createdAt": self.created_at,
            "updatedAt": self.updated_at
        }


class ScheduleEvent(Base):
    """ScheduleEvent model - populated by NUSMods API caller."""
    __tablename__ = "schedule_events"
    
    id = Column(Integer, primary_key=True, index=True)
    module = Column(String, nullable=False)
    type = Column(String, nullable=False)  # LEC, TUT, LAB
    day = Column(String, nullable=False)  # Monday, Tuesday, etc.
    start_time = Column(String, nullable=False)  # e.g., "1400"
    end_time = Column(String, nullable=False)  # e.g., "1500"
    venue = Column(Text, nullable=True)
    user_id = Column(String, nullable=False, index=True)
    created_at = Column(String, default=lambda: datetime.utcnow().isoformat())
    updated_at = Column(String, default=lambda: datetime.utcnow().isoformat(), onupdate=lambda: datetime.utcnow().isoformat())
    
    def to_dict(self):
        """Convert model to dictionary."""
        return {
            "id": self.id,
            "module": self.module,
            "type": self.type,
            "day": self.day,
            "startTime": self.start_time,
            "endTime": self.end_time,
            "venue": self.venue,
            "userId": self.user_id,
            "createdAt": self.created_at,
            "updatedAt": self.updated_at
        }
