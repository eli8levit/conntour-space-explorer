from .health import router as health_router
from .places import router as places_router
from .searches import router as searches_router
from .source import router as source_router

__all__ = ["health_router", "places_router", "searches_router", "source_router"]
