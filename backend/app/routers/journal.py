import calendar
from collections import Counter, defaultdict
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.dependencies.auth import get_optional_current_user
from app.models.entry import Entry
from app.models.user import User
from app.schemas.journal import (
    DailyJournalResponse,
    MonthlyStatisticsResponse,
    RangeJournalResponse,
    WeeklyStatisticsResponse,
)


router = APIRouter(
    prefix="/api/journal",
    tags=["Daily Journal"]
)


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _entries_between(db: Session, start_date: date, end_date: date, user_id: int | None = None) -> list[Entry]:
    query = db.query(Entry).filter(
        Entry.entry_date >= start_date,
        Entry.entry_date <= end_date
    )
    if user_id is not None:
        query = query.filter(or_(Entry.user_id == user_id, Entry.user_id.is_(None)))
    return (
        query
        .order_by(Entry.entry_date.asc(), Entry.id.asc())
        .all()
    )


def _statistics(entries: list[Entry]) -> dict:
    types = Counter(e.entry_type for e in entries)
    task_status = Counter(e.status for e in entries if e.entry_type == "task")

    total_tasks = types["task"]
    completed = task_status["done"]

    return {
        "total_entries": len(entries),
        "total_tasks": total_tasks,
        "completed_tasks": completed,
        "open_tasks": task_status["open"],
        "migrated_tasks": task_status["migrated"],
        "total_events": types["event"],
        "total_notes": types["note"],
        # Migrated tasks stay in the denominator: not finished in this period.
        "completion_percentage": (
            round(completed / total_tasks * 100, 2) if total_tasks else 0.0
        ),
    }


def _daily_activity(entries: list[Entry], start_date: date, num_days: int) -> list[dict]:
    by_day: dict[date, Counter] = defaultdict(Counter)
    for e in entries:
        by_day[e.entry_date][e.entry_type] += 1

    activity = []
    for offset in range(num_days):
        current = start_date + timedelta(days=offset)
        counts = by_day.get(current, Counter())
        activity.append({
            "date": current,
            "total_entries": sum(counts.values()),
            "tasks": counts["task"],
            "events": counts["event"],
            "notes": counts["note"],
        })
    return activity


# ---------------------------------------------------------------------------
# Routes. Fixed paths must stay above /{journal_date}.
# ---------------------------------------------------------------------------

@router.get("/range", response_model=RangeJournalResponse)
def get_journal_range(
    start_date: date,
    end_date: date,
    current_user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    if start_date > end_date:
        raise HTTPException(
            status_code=400,
            detail="Start date cannot be after end date"
        )

    entries = _entries_between(db, start_date, end_date, user_id=current_user.id if current_user else None)

    return {
        "start_date": start_date,
        "end_date": end_date,
        "total_entries": len(entries),
        "entries": entries
    }


@router.get("/weekly", response_model=WeeklyStatisticsResponse)
def get_weekly_statistics(
    start_date: date,
    current_user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    try:
        end_date = start_date + timedelta(days=6)
    except OverflowError:
        raise HTTPException(
            status_code=400,
            detail="start_date is too close to the largest supported date"
        )

    entries = _entries_between(db, start_date, end_date, user_id=current_user.id if current_user else None)

    return {
        "start_date": start_date,
        "end_date": end_date,
        "statistics": _statistics(entries),
        "daily_activity": _daily_activity(entries, start_date, 7)
    }


@router.get("/monthly", response_model=MonthlyStatisticsResponse)
def get_monthly_statistics(
    year: int = Query(ge=1, le=9999),
    month: int = Query(ge=1, le=12),
    current_user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    last_day = calendar.monthrange(year, month)[1]

    start_date = date(year, month, 1)
    end_date = date(year, month, last_day)

    entries = _entries_between(db, start_date, end_date, user_id=current_user.id if current_user else None)

    return {
        "year": year,
        "month": month,
        "statistics": _statistics(entries),
        "daily_activity": _daily_activity(entries, start_date, last_day)
    }


@router.get("/{journal_date}", response_model=DailyJournalResponse)
def get_daily_journal(
    journal_date: date,
    current_user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Entry).filter(Entry.entry_date == journal_date)
    if current_user:
        query = query.filter(or_(Entry.user_id == current_user.id, Entry.user_id.is_(None)))

    entries = (
        query
        .order_by(Entry.id.asc())
        .all()
    )

    return {
        "journal_date": journal_date,
        "statistics": _statistics(entries),
        "entries": entries
    }
