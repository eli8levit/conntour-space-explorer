"""data/places.json is hand-reviewed; these checks keep it complete and well-formed."""

import json
from pathlib import Path

from scripts.build_places import east_to_signed

DATA = Path(__file__).resolve().parent.parent / "data"
BODIES = {"earth", "orbit", "moon", "mars", "deep_space"}
PROVENANCES = {"caption", "location field", "NASA center (approx.)", "manual"}


def load():
    items = json.loads((DATA / "mock_data.json").read_text())["collection"]["items"]
    places = json.loads((DATA / "places.json").read_text())
    return [item["data"][0]["nasa_id"].strip() for item in items], places


def test_every_source_has_exactly_one_place():
    nasa_ids, places = load()
    place_ids = [place["nasa_id"] for place in places]
    assert sorted(place_ids) == sorted(nasa_ids)
    assert len(set(place_ids)) == len(place_ids)


def test_every_place_is_valid():
    _, places = load()
    for place in places:
        assert place["body"] in BODIES, place
        assert place["provenance"] in PROVENANCES, place
        assert place["label"].strip(), place
        if place["body"] in ("orbit", "deep_space"):
            # No meaningful surface coordinates in orbit or for far targets.
            assert place["lat"] is None and place["lon"] is None, place
        else:
            assert -90 <= place["lat"] <= 90, place
            assert -180 <= place["lon"] <= 180, place


def test_known_tricky_cases():
    _, places = load()
    by_id = {place["nasa_id"]: place for place in places}
    # Taken at JSC in a training mock-up, not in orbit.
    assert by_id["jsc2011e050068"]["body"] == "earth"
    # A photo of Mars taken from Mars orbit belongs on Mars, at the caption's coordinates.
    assert by_id["PIA22505"] == {
        "nasa_id": "PIA22505",
        "body": "mars",
        "lat": -5.20235,
        "lon": 138.126,
        "label": "Gale Crater",
        "provenance": "caption",
    }
    # A satellite photo of Earth goes where the photo shows, not where it was published.
    assert by_id["GSFC_20171208_Archive_e001170"]["label"] == "Off the New England coast"
    assert by_id["iss063e020483"]["body"] == "orbit"


def test_east_longitude_is_converted_to_signed():
    assert east_to_signed(138.126) == 138.126
    assert east_to_signed(354.47) == -5.53
