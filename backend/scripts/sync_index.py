"""Repair drift between SQLite and the ChromaDB index (fast, incremental).

Run from the backend/ folder:
    python -m scripts.sync_index --dry-run   # report only
    python -m scripts.sync_index             # fix it

Use scripts.backfill_embeddings instead for a full rebuild.
"""
import sys

from app.database.connection import SessionLocal
from app.models.entry import Entry
from app.services.vector_store import reconcile

db = SessionLocal()
try:
    report = reconcile(db.query(Entry).all(), dry_run="--dry-run" in sys.argv)
    for key, value in report.items():
        print(f"{key:24} {value}")
finally:
    db.close()
