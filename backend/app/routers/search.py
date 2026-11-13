from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.dependencies.auth import get_optional_current_user
from app.models.entry import Entry
from app.models.user import User
from app.schemas.entry import EntryResponse
from app.services.search_service import (
    escape_like,
    keyword_rank,
    reciprocal_rank_fusion,
)
from app.services.vector_store import reconcile, semantic_search


router = APIRouter(
    prefix="/api/search",
    tags=["Journal Search"]
)

# Every page of a semantic/hybrid search ranks the same fixed candidate pool,
# so pages stay consistent. Covers the largest offset (200) plus limit (50).
CANDIDATE_POOL = 250


def _check_dates(start_date: date | None, end_date: date | None) -> None:
    if start_date and end_date and start_date > end_date:
        raise HTTPException(
            status_code=400,
            detail="Start date cannot be after end date"
        )


@router.get("/")
def search_entries(
    q: str = Query(min_length=2, description="Search keyword"),
    entry_type: Literal["task", "event", "note"] | None = None,
    status: Literal["open", "done", "migrated"] | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    _check_dates(start_date, end_date)

    query = db.query(Entry)

    if current_user:
        query = query.filter(or_(Entry.user_id == current_user.id, Entry.user_id.is_(None)))

    # Escape % and _ so they are matched literally, not as wildcards.
    search_term = f"%{escape_like(q.strip())}%"

    query = query.filter(
        (Entry.title.ilike(search_term, escape="\\")) |
        (Entry.content.ilike(search_term, escape="\\"))
    )

    if entry_type:
        query = query.filter(Entry.entry_type == entry_type)

    if status:
        query = query.filter(Entry.status == status)

    if start_date:
        query = query.filter(Entry.entry_date >= start_date)

    if end_date:
        query = query.filter(Entry.entry_date <= end_date)

    total_results = query.count()

    results = (
        query
        .order_by(Entry.entry_date.desc(), Entry.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return {
        "search_query": q,
        "total_results": total_results,
        "limit": limit,
        "offset": offset,
        "results": results
    }


# ---------------------------------------------------------------------------
# AI search: semantic and hybrid
# ---------------------------------------------------------------------------

def _load_results(db: Session, ranked: list[dict], limit: int, current_user: User | None = None) -> list[dict]:
    """Attach full entries from the database (the source of truth).

    Ids that exist in the vector index but not in SQLite are skipped.
    """
    ids = [r["entry_id"] for r in ranked]
    if not ids:
        return []
    query = db.query(Entry).filter(Entry.id.in_(ids))
    if current_user:
        query = query.filter(or_(Entry.user_id == current_user.id, Entry.user_id.is_(None)))
    entries = {e.id: e for e in query.all()}

    results = []
    for r in ranked:
        entry = entries.get(r["entry_id"])
        if entry is None:
            continue
        item = {
            "score": r["score"],
            "entry": EntryResponse.model_validate(entry),
        }
        if "matched_by" in r:
            item["matched_by"] = r["matched_by"]
        results.append(item)
        if len(results) == limit:
            break
    return results


@router.get("/semantic")
def semantic_search_entries(
    q: str = Query(min_length=2, description="Natural-language query"),
    entry_type: Literal["task", "event", "note"] | None = None,
    status: Literal["open", "done", "migrated"] | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    min_score: float = Query(default=0.15, ge=0.0, le=1.0),
    limit: int = Query(default=10, ge=1, le=50),
    offset: int = Query(default=0, ge=0, le=200),
    current_user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    _check_dates(start_date, end_date)

    ranked = semantic_search(
        q.strip(), k=CANDIDATE_POOL,
        entry_type=entry_type, status=status,
        start_date=start_date, end_date=end_date,
    )
    ranked = [r for r in ranked if r["score"] >= min_score]
    results = _load_results(db, ranked[offset:offset + limit], limit, current_user=current_user)

    return {
        "search_query": q,
        "method": "semantic",
        "limit": limit,
        "offset": offset,
        "total_results": len(results),   # results on this page
        "results": results,
    }


@router.get("/hybrid")
def hybrid_search_entries(
    q: str = Query(min_length=2, description="Natural-language query"),
    entry_type: Literal["task", "event", "note"] | None = None,
    status: Literal["open", "done", "migrated"] | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    min_semantic_score: float = Query(default=0.15, ge=0.0, le=1.0),
    limit: int = Query(default=10, ge=1, le=50),
    offset: int = Query(default=0, ge=0, le=200),
    current_user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    _check_dates(start_date, end_date)

    pool = CANDIDATE_POOL

    keyword = keyword_rank(
        db, q, entry_type=entry_type, status=status,
        start_date=start_date, end_date=end_date, limit=pool,
    )
    semantic = [
        r for r in semantic_search(
            q.strip(), k=pool,
            entry_type=entry_type, status=status,
            start_date=start_date, end_date=end_date,
        )
        if r["score"] >= min_semantic_score
    ]

    fused = reciprocal_rank_fusion({"keyword": keyword, "semantic": semantic})
    results = _load_results(db, fused[offset:offset + limit], limit, current_user=current_user)

    return {
        "search_query": q,
        "method": "hybrid (keyword + semantic, reciprocal rank fusion)",
        "limit": limit,
        "offset": offset,
        "total_results": len(results),   # results on this page
        "results": results,
    }


@router.post("/sync")
def sync_vector_index(
    dry_run: bool = Query(default=False, description="Only report differences"),
    db: Session = Depends(get_db)
):
    """Repair drift between SQLite (source of truth) and the vector index."""
    return reconcile(db.query(Entry).all(), dry_run=dry_run)
