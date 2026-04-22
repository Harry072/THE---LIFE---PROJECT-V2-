from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from database import Base
import datetime

class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, index=True)
    email = Column(String)

class Task(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String)
    title = Column(String)
    subtitle = Column(String)
    category = Column(String)
    why = Column(String)
    detail_title = Column(String)
    detail_description = Column(String)
    done = Column(Boolean, default=False)
    completed_at = Column(DateTime, nullable=True)
    duration_minutes = Column(Integer, default=15)
    preferred_time = Column(String, default="morning")
    intensity = Column(String, default="medium")
    is_optional = Column(Boolean, default=False)
    for_date = Column(String) # YYYY-MM-DD
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
