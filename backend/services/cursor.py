"""Opaque history cursors.

The client only passes the cursor back; encoding the key as base64 JSON keeps it opaque,
so the key format can change without breaking the API.
"""

import base64
import binascii
import json
from datetime import datetime

from repositories.history import HistoryKey


class InvalidCursor(ValueError):
    pass


def encode_cursor(key: HistoryKey) -> str:
    created_at, search_id = key
    payload = json.dumps({"created_at": created_at.isoformat(), "id": search_id})
    return base64.urlsafe_b64encode(payload.encode()).decode().rstrip("=")


def decode_cursor(cursor: str) -> HistoryKey:
    try:
        padded = cursor + "=" * (-len(cursor) % 4)
        payload = json.loads(base64.urlsafe_b64decode(padded.encode()))
        created_at = datetime.fromisoformat(payload["created_at"])
        search_id = payload["id"]
    except (binascii.Error, UnicodeDecodeError, ValueError, KeyError, TypeError) as exc:
        raise InvalidCursor(cursor) from exc
    # A naive datetime would fail to compare with timestamptz; an int id is required.
    if created_at.tzinfo is None or not isinstance(search_id, int) or isinstance(search_id, bool):
        raise InvalidCursor(cursor)
    return created_at, search_id
