import json
import os
from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile
from sqlalchemy.orm import Session

from app.database.connection import BASE_DIR, get_db
from app.models.entry import Entry
from app.services.backup_service import (
    export_backup_data,
    export_markdown_journal,
    import_backup_data,
)
from app.utils.clock import utcnow

router = APIRouter(
    prefix="/api/backup",
    tags=["Backup & Data Portability"]
)


@router.get("/export")
def download_backup_json(db: Session = Depends(get_db)):
    """Download full structured JSON backup of all diary and bullet journal records."""
    data = export_backup_data(db)
    content = json.dumps(data, indent=2)
    filename = f"diary_backup_{utcnow().strftime('%Y%m%d_%H%M%S')}.json"

    return Response(
        content=content,
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/markdown")
def download_markdown_export(db: Session = Depends(get_db)):
    """Download complete journal compiled into an archival Markdown document."""
    content = export_markdown_journal(db)
    filename = f"journal_archive_{utcnow().strftime('%Y%m%d')}.md"

    return Response(
        content=content,
        media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.post("/import")
async def upload_backup_json(
    file: UploadFile = File(...),
    mode: str = Query(default="merge", pattern="^(merge|replace)$"),
    db: Session = Depends(get_db),
):
    """Restore diary entries from a structured JSON backup file."""
    content = await file.read()
    try:
        data = json.loads(content.decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON format.")

    try:
        result = import_backup_data(db, data, mode=mode)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/stats")
def get_backup_and_storage_stats(db: Session = Depends(get_db)):
    """Return database file size, record totals, and storage information."""
    db_path = BASE_DIR / "diary.db"
    db_size_bytes = os.path.getsize(db_path) if os.path.exists(db_path) else 0

    total_entries = db.query(Entry).count()
    total_tasks = db.query(Entry).filter(Entry.entry_type == "task").count()
    completed_tasks = db.query(Entry).filter(Entry.entry_type == "task", Entry.status == "done").count()
    open_tasks = db.query(Entry).filter(Entry.entry_type == "task", Entry.status == "open").count()
    migrated_tasks = db.query(Entry).filter(Entry.entry_type == "task", Entry.status == "migrated").count()

    return {
        "database_file": str(db_path.name),
        "database_size_kb": round(db_size_bytes / 1024, 2),
        "total_entries": total_entries,
        "total_tasks": total_tasks,
        "completed_tasks": completed_tasks,
        "open_tasks": open_tasks,
        "migrated_tasks": migrated_tasks,
        "last_backup_check": utcnow().isoformat(),
    }
