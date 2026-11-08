import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from controllers import health_router, places_router, searches_router, source_router
from db import engine, init_schema
from services.embedding import load_embedder

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: make sure the schema exists, then load the model once for all requests."""
    await init_schema(engine)
    app.state.embedder = load_embedder()
    logging.getLogger(__name__).info("Search engine: %s", app.state.embedder.name)
    yield
    await engine.dispose()


app = FastAPI(
    title="Space Explorer API",
    description="API for browsing and searching NASA images",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(source_router)
app.include_router(searches_router)
app.include_router(places_router)
app.include_router(health_router)
