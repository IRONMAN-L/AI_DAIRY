from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.schemas.assistant import ChatRequest, ChatResponse
from app.services.assistant_service import answer_assistant_query

router = APIRouter(
    prefix="/api/assistant",
    tags=["AI Diary Assistant"]
)


@router.post("/chat", response_model=ChatResponse)
async def chat_with_assistant(
    request: ChatRequest,
    db: Session = Depends(get_db)
):
    """Conversational RAG endpoint grounding answers strictly in retrieved journal history."""
    response = await answer_assistant_query(
        db=db,
        message=request.message,
        history=request.history
    )
    return response

