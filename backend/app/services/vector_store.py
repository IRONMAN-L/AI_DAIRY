import logging
from datetime import date
from threading import RLock
import chromadb

from app.database.connection import BASE_DIR
from app.services.embeddings import embed

logger = logging.getLogger(__name__)
_index_lock = RLock()
INDEX_NAME = "entries"
STAGING_NAME = "entries_rebuild"
RETIRED_NAME = "entries_old"
BATCH_SIZE = 256

_client = chromadb.PersistentClient(path=str(BASE_DIR / "chroma_db"))


def _create(name: str):
    return _client.create_collection(
        name=name,
        configuration={"hnsw": {"space": "cosine"}},
    )


def _get_or_create(name: str):
    return _client.get_or_create_collection(
        name=name,
        configuration={"hnsw": {"space": "cosine"}},
    )


def _collection_names() -> set[str]:
    collections = _client.list_collections()

    # Supports Chroma versions returning names or Collection objects.
    return {
        item if isinstance(item, str) else item.name
        for item in collections
    }


def _delete_if_exists(name: str) -> None:
    if name in _collection_names():
        _client.delete_collection(name)


def _recover_collection():
    """Recover the last usable index after an interrupted rebuild."""

    names = _collection_names()

    if INDEX_NAME not in names:
        if RETIRED_NAME in names:
            # Restore the previous known-good index.
            old = _client.get_collection(RETIRED_NAME)
            old.modify(name=INDEX_NAME)

            logger.warning(
                "Recovered previous vector index from %s",
                RETIRED_NAME
            )

        else:
            # No known-good index exists. A staging collection
            # may be incomplete, so discard it.
            _delete_if_exists(STAGING_NAME)
            logger.warning("Creating a fresh vector index")
            return _create(INDEX_NAME)

    # An active index exists. Staging is not yet committed.
    _delete_if_exists(STAGING_NAME)

    # Preserve RETIRED_NAME for now. It may be the only
    # recoverable copy after an earlier interrupted rebuild.
    return _client.get_collection(INDEX_NAME)


_collection = _recover_collection()


def _doc(entry) -> str:
    """Text that gets embedded. Title is optional in the schema."""
    title = (entry.title or "").strip()
    content = (entry.content or "").strip()
    return f"{title}\n{content}" if title else content


def _stamp(entry) -> str:
    """Version marker; lets reconcile() spot entries edited without re-indexing."""
    return str(entry.updated_at)


def _meta(entry) -> dict:
    return {
        "entry_date": str(entry.entry_date),
        # Chroma range filters only work on numbers, so keep an ordinal too.
        "date_ord": entry.entry_date.toordinal(),
        "entry_type": entry.entry_type,
        "status": entry.status,
        "updated_at": _stamp(entry),
    }


def _upsert(collection, entries: list) -> None:
    for i in range(0, len(entries), BATCH_SIZE):
        chunk = entries[i:i + BATCH_SIZE]
        docs = [_doc(e) for e in chunk]
        collection.upsert(
            ids=[str(e.id) for e in chunk],
            documents=docs,
            embeddings=embed(docs),
            metadatas=[_meta(e) for e in chunk],
        )


def index_entries(entries: list) -> None:
    """Embed and upsert many entries."""
    if entries:
        _upsert(_collection, entries)


def index_entry(entry) -> None:
    index_entries([entry])


def remove_entry(entry_id: int) -> None:
    _collection.delete(ids=[str(entry_id)])


def rebuild(entries: list) -> None:
    """Safely rebuild the vector index."""

    global _collection

    with _index_lock:

        # Remove incomplete staging data from an earlier attempt.
        _delete_if_exists(STAGING_NAME)

        staging = _create(STAGING_NAME)

        try:
            _upsert(staging, entries)

            actual = staging.count()
            expected = len(entries)

            if actual != expected:
                raise RuntimeError(
                    f"Staging index has {actual} entries, "
                    f"expected {expected}"
                )

        except Exception:
            _delete_if_exists(STAGING_NAME)
            raise

        # The staging index is now verified.
        # It is safe to discard an older retired backup because
        # the active index still exists.
        _delete_if_exists(RETIRED_NAME)

        current = _client.get_collection(INDEX_NAME)

        # Move the current index out of the way.
        current.modify(name=RETIRED_NAME)

        try:
            # Promote the verified replacement.
            staging.modify(name=INDEX_NAME)

        except Exception:
            # If promotion failed, restore the previous index.
            names = _collection_names()

            if INDEX_NAME not in names and RETIRED_NAME in names:
                old = _client.get_collection(RETIRED_NAME)
                old.modify(name=INDEX_NAME)

            _delete_if_exists(STAGING_NAME)
            raise

        # Refresh our active collection reference.
        _collection = _client.get_collection(INDEX_NAME)

        # Successful promotion: remove the old backup.
        try:
            _delete_if_exists(RETIRED_NAME)
        except Exception:
            logger.exception(
                "New index is active, but old index cleanup failed"
            )


def reconcile(entries: list, dry_run: bool = False) -> dict:
    """Bring the index in line with SQLite (the source of truth).

    - missing: in SQLite but not indexed         -> index them
    - stale:   edited since they were indexed    -> re-index them
    - orphaned: indexed but gone from SQLite     -> remove them
    """
    existing = _collection.get(include=["metadatas"])
    indexed = {
        int(i): (m or {}).get("updated_at")
        for i, m in zip(existing["ids"], existing["metadatas"])
    }
    wanted = {e.id: e for e in entries}

    missing = [e for i, e in wanted.items() if i not in indexed]
    stale = [e for i, e in wanted.items() if i in indexed and indexed[i] != _stamp(e)]
    orphaned = [i for i in indexed if i not in wanted]

    if not dry_run:
        index_entries(missing + stale)
        if orphaned:
            _collection.delete(ids=[str(i) for i in orphaned])

    return {
        "dry_run": dry_run,
        "entries_in_database": len(wanted),
        "entries_indexed_before": len(indexed),
        "missing": len(missing),
        "stale": len(stale),
        "orphaned": len(orphaned),
        "in_sync": not (missing or stale or orphaned),
    }


# --- Failure-safe wrappers: a vector-index problem must never break a diary write.
# If one fails, the index drifts from SQLite; reconcile() repairs it.

def try_index(entry) -> None:
    try:
        index_entry(entry)
    except Exception:
        logger.exception("Could not index entry %s", getattr(entry, "id", "?"))


def try_remove(entry_id: int) -> None:
    try:
        remove_entry(entry_id)
    except Exception:
        logger.exception("Could not remove entry %s from index", entry_id)


def _build_where(
    entry_type: str | None,
    status: str | None,
    start_date: date | None,
    end_date: date | None,
) -> dict | None:
    conditions = []
    if entry_type:
        conditions.append({"entry_type": entry_type})
    if status:
        conditions.append({"status": status})
    if start_date:
        conditions.append({"date_ord": {"$gte": start_date.toordinal()}})
    if end_date:
        conditions.append({"date_ord": {"$lte": end_date.toordinal()}})

    if not conditions:
        return None
    if len(conditions) == 1:
        return conditions[0]
    return {"$and": conditions}


def semantic_search(
    query: str,
    k: int = 10,
    entry_type: str | None = None,
    status: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
) -> list[dict]:
    """Return [{'entry_id': int, 'score': float}] sorted best-first.

    score is cosine similarity (1 = identical meaning direction).
    """
    if k < 1:
        raise ValueError("k must be greater than zero")
    total = _collection.count()
    if total == 0:
        return []

    res = _collection.query(
        query_embeddings=embed([query]),
        n_results=min(k, total),
        where=_build_where(entry_type, status, start_date, end_date),
    )
    results = [
        {"entry_id": int(i), "score": round(1 - d, 4)}
        for i, d in zip(res["ids"][0], res["distances"][0])
    ]
    # Ties (e.g. a migrated task and its copy) must order the same way every
    # time, or pagination can skip or repeat entries.
    results.sort(key=lambda r: (-r["score"], r["entry_id"]))
    return results

