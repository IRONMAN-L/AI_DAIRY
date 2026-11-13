from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from app.database.connection import engine
from app.routers.auth import router as auth_router
from app.routers.entries import router as entries_router
from app.routers.journal import router as journal_router
from app.routers.search import router as search_router
from app.routers.assistant import router as assistant_router
from app.routers.media import router as media_router
from app.routers.backup import router as backup_router

# Database schema is managed exclusively by Alembic.
# Before first startup on a fresh checkout, run: alembic upgrade head

# Create FastAPI application
app = FastAPI(
    title="Digital Diary API",
    description="Personal AI-powered Digital Diary and Bullet Journal",
    version="1.0.0"
)

# Allow the React (Vite) dev server to call this API from the browser.
FRONTEND_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routers
app.include_router(auth_router)
app.include_router(entries_router)
app.include_router(journal_router)
app.include_router(search_router)
app.include_router(assistant_router)
app.include_router(media_router)
app.include_router(backup_router)


@app.get("/")
def root():
    return {
        "message": "Welcome to Digital Diary API",
        "status": "running"
    }


@app.get("/api/health")
def health_check():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except Exception:
        raise HTTPException(status_code=503, detail="Database unavailable")

    return {
        "status": "healthy",
        "application": "Digital Diary",
        "database": "connected"
    }
