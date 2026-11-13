import re
from datetime import date

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.entry import Entry

STOPWORDS = {
    "a", "an", "the", "is", "are", "was", "were", "be", "to", "of", "in", "on",
    "at", "for", "and", "or", "my", "me", "i", "we", "you", "it", "this",
    "that", "what", "when", "where", "which", "who", "how", "did", "do",
    "does", "have", "has", "had", "with", "about", "from", "by", "as",
}


def escape_like(text: str) -> str:
    """Escape LIKE wildcards so user input is matched literally."""
    return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def tokenize(text: str) -> list[str]:
    """Lowercase alphanumeric terms, minus stopwords and 1-char tokens."""
    words = re.findall(r"[^\W_]+", text.lower())
    seen, terms = set(), []
    for w in words:
        if len(w) >= 2 and w not in STOPWORDS and w not in seen:
            seen.add(w)
            terms.append(w)
    return terms


def keyword_rank(
    db: Session,
    q: str,
    entry_type: str | None = None,
    status: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    limit: int = 50,
) -> list[dict]:
    """Multi-term keyword search. Returns [{'entry_id', 'score'}] best-first.

    An entry matches if it contains ANY query term; score rewards matching
    more distinct terms and matching in the title (weight 2) over content (1).
    """
    terms = tokenize(q)
    if not terms:
        return []

    clauses = []
    for t in terms:
        like = f"%{t}%"
        clauses.append(Entry.title.ilike(like))
        clauses.append(Entry.content.ilike(like))

    query = db.query(Entry).filter(or_(*clauses))
    if entry_type:
        query = query.filter(Entry.entry_type == entry_type)
    if status:
        query = query.filter(Entry.status == status)
    if start_date:
        query = query.filter(Entry.entry_date >= start_date)
    if end_date:
        query = query.filter(Entry.entry_date <= end_date)

    scored = []
    for e in query.all():
        title = (e.title or "").lower()
        content = (e.content or "").lower()
        score = sum(2 * (t in title) + (t in content) for t in terms)
        if score:
            scored.append((score, e.entry_date, e.id))

    scored.sort(key=lambda x: (x[0], x[1], x[2]), reverse=True)
    return [{"entry_id": i, "score": float(s)} for s, _, i in scored[:limit]]


def reciprocal_rank_fusion(
    ranked_lists: dict[str, list[dict]],
    k: int = 60,
) -> list[dict]:
    """Fuse several ranked lists. Each item: {'entry_id', 'score'}.

    fused(d) = sum over lists of 1 / (k + rank(d)), rank starting at 1.
    Returns [{'entry_id', 'score', 'matched_by': [...]}] best-first.
    """
    fused: dict[int, float] = {}
    sources: dict[int, list[str]] = {}
    for name, items in ranked_lists.items():
        for rank, item in enumerate(items, start=1):
            eid = item["entry_id"]
            fused[eid] = fused.get(eid, 0.0) + 1.0 / (k + rank)
            sources.setdefault(eid, []).append(name)

    ordered = sorted(fused.items(), key=lambda kv: (-kv[1], kv[0]))
    return [
        {"entry_id": eid, "score": round(score, 5), "matched_by": sources[eid]}
        for eid, score in ordered
    ]
