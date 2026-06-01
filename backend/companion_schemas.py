from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class ChatRequest(BaseModel):
    user_id: UUID
    session_id: UUID | None = None
    message: str = Field(..., min_length=1, max_length=1200)

    @field_validator("message")
    @classmethod
    def normalize_message(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("message is required")
        return cleaned


class ChatResponse(BaseModel):
    reply: str
    session_id: UUID
    message_count: int

