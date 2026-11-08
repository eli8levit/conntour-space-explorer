from abc import ABC, abstractmethod
from typing import Generic, List, TypeVar

T = TypeVar("T")


class Repository(ABC, Generic[T]):
    """
    Abstract generic repository interface.

    Defines the contract for data access operations without
    coupling to any specific data source or entity type.
    Repositories return Pydantic domain models, never ORM rows, so nothing
    above this layer depends on SQLAlchemy.
    """

    @abstractmethod
    async def get_all(self) -> List[T]:
        """Retrieve all entities."""

    @abstractmethod
    async def get_by_id(self, entity_id: int) -> T | None:
        """Retrieve one entity, or None when it does not exist."""
