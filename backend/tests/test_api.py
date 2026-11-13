from urllib import response
from app.database.connection import BASE_DIR, DATABASE_URL


def make(client, **fields):
    payload = {"entry_type": "task", "content": "placeholder", **fields}
    response = client.post("/api/entries/", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


# --- infrastructure ---------------------------------------------------------

def test_health_checks_the_database(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["database"] == "connected"


def test_cors_allows_the_vite_dev_server(client):
    response = client.options(
        "/api/entries/",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_database_path_does_not_depend_on_working_directory():
    assert (BASE_DIR / "app").is_dir()
    assert DATABASE_URL == f"sqlite:///{BASE_DIR / 'diary.db'}"


# --- status rules -----------------------------------------------------------

def test_cannot_create_an_entry_as_migrated(client):
    response = client.post(
        "/api/entries/",
        json={"entry_type": "task", "content": "x", "status": "migrated"},
    )
    assert response.status_code == 422


def test_notes_and_events_cannot_be_created_done(client):
    for entry_type in ("note", "event"):
        response = client.post(
            "/api/entries/",
            json={"entry_type": entry_type, "content": "x", "status": "done"},
        )
        assert response.status_code == 422


def test_cannot_set_migrated_through_put(client):
    task = make(client)
    response = client.put(f"/api/entries/{task['id']}", json={"status": "migrated"})
    assert response.status_code == 422


def test_note_cannot_become_done_through_put(client):
    note = make(client, entry_type="note")
    response = client.put(f"/api/entries/{note['id']}", json={"status": "done"})
    assert response.status_code == 400


def test_done_task_turned_into_note_loses_completed_at(client):
    task = make(client, status="done")
    assert task["completed_at"] is not None
    response = client.put(
        f"/api/entries/{task['id']}",
        json={"entry_type": "note", "status": "open"},
    )
    assert response.status_code == 200
    assert response.json()["completed_at"] is None


def test_completed_at_is_set_and_cleared(client):
    task = make(client)
    done = client.put(f"/api/entries/{task['id']}", json={"status": "done"}).json()
    assert done["completed_at"] is not None
    reopened = client.put(f"/api/entries/{task['id']}", json={"status": "open"}).json()
    assert reopened["completed_at"] is None


# --- migration --------------------------------------------------------------

def test_migration_creates_linked_copy_and_history(client):
    task = make(client, entry_date="2026-11-02", title="DSA")
    migrate = client.post(
        f"/api/entries/{task['id']}/migrate", json={"target_date": "2026-11-03"}
    )
    assert migrate.status_code == 200
    copy = migrate.json()
    assert copy["migrated_from_id"] == task["id"]
    assert copy["original_date"] == "2026-11-02"

    assert client.get(f"/api/entries/{task['id']}").json()["status"] == "migrated"
    history = client.get(f"/api/entries/{copy['id']}/history").json()
    assert [e["id"] for e in history] == [task["id"], copy["id"]]


def test_migrated_task_cannot_be_reopened(client):
    task = make(client, entry_date="2026-11-02")
    client.post(f"/api/entries/{task['id']}/migrate", json={"target_date": "2026-11-03"})
    response = client.put(f"/api/entries/{task['id']}", json={"status": "open"})
    assert response.status_code == 409

# --- keyword search ---------------------------------------------------------

def test_percent_and_underscore_are_matched_literally(client):
    make(client, content="50% off sale")
    make(client, content="5000 items")
    make(client, content="file a_b done")
    make(client, content="file axb done")

    percent = client.get("/api/search/", params={"q": "50%"}).json()
    assert percent["total_results"] == 1

    underscore = client.get("/api/search/", params={"q": "a_b"}).json()
    assert underscore["total_results"] == 1


def test_search_rejects_reversed_dates_before_querying(client):
    response = client.get(
        "/api/search/",
        params={"q": "dsa", "start_date": "2026-11-05", "end_date": "2026-11-01"},
    )
    assert response.status_code == 400


# --- semantic and hybrid search --------------------------------------------

def test_semantic_search_matches_meaning_not_words(client):
    study = make(client, title="Study Compiler Design", content="Revise parsing chapter")
    make(client, title="Buy groceries", content="Milk and eggs")
    response = client.get("/api/search/semantic", params={"q": "exam preparation"})
    ids = [r["entry"]["id"] for r in response.json()["results"]]
    assert ids[0] == study["id"]


def test_untitled_entries_are_indexed(client):
    note = make(client, entry_type="note", content="Learned Python decorators today")
    response = client.get("/api/search/semantic", params={"q": "python decorators"})
    assert [r["entry"]["id"] for r in response.json()["results"]] == [note["id"]]


def test_hybrid_reports_which_methods_matched(client):
    make(client, title="Complete DSA practice", content="Solve graph problems")
    results = client.get("/api/search/hybrid", params={"q": "DSA practice"}).json()["results"]
    assert set(results[0]["matched_by"]) == {"keyword", "semantic"}


def test_filters_apply_to_semantic_search(client):
    make(client, entry_date="2026-11-02", content="graph problems")
    later = make(client, entry_date="2026-11-03", content="graph problems")
    response = client.get(
        "/api/search/semantic",
        params={"q": "graph problems", "start_date": "2026-11-03"},
    )
    assert [r["entry"]["id"] for r in response.json()["results"]] == [later["id"]]


def test_delete_removes_entry_from_the_index(client):
    task = make(client, title="Compiler design", content="parsing")
    client.delete(f"/api/entries/{task['id']}")
    response = client.get("/api/search/semantic", params={"q": "compiler design"})
    assert response.json()["results"] == []


def test_status_change_is_reflected_in_the_index(client):
    task = make(client, content="graph problems")
    client.put(f"/api/entries/{task['id']}", json={"status": "done"})
    done = client.get("/api/search/semantic", params={"q": "graph problems", "status": "done"})
    assert len(done.json()["results"]) == 1
    still_open = client.get("/api/search/semantic", params={"q": "graph problems", "status": "open"})
    assert still_open.json()["results"] == []


# --- journal ----------------------------------------------------------------

def test_daily_journal_statistics(client):
    make(client, entry_date="2026-11-02", status="done")
    make(client, entry_date="2026-11-02")
    make(client, entry_date="2026-11-02", entry_type="note")
    body = client.get("/api/journal/2026-11-02").json()
    stats = body["statistics"]
    assert stats["total_entries"] == 3
    assert stats["total_tasks"] == 2
    assert stats["completed_tasks"] == 1
    assert stats["completion_percentage"] == 50.0
    assert len(body["entries"]) == 3


def test_weekly_statistics(client):
    make(client, entry_date="2026-11-02", status="done")
    make(client, entry_date="2026-11-04")
    body = client.get("/api/journal/weekly", params={"start_date": "2026-11-02"}).json()
    assert body["end_date"] == "2026-11-08"
    assert len(body["daily_activity"]) == 7
    assert body["statistics"]["completion_percentage"] == 50.0
    assert body["daily_activity"][0]["tasks"] == 1


def test_monthly_statistics(client):
    make(client, entry_date="2026-11-30", entry_type="event")
    body = client.get("/api/journal/monthly", params={"year": 2026, "month": 11}).json()
    assert len(body["daily_activity"]) == 30
    assert body["statistics"]["total_events"] == 1


def test_monthly_rejects_bad_month_and_year(client):
    assert client.get("/api/journal/monthly", params={"year": 2026, "month": 13}).status_code == 422
    assert client.get("/api/journal/monthly", params={"year": 10000, "month": 1}).status_code == 422


def test_range_journal(client):
    make(client, entry_date="2026-11-01")
    make(client, entry_date="2026-11-09")
    body = client.get(
        "/api/journal/range",
        params={"start_date": "2026-11-01", "end_date": "2026-11-07"},
    ).json()
    assert body["total_entries"] == 1


# --- explicit nulls on update ----------------------------------------------

def test_update_rejects_explicit_null_for_required_fields(client):
    task = make(client)
    for field in ("entry_date", "entry_type", "content", "status", "source"):
        response = client.put(f"/api/entries/{task['id']}", json={field: None})
        assert response.status_code == 422, field


def test_update_allows_clearing_the_optional_title(client):
    task = make(client, title="Has a title")
    response = client.put(f"/api/entries/{task['id']}", json={"title": None})
    assert response.status_code == 200
    assert response.json()["title"] is None


# --- pagination on semantic and hybrid search ------------------------------

def test_semantic_and_hybrid_support_offset(client):
    ids = {make(client, content="graph problems")["id"] for _ in range(3)}
    for path in ("/api/search/semantic", "/api/search/hybrid"):
        seen = []
        for offset in range(3):
            body = client.get(
                path, params={"q": "graph problems", "limit": 1, "offset": offset}
            ).json()
            assert body["offset"] == offset
            seen += [r["entry"]["id"] for r in body["results"]]
        assert sorted(seen) == sorted(ids), path


# --- vector index safety ----------------------------------------------------

from datetime import date
from types import SimpleNamespace

import pytest

from app.services import vector_store
from tests.conftest import fake_embed


def fake_entry(entry_id, title="t", content="c"):
    return SimpleNamespace(
        id=entry_id, title=title, content=content, entry_date=date(2026, 11, 2),
        entry_type="note", status="open", updated_at=None,
    )


def test_rebuild_swaps_in_a_new_index(client):
    make(client, content="old entry")
    vector_store.rebuild([fake_entry(10), fake_entry(11)])
    assert vector_store._collection.name == vector_store.INDEX_NAME
    assert vector_store._collection.count() == 2
    names = [getattr(c, "name", c) for c in vector_store._client.list_collections()]
    assert sorted(names) == [vector_store.INDEX_NAME]


def test_failed_rebuild_keeps_the_existing_index(client, monkeypatch):
    make(client, content="graph problems")
    before = vector_store._collection.count()

    def broken_embed(texts):
        raise RuntimeError("embedding failed halfway")

    monkeypatch.setattr(vector_store, "embed", broken_embed)
    with pytest.raises(RuntimeError):
        vector_store.rebuild([fake_entry(10)])
    monkeypatch.setattr(vector_store, "embed", fake_embed)

    assert vector_store._collection.count() == before
    names = [getattr(c, "name", c) for c in vector_store._client.list_collections()]
    assert sorted(names) == [vector_store.INDEX_NAME]
    hit = client.get("/api/search/semantic", params={"q": "graph problems"}).json()
    assert len(hit["results"]) == 1


def test_sync_finds_and_repairs_drift(client, monkeypatch):
    import app.routers.entries as entries_router

    in_sync = make(client, content="indexed normally")
    edited = make(client, content="before edit")
    with monkeypatch.context() as m:
        m.setattr(entries_router, "try_index", lambda entry: None)
        unindexed = make(client, content="never indexed")                  # missing
        client.put(f"/api/entries/{edited['id']}", json={"content": "after edit"})  # stale
    vector_store._collection.upsert(                                       # orphaned
        ids=["999"], documents=["ghost"], embeddings=fake_embed(["ghost"]),
        metadatas=[{"entry_date": "2026-11-01", "date_ord": 1, "entry_type": "note",
                    "status": "open", "updated_at": "x"}],
    )

    preview = client.post("/api/search/sync", params={"dry_run": True}).json()
    assert (preview["missing"], preview["stale"], preview["orphaned"]) == (1, 1, 1)
    assert preview["in_sync"] is False
    assert vector_store._collection.count() == 3          # dry run changed nothing

    client.post("/api/search/sync")
    after = client.post("/api/search/sync", params={"dry_run": True}).json()
    assert after["in_sync"] is True
    assert vector_store._collection.count() == 3
    found = client.get("/api/search/semantic", params={"q": "never indexed"}).json()
    assert unindexed["id"] in [r["entry"]["id"] for r in found["results"]]
    assert in_sync["id"] is not None


# --- assistant --------------------------------------------------------------

def test_assistant_chat_returns_grounded_answer_and_citations(client):
    entry = make(client, title="Python Journey", content="Started learning FastAPI and PyTorch today.", entry_type="note")
    response = client.post("/api/assistant/chat", json={"message": "What did I write about Python?"})
    assert response.status_code == 200
    data = response.json()
    assert "answer" in data
    assert len(data["answer"]) > 0
    assert any(c["entry_id"] == entry["id"] for c in data["citations"])


def test_assistant_chat_honest_when_no_records_found(client):
    response = client.post("/api/assistant/chat", json={"message": "quantum teleportation experiments"})
    assert response.status_code == 200
    data = response.json()
    assert "answer" in data
    assert "could not find" in data["answer"].lower() or len(data["citations"]) == 0


# --- multi-modal media inputs ------------------------------------------------

def test_media_document_extraction(client):
    text_content = b"# Meeting Notes\n\nDiscussed architecture and next milestones."
    response = client.post(
        "/api/media/extract-doc",
        files={"file": ("notes.md", text_content, "text/markdown")}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["source"] == "pdf"
    assert "Meeting Notes" in data["text"]
    assert data["character_count"] > 0


def test_media_ocr_fallback(client):
    fake_png = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    response = client.post(
        "/api/media/ocr",
        files={"file": ("journal_page.png", fake_png, "image/png")}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["source"] == "photo"
    assert "journal_page.png" in data["filename"]


def test_media_transcription_fallback(client):
    fake_audio = b"RIFF....WAVEfmt ...."
    response = client.post(
        "/api/media/transcribe",
        files={"file": ("memo.wav", fake_audio, "audio/wav")}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["source"] == "voice"
    assert "memo.wav" in data["filename"]


def test_create_and_search_multi_modal_entries(client):
    voice_entry = make(
        client,
        title="Voice Reflection",
        content="Recording my morning thoughts while walking in the park.",
        source="voice",
        entry_type="note"
    )
    assert voice_entry["source"] == "voice"

    photo_entry = make(
        client,
        title="Whiteboard Brainstorm",
        content="Diagramming the database schemas and relationships.",
        source="photo",
        entry_type="note"
    )
    assert photo_entry["source"] == "photo"

    # Search should immediately retrieve them
    hit = client.get("/api/search/", params={"q": "walking"}).json()
    assert any(r["id"] == voice_entry["id"] for r in hit["results"])


# --- backup & data portability ----------------------------------------------

def test_backup_export_and_stats(client):
    make(client, title="Backup Test 1", content="First entry for backup.")
    make(client, title="Backup Test 2", content="Second entry for backup.")

    stats = client.get("/api/backup/stats").json()
    assert "total_entries" in stats
    assert "database_size_kb" in stats
    assert stats["total_entries"] >= 2

    export_res = client.get("/api/backup/export")
    assert export_res.status_code == 200
    assert "attachment" in export_res.headers.get("content-disposition", "")
    data = export_res.json()
    assert "entries" in data
    assert len(data["entries"]) >= 2


def test_backup_markdown_export(client):
    res = client.get("/api/backup/markdown")
    assert res.status_code == 200
    assert "Digital Diary & Bullet Journal Archive" in res.text


def test_backup_import_merge(client):
    import json
    backup_payload = {
        "version": "1.0",
        "entries": [
            {
                "entry_date": "2026-11-09",
                "entry_type": "task",
                "title": "Imported Test Task",
                "content": "Verify backup import restores cleanly.",
                "status": "open",
                "source": "typed"
            }
        ]
    }
    file_bytes = json.dumps(backup_payload).encode("utf-8")
    res = client.post(
        "/api/backup/import?mode=merge",
        files={"file": ("test_backup.json", file_bytes, "application/json")}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["imported"] == 1

    # Verify entry exists in search
    found = client.get("/api/search/", params={"q": "Imported Test Task"}).json()
    assert len(found["results"]) >= 1


def test_extract_document_text_pdf(client):
    pdf_bytes = (
        b"%PDF-1.4\n"
        b"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n"
        b"2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n"
        b"3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n"
        b"4 0 obj << /Length 50 >> stream\n"
        b"BT /F1 20 Tf 100 700 Td (Study Discrete Mathematics) Tj ET\n"
        b"endstream\n"
        b"endobj\n"
        b"5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n"
        b"xref\n"
        b"0 6\n"
        b"0000000000 65535 f \n"
        b"0000000010 00000 n \n"
        b"0000000060 00000 n \n"
        b"0000000117 00000 n \n"
        b"0000000241 00000 n \n"
        b"0000000343 00000 n \n"
        b"trailer << /Size 6 /Root 1 0 R >>\n"
        b"startxref\n"
        b"422\n"
        b"%%EOF"
    )
    res = client.post(
        "/api/media/extract-doc",
        files={"file": ("syllabus.pdf", pdf_bytes, "application/pdf")}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["source"] == "pdf"
    assert "Study Discrete Mathematics" in data["text"]
    assert data["character_count"] > 0


def test_extract_document_text_plain(client):
    sample_text = "# Daily Agenda\n- Complete math homework\n- Review linear algebra"
    res = client.post(
        "/api/media/extract-doc",
        files={"file": ("notes.md", sample_text.encode("utf-8"), "text/markdown")}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["source"] == "pdf"
    assert "Complete math homework" in data["text"]
