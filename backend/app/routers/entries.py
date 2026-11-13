from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.dependencies.auth import get_optional_current_user
from app.models.entry import Entry
from app.models.user import User
from app.services.vector_store import try_index, try_remove
from app.utils.clock import utcnow
from app.schemas.entry import (
    EntryCreate,
    EntryUpdate,
    EntryResponse,
    TaskMigrationRequest
)
router = APIRouter(
    prefix="/api/entries",
    tags=["Journal Entries"]
)


@router.post("/", response_model=EntryResponse, status_code=201)
def create_entry(
    entry_data: EntryCreate,
    current_user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    data = entry_data.model_dump(exclude_unset=True)

    if data.get("entry_date") is None:
        data["entry_date"] = date.today()

    data["original_date"] = data["entry_date"]

    if data.get("entry_type") == "task" and data.get("status") == "done":
        data["completed_at"] = utcnow()

    if current_user:
        data["user_id"] = current_user.id

    entry = Entry(**data)

    db.add(entry)
    db.commit()
    db.refresh(entry)

    try_index(entry)

    return entry


@router.get("/", response_model=list[EntryResponse])
def get_entries(
    entry_date: date | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    entry_type: Literal["task", "event", "note"] | None = None,
    status: Literal["open", "done", "migrated"] | None = None,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Entry)

    if current_user:
        query = query.filter(or_(Entry.user_id == current_user.id, Entry.user_id.is_(None)))

    if entry_date:
        query = query.filter(Entry.entry_date == entry_date)

    if start_date:
        query = query.filter(Entry.entry_date >= start_date)

    if end_date:
        query = query.filter(Entry.entry_date <= end_date)

    if entry_type:
        query = query.filter(Entry.entry_type == entry_type)

    if status:
        query = query.filter(Entry.status == status)

    return (
        query
        .order_by(Entry.entry_date.desc(), Entry.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


@router.get("/{entry_id}", response_model=EntryResponse)
def get_entry(
    entry_id: int,
    current_user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    entry = db.query(Entry).filter(Entry.id == entry_id).first()

    if entry is None:
        raise HTTPException(status_code=404, detail="Entry not found")

    if current_user and entry.user_id and entry.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this entry")

    return entry


@router.put("/{entry_id}", response_model=EntryResponse)
def update_entry(
    entry_id: int,
    entry_data: EntryUpdate,
    current_user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    entry = db.query(Entry).filter(Entry.id == entry_id).first()

    if entry is None:
        raise HTTPException(status_code=404, detail="Entry not found")

    if current_user and entry.user_id and entry.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this entry")

    # A migrated entry is a historical snapshot. Protect every field, not
    # just its status, so edits always happen on the current task copy.
    if entry.status == "migrated":
        raise HTTPException(
            status_code=409,
            detail="Migrated entries are read-only; update the newer task copy instead",
        )

    updates = entry_data.model_dump(exclude_unset=True)

    old_status = entry.status
    new_type = updates.get("entry_type", entry.entry_type)
    new_status = updates.get("status", entry.status)

    # A migrated task has a newer copy; reopening it would create duplicates.
    if old_status == "migrated" and new_status != "migrated":
        raise HTTPException(
            status_code=400,
            detail="A migrated task cannot be reopened or completed; "
                   "update its newer copy instead"
        )

    if new_type != "task" and new_status != "open":
        raise HTTPException(
            status_code=400,
            detail="Only tasks can be 'done' or 'migrated'; "
                   "events and notes must stay 'open'"
        )

    for field, value in updates.items():
        setattr(entry, field, value)

    if entry.entry_type == "task":
        if entry.status == "done" and old_status != "done":
            entry.completed_at = utcnow()

        elif entry.status != "done":
            entry.completed_at = None
    else:
        entry.completed_at = None

    db.commit()
    db.refresh(entry)

    try_index(entry)

    return entry


@router.delete("/{entry_id}")
def delete_entry(
    entry_id: int,
    current_user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    entry = db.query(Entry).filter(Entry.id == entry_id).first()

    if entry is None:
        raise HTTPException(status_code=404, detail="Entry not found")

    if current_user and entry.user_id and entry.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this entry")

    if entry.status == "migrated":
        raise HTTPException(
            status_code=409,
            detail="Migrated entries are read-only and cannot be deleted; manage the newer task copy instead",
        )

    db.delete(entry)
    db.commit()

    try_remove(entry_id)

    return {
        "message": "Entry deleted successfully",
        "id": entry_id
    }
@router.post("/{entry_id}/migrate", response_model=EntryResponse)
def migrate_task(
    entry_id: int,
    migration_data: TaskMigrationRequest,
    current_user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    original_task = (
        db.query(Entry)
        .filter(Entry.id == entry_id)
        .first()
    )

    if original_task is None:
        raise HTTPException(
            status_code=404,
            detail="Task not found"
        )

    if current_user and original_task.user_id and original_task.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to migrate this task")

    if original_task.entry_type != "task":
        raise HTTPException(
            status_code=400,
            detail="Only tasks can be migrated"
        )

    if original_task.status != "open":
        raise HTTPException(
            status_code=400,
            detail="Only open tasks can be migrated"
        )

    target_date = migration_data.target_date

    if target_date <= original_task.entry_date:
        raise HTTPException(
            status_code=400,
            detail="Target date must be after the original date"
        )

    new_task = Entry(
        entry_date=target_date,
        original_date=original_task.original_date or original_task.entry_date,
        entry_type="task",
        title=original_task.title,
        content=original_task.content,
        status="open",
        source=original_task.source,
        migrated_from_id=original_task.id,
        user_id=original_task.user_id or (current_user.id if current_user else None)
    )

    original_task.status = "migrated"

    db.add(new_task)
    db.commit()
    db.refresh(new_task)

    # New copy is indexed; the original's status changed to 'migrated'.
    try_index(new_task)
    try_index(original_task)

    return new_task
@router.get("/{entry_id}/history", response_model=list[EntryResponse])
def get_task_history(
    entry_id: int,
    db: Session = Depends(get_db)
):
    entry = db.query(Entry).filter(Entry.id == entry_id).first()

    if entry is None:
        raise HTTPException(
            status_code=404,
            detail="Entry not found"
        )

    if entry.entry_type != "task":
        raise HTTPException(
            status_code=400,
            detail="Migration history is available only for tasks"
        )

    # Find the original task by following parent links.
    current = entry
    visited = set()

    while current.migrated_from_id is not None:
        if current.id in visited:
            raise HTTPException(
                status_code=400,
                detail="Invalid migration chain detected"
            )

        visited.add(current.id)

        parent = (
            db.query(Entry)
            .filter(Entry.id == current.migrated_from_id)
            .first()
        )

        if parent is None:
            break

        current = parent

    # Start with the original task.
    history = [current]
    visited = {current.id}

    # Follow child links to find subsequent migrations.
    while True:
        next_entry = (
            db.query(Entry)
            .filter(Entry.migrated_from_id == current.id)
            .order_by(Entry.id.asc())
            .first()
        )

        if next_entry is None or next_entry.id in visited:
            break

        history.append(next_entry)
        visited.add(next_entry.id)
        current = next_entry

    return history