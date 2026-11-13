import base64
import logging
import os
import re
import shutil
import subprocess
import tempfile
import httpx

from app.schemas.media import MediaExtractionResponse

logger = logging.getLogger(__name__)

GEMINI_MODELS = ["gemini-2.5-flash", "gemini-flash-latest", "gemini-1.5-flash"]


def _guess_mime_type(filename: str, default: str) -> str:
    ext = os.path.splitext(filename)[1].lower()
    mapping = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".gif": "image/gif",
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".webm": "audio/webm",
        ".ogg": "audio/ogg",
        ".m4a": "audio/m4a",
        ".pdf": "application/pdf",
        ".txt": "text/plain",
        ".md": "text/markdown",
    }
    raw = mapping.get(ext, default)
    return raw.split(";")[0].strip()


def _detect_title_from_text(text: str, fallback_title: str) -> str:
    cleaned = text.strip()
    if not cleaned:
        return fallback_title
    first_line = cleaned.splitlines()[0].strip()
    first_line = re.sub(r"^[#*•\-\s]+", "", first_line)
    if first_line and len(first_line) <= 60:
        return first_line
    return fallback_title


async def process_image_ocr(file_bytes: bytes, filename: str) -> MediaExtractionResponse:
    """Extract handwritten or printed text from a photograph or scanned journal page."""
    gemini_key = os.environ.get("GEMINI_API_KEY", "").strip(' \t\n\r"')
    openai_key = os.environ.get("OPENAI_API_KEY", "").strip(' \t\n\r"')
    mime_type = _guess_mime_type(filename, "image/jpeg")
    base64_data = base64.b64encode(file_bytes).decode("ascii")

    prompt = (
        "Extract and transcribe all text, notes, and handwriting from this diary or journal image. "
        "Preserve bullet points, lists, and line breaks. "
        "Output ONLY the transcribed text with no conversational opening or concluding commentary."
    )

    if gemini_key:
        headers = {
            "x-goog-api-key": gemini_key,
            "Content-Type": "application/json",
        }
        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": prompt},
                        {
                            "inlineData": {
                                "mimeType": mime_type,
                                "data": base64_data,
                            }
                        },
                    ]
                }
            ],
            "generationConfig": {"temperature": 0.1, "maxOutputTokens": 1500},
        }
        for model_name in GEMINI_MODELS:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={gemini_key}"
                async with httpx.AsyncClient(timeout=30.0) as client:
                    res = await client.post(url, headers=headers, json=payload)
                    if res.status_code == 200:
                        candidates = res.json().get("candidates", [])
                        if candidates:
                            extracted = candidates[0]["content"]["parts"][0]["text"].strip()
                            return MediaExtractionResponse(
                                text=extracted,
                                filename=filename,
                                source="photo",
                                detected_title=_detect_title_from_text(extracted, f"Photo Note: {filename}"),
                                character_count=len(extracted),
                            )
                    else:
                        logger.warning(
                            "Gemini OCR model %s returned status %s: %s",
                            model_name,
                            res.status_code,
                            res.text,
                        )
            except Exception as e:
                logger.warning("Gemini OCR call to %s failed: %s", model_name, e)

    if openai_key:
        try:
            url = "https://api.openai.com/v1/chat/completions"
            headers = {"Authorization": f"Bearer {openai_key}"}
            payload = {
                "model": "gpt-4o-mini",
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {"url": f"data:{mime_type};base64,{base64_data}"},
                            },
                        ],
                    }
                ],
                "max_tokens": 1200,
            }
            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.post(url, headers=headers, json=payload)
                if res.status_code == 200:
                    extracted = res.json()["choices"][0]["message"]["content"].strip()
                    return MediaExtractionResponse(
                        text=extracted,
                        filename=filename,
                        source="photo",
                        detected_title=_detect_title_from_text(extracted, f"Photo Note: {filename}"),
                        character_count=len(extracted),
                    )
        except Exception:
            pass

    if gemini_key or openai_key:
        fallback_text = (
            f"[Photograph attached: {filename}]\n\n"
            "Cloud OCR could not extract legible text from this image. "
            "You can type your diary entry or notes directly in the box below."
        )
    else:
        fallback_text = (
            f"[Photograph attached: {filename}]\n\n"
            "Image received and stored. Note: Configure GEMINI_API_KEY in your .env file "
            "to enable automated cloud handwriting OCR transcription, or type your transcription directly."
        )
    return MediaExtractionResponse(
        text=fallback_text,
        filename=filename,
        source="photo",
        detected_title=f"Photo: {filename}",
        character_count=len(fallback_text),
    )


async def process_audio_transcription(file_bytes: bytes, filename: str) -> MediaExtractionResponse:
    """Transcribe spoken audio recording into text."""
    gemini_key = os.environ.get("GEMINI_API_KEY", "").strip(' \t\n\r"')
    openai_key = os.environ.get("OPENAI_API_KEY", "").strip(' \t\n\r"')
    mime_type = _guess_mime_type(filename, "audio/webm")

    prompt = (
        "Transcribe this voice journal recording into clear, punctuated text. "
        "Output ONLY the transcript with no conversational commentary."
    )

    if gemini_key:
        headers = {
            "x-goog-api-key": gemini_key,
            "Content-Type": "application/json",
        }
        base64_data = base64.b64encode(file_bytes).decode("ascii")
        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": prompt},
                        {
                            "inlineData": {
                                "mimeType": mime_type,
                                "data": base64_data,
                            }
                        },
                    ]
                }
            ],
            "generationConfig": {"temperature": 0.1, "maxOutputTokens": 1000},
        }
        for model_name in GEMINI_MODELS:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={gemini_key}"
                async with httpx.AsyncClient(timeout=30.0) as client:
                    res = await client.post(url, headers=headers, json=payload)
                    if res.status_code == 200:
                        candidates = res.json().get("candidates", [])
                        if candidates:
                            extracted = candidates[0]["content"]["parts"][0]["text"].strip()
                            return MediaExtractionResponse(
                                text=extracted,
                                filename=filename,
                                source="voice",
                                detected_title=_detect_title_from_text(extracted, f"Voice Memo: {filename}"),
                                character_count=len(extracted),
                            )
                    else:
                        logger.warning(
                            "Gemini audio transcription model %s returned status %s: %s",
                            model_name,
                            res.status_code,
                            res.text,
                        )
            except Exception as e:
                logger.warning("Gemini audio transcription call to %s failed: %s", model_name, e)

    if openai_key:
        try:
            url = "https://api.openai.com/v1/audio/transcriptions"
            headers = {"Authorization": f"Bearer {openai_key}"}
            files = {"file": (filename, file_bytes, mime_type)}
            data = {"model": "whisper-1"}
            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.post(url, headers=headers, files=files, data=data)
                if res.status_code == 200:
                    extracted = res.json().get("text", "").strip()
                    return MediaExtractionResponse(
                        text=extracted,
                        filename=filename,
                        source="voice",
                        detected_title=_detect_title_from_text(extracted, f"Voice Memo: {filename}"),
                        character_count=len(extracted),
                    )
        except Exception:
            pass

    if gemini_key or openai_key:
        fallback_text = (
            f"[Voice recording uploaded: {filename}]\n\n"
            "Cloud voice transcription could not process this audio file. "
            "You can use the in-browser live microphone button for real-time dictation, or type notes manually."
        )
    else:
        fallback_text = (
            f"[Voice recording uploaded: {filename}]\n\n"
            "Audio recorded. You can also use the in-browser live microphone button for instantaneous dictation."
        )
    return MediaExtractionResponse(
        text=fallback_text,
        filename=filename,
        source="voice",
        detected_title=f"Voice Memo: {filename}",
        character_count=len(fallback_text),
    )


async def process_document_extraction(file_bytes: bytes, filename: str) -> MediaExtractionResponse:
    """Extract readable text from a PDF, Markdown, or text document."""
    ext = os.path.splitext(filename)[1].lower()

    # Plain text or Markdown files
    if ext in [".txt", ".md", ".csv", ".json"]:
        try:
            text = file_bytes.decode("utf-8").strip()
        except UnicodeDecodeError:
            text = file_bytes.decode("latin-1", errors="replace").strip()

        return MediaExtractionResponse(
            text=text,
            filename=filename,
            source="pdf",
            detected_title=_detect_title_from_text(text, f"Doc: {filename}"),
            character_count=len(text),
        )

    # PDF handling
    if ext == ".pdf":
        # 1. Poppler pdftotext (ultra-fast, local, accurate for compressed & multi-page PDFs)
        if shutil.which("pdftotext"):
            try:
                with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
                    tmp.write(file_bytes)
                    tmp_path = tmp.name
                try:
                    res = subprocess.run(
                        ["pdftotext", "-layout", tmp_path, "-"],
                        capture_output=True,
                        text=True,
                        timeout=15.0,
                    )
                    extracted = res.stdout.strip()
                    if extracted:
                        return MediaExtractionResponse(
                            text=extracted,
                            filename=filename,
                            source="pdf",
                            detected_title=_detect_title_from_text(extracted, f"PDF: {filename}"),
                            character_count=len(extracted),
                        )
                finally:
                    if os.path.exists(tmp_path):
                        os.unlink(tmp_path)
            except Exception:
                pass

        # 2. Gemini Vision/Doc AI if API key is provided (best for scanned/image-based PDFs)
        gemini_key = os.environ.get("GEMINI_API_KEY", "").strip(' \t\n\r"')
        if gemini_key:
            headers = {
                "x-goog-api-key": gemini_key,
                "Content-Type": "application/json",
            }
            base64_data = base64.b64encode(file_bytes).decode("ascii")
            payload = {
                "contents": [
                    {
                        "parts": [
                            {"text": "Extract all text from this PDF document cleanly. Output only the text content."},
                            {
                                "inlineData": {
                                    "mimeType": "application/pdf",
                                    "data": base64_data,
                                }
                            },
                        ]
                    }
                ],
                "generationConfig": {"temperature": 0.1, "maxOutputTokens": 2500},
            }
            for model_name in GEMINI_MODELS:
                try:
                    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={gemini_key}"
                    async with httpx.AsyncClient(timeout=30.0) as client:
                        res = await client.post(url, headers=headers, json=payload)
                        if res.status_code == 200:
                            candidates = res.json().get("candidates", [])
                            if candidates:
                                extracted = candidates[0]["content"]["parts"][0]["text"].strip()
                                if extracted:
                                    return MediaExtractionResponse(
                                        text=extracted,
                                        filename=filename,
                                        source="pdf",
                                        detected_title=_detect_title_from_text(extracted, f"Document: {filename}"),
                                        character_count=len(extracted),
                                    )
                        else:
                            logger.warning(
                                "Gemini PDF extraction model %s returned status %s: %s",
                                model_name,
                                res.status_code,
                                res.text,
                            )
                except Exception as e:
                    logger.warning("Gemini PDF extraction to %s failed: %s", model_name, e)

        # 3. Regex stream parser for text in PDF objects
        matches = re.findall(rb"\((.*?)\)", file_bytes)
        extracted_strings = [
            m.decode("latin-1", errors="ignore").strip()
            for m in matches
            if len(m.strip()) > 2 and not m.startswith(b"!")
        ]

        if extracted_strings:
            extracted = " ".join(extracted_strings[:150])
            return MediaExtractionResponse(
                text=extracted,
                filename=filename,
                source="pdf",
                detected_title=_detect_title_from_text(extracted, f"PDF: {filename}"),
                character_count=len(extracted),
            )

    fallback_text = f"[Document uploaded: {filename}] Document received and attached."
    return MediaExtractionResponse(
        text=fallback_text,
        filename=filename,
        source="pdf",
        detected_title=f"Doc: {filename}",
        character_count=len(fallback_text),
    )

