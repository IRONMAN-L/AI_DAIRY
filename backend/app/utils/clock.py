from datetime import datetime, timezone


def utcnow() -> datetime:
    """Naive UTC timestamp.

    Replaces the deprecated datetime.utcnow() while keeping values naive, so
    they stay consistent with rows already stored in SQLite.
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)
