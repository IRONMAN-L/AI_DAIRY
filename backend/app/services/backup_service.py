from datetime import datetime, date
from sqlalchemy.orm import Session

from app.models.entry import Entry
from app.services.vector_store import reconcile
from app.utils.clock import utcnow


def export_backup_data(db: Session) -> dict:
    entries = db.query(Entry).order_by(Entry.id.asc()).all()

    items = []
    for e in entries:
        items.append({
            "id": e.id,
            "entry_date": str(e.entry_date),
            "entry_type": e.entry_type,
            "title": e.title,
            "content": e.content,
            "status": e.status,
            "source": e.source,
            "original_date": str(e.original_date) if e.original_date else None,
            "migrated_from_id": e.migrated_from_id,
            "completed_at": e.completed_at.isoformat() if e.completed_at else None,
            "created_at": e.created_at.isoformat() if e.created_at else None,
            "updated_at": e.updated_at.isoformat() if e.updated_at else None,
        })

    return {
        "version": "1.0",
        "exported_at": utcnow().isoformat(),
        "total_entries": len(items),
        "entries": items,
    }


def import_backup_data(db: Session, backup_dict: dict, mode: str = "merge") -> dict:
    raw_entries = backup_dict.get("entries", [])
    if not isinstance(raw_entries, list):
        raise ValueError("Invalid backup structure: 'entries' list missing.")

    imported_count = 0
    skipped_count = 0

    if mode == "replace":
        # Delete all entries and rebuild fresh
        db.query(Entry).delete()
        db.commit()

        # Insert keeping original IDs where possible
        for item in raw_entries:
            entry_date = date.fromisoformat(item["entry_date"])
            orig_date = date.fromisoformat(item["original_date"]) if item.get("original_date") else entry_date
            comp_at = datetime.fromisoformat(item["completed_at"]) if item.get("completed_at") else None

            entry = Entry(
                id=item.get("id"),
                entry_date=entry_date,
                entry_type=item.get("entry_type", "event"),
                title=item.get("title"),
                content=item.get("content", ""),
                status=item.get("status", "open"),
                source=item.get("source", "typed"),
                original_date=orig_date,
                migrated_from_id=item.get("migrated_from_id"),
                completed_at=comp_at,
            )
            db.add(entry)
            imported_count += 1

        db.commit()

    else:  # merge mode
        existing = {
            (e.entry_date, (e.title or "").strip(), e.content.strip())
            for e in db.query(Entry).all()
        }

        for item in raw_entries:
            e_date = date.fromisoformat(item["entry_date"])
            e_title = (item.get("title") or "").strip()
            e_content = item.get("content", "").strip()

            if (e_date, e_title, e_content) in existing:
                skipped_count += 1
                continue

            orig_date = date.fromisoformat(item["original_date"]) if item.get("original_date") else e_date
            comp_at = datetime.fromisoformat(item["completed_at"]) if item.get("completed_at") else None

            entry = Entry(
                entry_date=e_date,
                entry_type=item.get("entry_type", "event"),
                title=item.get("title"),
                content=item.get("content", ""),
                status=item.get("status", "open"),
                source=item.get("source", "typed"),
                original_date=orig_date,
                migrated_from_id=item.get("migrated_from_id"),
                completed_at=comp_at,
            )
            db.add(entry)
            imported_count += 1

        db.commit()

    # Reconcile vector search index with imported database records
    reconcile(db.query(Entry).all(), dry_run=False)

    return {
        "status": "success",
        "mode": mode,
        "imported": imported_count,
        "skipped": skipped_count,
        "total_in_database": db.query(Entry).count(),
    }


def export_markdown_journal(db: Session) -> str:
    entries = db.query(Entry).order_by(Entry.entry_date.desc(), Entry.id.desc()).all()

    lines = [
        "# Digital Diary & Bullet Journal Archive",
        f"*Exported on {utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}*",
        f"*Total Records: {len(entries)}*",
        "\n---\n",
    ]

    current_date = None
    for e in entries:
        if e.entry_date != current_date:
            current_date = e.entry_date
            lines.append(f"\n## 📅 {current_date.strftime('%A, %B %d, %Y')}\n")

        status_tag = f" `[{e.status.upper()}]`" if e.entry_type == "task" else ""
        source_tag = f" *({e.source})*" if e.source != "typed" else ""
        lines.append(f"### {e.title or 'Untitled'} — *{e.entry_type.capitalize()}*{status_tag}{source_tag}")

        if e.original_date and e.original_date != e.entry_date:
            lines.append(f"> ↪ Migrated from original date: {e.original_date}\n")

        if e.completed_at:
            lines.append(f"> ✓ Completed at: {e.completed_at.strftime('%Y-%m-%d %H:%M')}\n")

        lines.append(f"{e.content}\n")
        lines.append("---\n")

    return "\n".join(lines)

