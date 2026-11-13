from typing import Literal
from pydantic import BaseModel


class MediaExtractionResponse(BaseModel):
    text: str
    filename: str
    source: Literal["typed", "voice", "photo", "pdf"]
    detected_title: str | None = None
    character_count: int

