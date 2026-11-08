"""Text embeddings for semantic search.

Search depends on the `Embedder` protocol, not on fastembed, so tests use a fake and the
app can fall back to keyword-only search when the model cannot load.
"""

import logging
import re
from typing import Literal, Protocol, Sequence

from config import EMBEDDING_MODEL, EMBEDDINGS_ENABLED

logger = logging.getLogger(__name__)

EmbedderName = Literal["minilm", "keyword-only"]


class Embedder(Protocol):
    name: EmbedderName

    def embed_query(self, text: str) -> list[float] | None:
        """Vector for a user query, or None when semantic search is unavailable."""
        ...

    def embed_documents(self, texts: Sequence[str]) -> list[list[float]]:
        """Vectors for stored documents (same order as `texts`)."""
        ...

    def knows_any_word(self, text: str) -> bool:
        """False when the model has none of the query's words in its vocabulary
        (gibberish like "zzqx"); its vector then carries no meaning to compare."""
        ...


class FastEmbedEmbedder:
    """all-MiniLM-L6-v2 through fastembed: a 384-dim ONNX model (~90 MB), CPU only, no torch."""

    name: EmbedderName = "minilm"

    def __init__(self, model_name: str = EMBEDDING_MODEL) -> None:
        # Imported here so tests and keyword-only mode never pay for onnxruntime.
        from fastembed import TextEmbedding

        self._model = TextEmbedding(model_name)

    def embed_query(self, text: str) -> list[float] | None:
        # query_embed vs passage_embed lets fastembed apply a model's query/document
        # prefixes. MiniLM is symmetric (no prefixes), but the call stays correct if the
        # model is swapped for an asymmetric one.
        vector = next(iter(self._model.query_embed(text)))
        return vector.tolist()

    def embed_documents(self, texts: Sequence[str]) -> list[list[float]]:
        return [vector.tolist() for vector in self._model.passage_embed(list(texts))]

    def knows_any_word(self, text: str) -> bool:
        # A word the model knows is one vocabulary token ("planet"); an unknown one is
        # split into pieces ("zzqx" -> z ##z ##q ##x). Rare real words split too
        # ("manatee"), but those still match by keyword when the archive has them.
        tokenizer = self._model.model.tokenizer
        return any(
            len(tokenizer.encode(word, add_special_tokens=False).tokens) == 1
            for word in re.findall(r"[A-Za-z]+", text)
        )


class NullEmbedder:
    """Keyword-only mode: the app keeps working when the model is missing."""

    name: EmbedderName = "keyword-only"

    def embed_query(self, text: str) -> list[float] | None:
        return None

    def embed_documents(self, texts: Sequence[str]) -> list[list[float]]:
        return []

    def knows_any_word(self, text: str) -> bool:
        return True  # unused: without a vector there are no meaning-only results


def load_embedder() -> Embedder:
    """Load the model once at startup; any failure degrades to keyword-only, never a crash."""
    if not EMBEDDINGS_ENABLED:
        logger.warning("Embeddings disabled by EMBEDDINGS_ENABLED=0; search is keyword-only")
        return NullEmbedder()
    try:
        return FastEmbedEmbedder()
    except Exception:
        logger.exception("Could not load %s; search falls back to keyword-only", EMBEDDING_MODEL)
        return NullEmbedder()


def document_text(title: str, keywords: Sequence[str], description: str) -> str:
    """The text we embed for one image.

    Keywords carry the topic for images with one-line captions: "Lycus Sulci" is only
    recognisably Mars because of its "Mars" keyword.
    """
    return "\n".join(part for part in (title, ", ".join(keywords), description) if part)
