import hashlib
import math
import re

import chromadb
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.connection import Base, get_db
from app.main import app
from app.services import vector_store

# Tiny stand-in for the sentence-transformer so tests need no model download.
# Similar words share a bucket, which is enough to test the search plumbing.
SYNONYMS = {
    "study": "learn", "revise": "learn", "revised": "learn",
    "preparation": "learn", "prep": "learn", "exam": "test",
}


def fake_embed(texts):
    vectors = []
    for text in texts:
        v = [0.0] * 384
        for word in re.findall(r"[^\W_]+", text.lower()):
            word = SYNONYMS.get(word, word)
            v[int(hashlib.md5(word.encode()).hexdigest(), 16) % 384] += 1
        norm = math.sqrt(sum(x * x for x in v)) or 1.0
        vectors.append([x / norm for x in v])
    return vectors


@pytest.fixture
def client(monkeypatch):
    """API client on an in-memory SQLite DB and a throwaway Chroma index."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    TestSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    def override_get_db():
        db = TestSession()
        try:
            yield db
        finally:
            db.close()

    # Ephemeral Chroma shares state inside one process, so start each test clean.
    ephemeral = chromadb.EphemeralClient()
    for existing in ephemeral.list_collections():
        ephemeral.delete_collection(getattr(existing, "name", existing))
    collection = ephemeral.create_collection(
        vector_store.INDEX_NAME,
        configuration={"hnsw": {"space": "cosine"}},
    )
    monkeypatch.setattr(vector_store, "_client", ephemeral)
    monkeypatch.setattr(vector_store, "_collection", collection)
    monkeypatch.setattr(vector_store, "embed", fake_embed)
    app.dependency_overrides[get_db] = override_get_db

    yield TestClient(app)

    app.dependency_overrides.clear()
