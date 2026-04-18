from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, DateTime, Text, JSON
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime, timezone

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    struggle_profile = Column(JSON, default=list) # Array of strings
    streak_count = Column(Integer, default=0)
    last_active = Column(DateTime, default=datetime.utcnow)

    tasks = relationship("Task", back_populates="owner")
    reflections = relationship("Reflection", back_populates="owner")
    growth_tree = relationship("GrowthTree", back_populates="owner", uselist=False)
    loop_tasks = relationship("LoopTask", back_populates="owner")
    user_context = relationship("UserContext", back_populates="owner", uselist=False)

class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    domain = Column(String, index=True) # "awareness", "action", "meaning"
    content = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    skipped = Column(Boolean, default=False)
    
    owner = relationship("User", back_populates="tasks")

class Reflection(Base):
    __tablename__ = "reflections"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    date = Column(DateTime, default=datetime.utcnow)
    answers = Column(JSON, default=list)
    pattern_tags = Column(JSON, default=list)

    owner = relationship("User", back_populates="reflections")

class GrowthTree(Base):
    __tablename__ = "growth_trees"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    branch_level = Column(Integer, default=1)
    leaf_density = Column(Integer, default=1)
    last_updated = Column(DateTime, default=datetime.utcnow)
    milestone_reached = Column(Integer, default=0)


    owner = relationship("User", back_populates="growth_tree")

class LoopTask(Base):
    __tablename__ = "loop_tasks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    for_date = Column(DateTime, default=datetime.utcnow)
    title = Column(String)
    subtitle = Column(String, nullable=True)
    category = Column(String)
    detail_title = Column(String, nullable=True)
    detail_description = Column(Text, nullable=True)
    why = Column(Text, nullable=True)
    inline_quote = Column(String, nullable=True)
    duration_minutes = Column(Integer, default=15)
    preferred_time = Column(String, default="morning")
    intensity = Column(String, default="medium")
    cover_image = Column(String, nullable=True)
    is_optional = Column(Boolean, default=False)
    done = Column(Boolean, default=False)
    completed_at = Column(DateTime, nullable=True)
    skipped = Column(Boolean, default=False)
    ai_generated = Column(Boolean, default=True)
    sort_order = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", back_populates="loop_tasks")

class UserContext(Base):
    __tablename__ = "user_context"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    onboarding = Column(JSON, nullable=True)
    streak = Column(Integer, default=0)
    completion_rate = Column(Integer, default=0)
    mood_trend = Column(JSON, default=list)
    skipped_categories = Column(JSON, default=list)
    updated_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", back_populates="user_context")
