from functools import lru_cache

MODEL_NAME = "all-MiniLM-L6-v2"


@lru_cache(maxsize=1)
def get_model():
    """Load the model once; the first call takes a few seconds."""
    # Imported here so the API starts fast and only pays for torch on first use.
    from sentence_transformers import SentenceTransformer

    # Explicit CPU: matches the CPU-only PyTorch decision and stays
    # predictable even if a CUDA build of torch is installed later.
    return SentenceTransformer(MODEL_NAME, device="cpu")


def embed(texts: list[str]) -> list[list[float]]:
    """Return L2-normalised 384-dim vectors, one per input text."""
    vectors = get_model().encode(texts, normalize_embeddings=True)
    return vectors.tolist()
