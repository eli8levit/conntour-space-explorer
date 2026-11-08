from fastapi import Request

from services.embedding import Embedder


def get_embedder(request: Request) -> Embedder:
    """The model loaded once in the app lifespan (tests override this with a fake)."""
    return request.app.state.embedder
