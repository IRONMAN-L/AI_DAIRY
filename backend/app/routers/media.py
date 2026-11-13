from fastapi import APIRouter, File, HTTPException, UploadFile

from app.schemas.media import MediaExtractionResponse
from app.services.media_service import (
    process_audio_transcription,
    process_document_extraction,
    process_image_ocr,
)

router = APIRouter(
    prefix="/api/media",
    tags=["Multi-Modal Input & Ingestion"]
)


@router.post("/ocr", response_model=MediaExtractionResponse)
async def extract_image_text(file: UploadFile = File(...)):
    """Extract handwritten or printed text from uploaded photograph/image."""
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    return await process_image_ocr(content, file.filename or "image.jpg")


@router.post("/transcribe", response_model=MediaExtractionResponse)
async def transcribe_audio(file: UploadFile = File(...)):
    """Transcribe voice audio recording into text."""
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    return await process_audio_transcription(content, file.filename or "audio.webm")


@router.post("/extract-doc", response_model=MediaExtractionResponse)
async def extract_document(file: UploadFile = File(...)):
    """Extract readable text from a PDF, Markdown, or text file."""
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    return await process_document_extraction(content, file.filename or "document.txt")

