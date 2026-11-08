from typing import Annotated

from fastapi import Path, Request

from services.embedding import Embedder

# A database id in a URL path. The id columns are Postgres `integer` (int32), and asyncpg
# raises an overflow error (a 500) for a larger value before the query runs. The bound
# turns "/api/searches/9999999999" into a 422 instead. Ids start at 1.
DbId = Annotated[int, Path(ge=1, le=2_147_483_647)]


def get_embedder(request: Request) -> Embedder:
    """The model loaded once in the app lifespan (tests override this with a fake)."""
    return request.app.state.embedder
