from datetime import date
from typing import Literal
from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, description="User question or instruction")
    history: list[ChatMessage] = Field(default_factory=list, description="Recent conversation turns")


class Citation(BaseModel):
    entry_id: int
    title: str | None
    entry_date: date
    entry_type: str
    status: str
    snippet: str


class ChatResponse(BaseModel):
    answer: str
    citations: list[Citation]
    retrieved_count: int
    model: str

