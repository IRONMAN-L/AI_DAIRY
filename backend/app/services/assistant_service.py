import logging
import os
import re
from datetime import date
import httpx
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

from app.models.entry import Entry
from app.schemas.assistant import Citation, ChatResponse, ChatMessage
from app.services.search_service import keyword_rank, reciprocal_rank_fusion
from app.services.vector_store import semantic_search


def _build_context_prompt(entries: list[Entry]) -> str:
    parts = []
    for e in entries:
        title = e.title or "Untitled"
        parts.append(
            f"- Entry ID: {e.id} | Date: {e.entry_date} | Type: {e.entry_type} | "
            f"Status: {e.status}\n  Title: {title}\n  Content: {e.content}"
        )
    return "\n\n".join(parts)


def _generate_local_grounded_answer(query: str, entries: list[Entry]) -> str:
    """Deterministic local extractive synthesis when no cloud LLM API key is present."""
    if not entries:
        return (
            f"I searched your diary and bullet journal, but could not find any entries or tasks "
            f"relevant to \"{query}\". Would you like to write a new entry about this today?"
        )

    tasks = [e for e in entries if e.entry_type == "task"]
    events = [e for e in entries if e.entry_type == "event"]
    notes = [e for e in entries if e.entry_type == "note"]

    lines = [
        f"Based on your journal records, here is what I found regarding \"{query}\":\n"
    ]

    if tasks:
        lines.append("### Relevant Tasks:")
        for t in tasks:
            status_desc = "Completed" if t.status == "done" else "Migrated" if t.status == "migrated" else "Open"
            lines.append(f"• **{t.title or 'Task'}** ({t.entry_date}) — *Status: {status_desc}*")
            if t.content:
                lines.append(f"  {t.content}")

    if events:
        lines.append("\n### Journal Events:")
        for ev in events:
            lines.append(f"• **{ev.title or 'Event'}** ({ev.entry_date})")
            if ev.content:
                lines.append(f"  {ev.content}")

    if notes:
        lines.append("\n### Notes & Reflections:")
        for n in notes:
            lines.append(f"• **{n.title or 'Note'}** ({n.entry_date})")
            if n.content:
                lines.append(f"  {n.content}")

    lines.append(
        "\n*These facts are directly grounded in your journal history. Click any referenced entry below to open its full daily record.*"
    )

    return "\n".join(lines)


async def answer_assistant_query(
    db: Session,
    message: str,
    history: list[ChatMessage] | None = None,
) -> ChatResponse:
    q = message.strip()

    # 1. Hybrid Retrieval Step
    ranked_keyword = keyword_rank(db, q, limit=25)
    ranked_semantic = [
        r for r in semantic_search(q, k=25)
        if r.get("score", 0) >= 0.15
    ]

    fused = reciprocal_rank_fusion({
        "keyword": ranked_keyword,
        "semantic": ranked_semantic,
    })

    top_ids = [r["entry_id"] for r in fused[:6]]

    # If the user asks a general temporal/overview question and similarity search yields few hits,
    # supplement with recent entries from the database
    is_general_query = any(
        w in q.lower()
        for w in ["summary", "summarize", "recent", "today", "yesterday", "tasks", "overview", "goals", "week", "month"]
    )

    if len(top_ids) < 3 and is_general_query:
        fallback_entries = (
            db.query(Entry)
            .order_by(Entry.entry_date.desc(), Entry.id.desc())
            .limit(6)
            .all()
        )
        for fe in fallback_entries:
            if fe.id not in top_ids:
                top_ids.append(fe.id)

    # 2. Load full entries in order of relevance
    entries_map = {e.id: e for e in db.query(Entry).filter(Entry.id.in_(top_ids)).all()}
    retrieved_entries = [entries_map[eid] for eid in top_ids if eid in entries_map]

    # 3. Construct Citations
    citations = []
    for e in retrieved_entries:
        snippet = e.content.strip()
        if len(snippet) > 160:
            snippet = snippet[:157] + "..."
        citations.append(
            Citation(
                entry_id=e.id,
                title=e.title,
                entry_date=e.entry_date,
                entry_type=e.entry_type,
                status=e.status,
                snippet=snippet,
            )
        )

    # 4. LLM Synthesis
    gemini_key = os.environ.get("GEMINI_API_KEY", "").strip(' \t\n\r"')
    openai_key = os.environ.get("OPENAI_API_KEY", "").strip(' \t\n\r"')

    system_instruction = (
        "You are an intelligent, thoughtful personal Diary Assistant for a Digital Diary & Bullet Journal app. "
        "Answer the user's question using ONLY the provided journal entries as grounded evidence. "
        "Avoid hallucinating personal history or inventing facts. Cite entries by date and title. "
        "If the journal entries do not contain the answer, honestly state that you found no records."
    )

    context_str = _build_context_prompt(retrieved_entries)

    # Attempt Gemini API if key provided
    if gemini_key:
        headers = {
            "x-goog-api-key": gemini_key,
            "Content-Type": "application/json",
        }
        payload = {
            "systemInstruction": {"parts": [{"text": system_instruction}]},
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {
                            "text": (
                                f"Journal Context:\n{context_str}\n\n"
                                f"User Question: {q}"
                            )
                        }
                    ],
                }
            ],
            "generationConfig": {"temperature": 0.2, "maxOutputTokens": 800},
        }

        # Try models supported by the API key
        for model_name in ["gemini-2.5-flash", "gemini-flash-latest", "gemini-1.5-flash"]:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={gemini_key}"
                async with httpx.AsyncClient(timeout=20.0) as client:
                    res = await client.post(url, headers=headers, json=payload)
                    if res.status_code == 200:
                        data = res.json()
                        candidates = data.get("candidates", [])
                        if candidates:
                            text = candidates[0]["content"]["parts"][0]["text"]
                            return ChatResponse(
                                answer=text,
                                citations=citations,
                                retrieved_count=len(retrieved_entries),
                                model=model_name,
                            )
                    else:
                        logger.warning(
                            "Gemini API model %s returned status %s: %s",
                            model_name,
                            res.status_code,
                            res.text,
                        )
            except Exception as e:
                logger.warning("Gemini API call to %s failed: %s", model_name, e)

    # Attempt OpenAI API if key provided
    if openai_key:
        try:
            url = "https://api.openai.com/v1/chat/completions"
            headers = {"Authorization": f"Bearer {openai_key}"}
            payload = {
                "model": "gpt-4o-mini",
                "messages": [
                    {"role": "system", "content": system_instruction},
                    {
                        "role": "user",
                        "content": f"Journal Context:\n{context_str}\n\nUser Question: {q}",
                    },
                ],
                "temperature": 0.2,
                "max_tokens": 800,
            }
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(url, headers=headers, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    text = data["choices"][0]["message"]["content"]
                    return ChatResponse(
                        answer=text,
                        citations=citations,
                        retrieved_count=len(retrieved_entries),
                        model="gpt-4o-mini",
                    )
        except Exception:
            pass

    # Fallback: Local Grounded Extractive Synthesizer
    answer = _generate_local_grounded_answer(q, retrieved_entries)
    return ChatResponse(
        answer=answer,
        citations=citations,
        retrieved_count=len(retrieved_entries),
        model="local-grounded-rag",
    )

