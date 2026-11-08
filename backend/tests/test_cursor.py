import base64
from datetime import datetime, timezone

import pytest

from services.cursor import InvalidCursor, decode_cursor, encode_cursor


def test_round_trip_keeps_microseconds_and_timezone():
    key = (datetime(2026, 11, 9, 12, 30, 1, 123456, tzinfo=timezone.utc), 42)
    assert decode_cursor(encode_cursor(key)) == key


def _b64(raw: str) -> str:
    return base64.urlsafe_b64encode(raw.encode()).decode()


@pytest.mark.parametrize(
    "cursor",
    [
        "not-base64!!",
        _b64("not json"),
        _b64("[1, 2]"),
        _b64('{"created_at": "2026-11-09T12:00:00+00:00"}'),
        _b64('{"created_at": "yesterday", "id": 1}'),
        _b64('{"created_at": "2026-11-09T12:00:00", "id": 1}'),  # naive datetime
        _b64('{"created_at": "2026-11-09T12:00:00+00:00", "id": "1"}'),
    ],
)
def test_bad_cursors_are_rejected(cursor):
    with pytest.raises(InvalidCursor):
        decode_cursor(cursor)
