"""Rebuild the ChromaDB index from everything in SQLite.

Run from the backend/ folder:
    python -m scripts.backfill_embeddings
"""
from app.database.connection import SessionLocal
from app.models.entry import Entry
from app.services.vector_store import rebuild

db = SessionLocal()
try:
    entries = db.query(Entry).order_by(Entry.id).all()
    rebuild(entries)
    for e in entries:
        print(f"indexed #{e.id}  {e.entry_date}  {e.entry_type:5}  {e.title or e.content[:40]}")
    print(f"\nDone: {len(entries)} entries indexed.")
finally:
    db.close()
