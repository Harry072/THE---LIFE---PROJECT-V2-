from pydantic import BaseModel, EmailStr
from typing import List, Optional, Any
from datetime import datetime

class TaskBase(BaseModel):
    domain: str
    content: str

class TaskCreate(TaskBase):
    pass

class Task(TaskBase):
    id: int
    user_id: int
    created_at: datetime
    completed_at: Optional[datetime] = None
    skipped: bool

    class Config:
        from_attributes = True

class ReflectionBase(BaseModel):
    answers: List[Any]
    pattern_tags: List[str] = []

class ReflectionCreate(ReflectionBase):
    pass

class Reflection(ReflectionBase):
    id: int
    user_id: int
    date: datetime

    class Config:
        from_attributes = True

class GrowthTreeBase(BaseModel):
    branch_level: int
    leaf_density: int
    milestone_reached: int

class GrowthTree(GrowthTreeBase):
    id: int
    user_id: int
    last_updated: datetime

    class Config:
        from_attributes = True

class UserBase(BaseModel):
    email: EmailStr

class UserCreate(UserBase):
    password: str
    struggle_profile: List[str]

class User(UserBase):
    id: int
    created_at: datetime
    streak_count: int
    struggle_profile: List[str]
    tasks: List[Task] = []
    growth_tree: Optional[GrowthTree] = None

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None
