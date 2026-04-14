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
