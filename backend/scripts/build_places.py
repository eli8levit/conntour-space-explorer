#!/usr/bin/env python
"""
One-off: draft a place for every image from simple rules.

Usage: python scripts/build_places.py > data/places.draft.json

The output is only a draft. data/places.json is this draft after a manual review of all
100 entries against their captions (the rules cannot know, e.g., that a satellite photo
of a storm belongs over New England, not at the Goddard building that published it).
"""

import json
import re
import sys
from pathlib import Path
from typing import Any

DATA = Path(__file__).resolve().parent.parent / "data" / "mock_data.json"

# Named coordinates (lat, lon), WGS84. Rounded: a pin needs ~100 m, not survey accuracy.
SITES: dict[str, tuple[float, float]] = {
    "Kennedy Space Center": (28.5729, -80.6490),
    "KSC Industrial Area": (28.5244, -80.6508),
    "Vehicle Assembly Building": (28.5862, -80.6509),
    "Orbiter Processing Facility": (28.5866, -80.6626),
    "Launch Pad 39A": (28.6084, -80.6043),
    "Launch Pad 39B": (28.6272, -80.6208),
    "Shuttle Landing Facility": (28.6150, -80.6945),
    "LC-39 Turn Basin": (28.5822, -80.6467),
    "LC-39 Press Site": (28.5797, -80.6440),
    "Operations and Checkout Building": (28.5225, -80.6466),
    "Space Station Processing Facility": (28.5251, -80.6447),
    "NASA Causeway": (28.5150, -80.6270),
    "Astronaut Hall of Fame, Titusville": (28.5247, -80.7850),
    "Astrotech, Titusville": (28.5160, -80.8090),
    "Space Launch Complex 37": (28.5319, -80.5660),
    "Vandenberg AFB": (34.7420, -120.5724),
    "Johnson Space Center": (29.5593, -95.0900),
    "Neutral Buoyancy Laboratory": (29.6094, -95.1360),
    "NASA Headquarters": (38.8830, -77.0163),
    "Rayburn House Office Building": (38.8867, -77.0109),
    "Udvar-Hazy Center": (38.9111, -77.4441),
    "Jet Propulsion Laboratory": (34.2013, -118.1714),
    "Marshall Space Flight Center": (34.6466, -86.6745),
    "Ames Research Center": (37.4089, -122.0644),
    "Glenn Research Center": (41.4131, -81.8615),
    "Goddard Space Flight Center": (38.9917, -76.8527),
    "Michoud Assembly Facility": (30.0286, -89.9176),
    "Langley Research Center": (37.0855, -76.3804),
    "Space Telescope Science Institute": (39.3328, -76.6233),
    "Mansfield Lahm Airport": (40.8214, -82.5166),
    "Baikonur Cosmodrome": (45.9650, 63.3050),
    "Baikonur (town)": (45.6230, 63.3140),
    "Star City": (55.8780, 38.1080),
    "Zhezkazgan": (47.7833, 67.7667),
}

# The 10 NASA centers in the data. Used only when nothing else names a place.
CENTERS = {
    "KSC": "Kennedy Space Center",
    "JSC": "Johnson Space Center",
    "HQ": "NASA Headquarters",
    "JPL": "Jet Propulsion Laboratory",
    "MSFC": "Marshall Space Flight Center",
    "ARC": "Ames Research Center",
    "GRC": "Glenn Research Center",
    "GSFC": "Goddard Space Flight Center",
    "MAF": "Michoud Assembly Facility",
    "LRC": "Langley Research Center",
}

# Every distinct `location` string in the data, mapped to a site.
LOCATION_FIELD = {
    "Kennedy Space Center, FL": "Kennedy Space Center",
    "Kennedy Space Center": "Kennedy Space Center",
    "Cape Canaveral, FL": "Space Launch Complex 37",
    "VAB": "Vehicle Assembly Building",
    "O&C": "Operations and Checkout Building",
    "SSPF": "Space Station Processing Facility",
    "KSCTV Auditorium": "KSC Industrial Area",
    "KLI": "KSC Industrial Area",
    "KSC - AHOF": "Astronaut Hall of Fame, Titusville",
    "NASA Causeway Bridge, Kennedy Sp, FL": "NASA Causeway",
    "Astrotech Space Operations": "Astrotech, Titusville",
    "Vandenberg AFB, CA": "Vandenberg AFB",
    "NASA Michoud Assembly Facility": "Michoud Assembly Facility",
    "NASA Headquarters": "NASA Headquarters",
    "Rayburn House Office Building": "Rayburn House Office Building",
    "Steven F. Udvar-Hazy Center": "Udvar-Hazy Center",
    "STScI": "Space Telescope Science Institute",
    "Greenbelt, MD": "Goddard Space Flight Center",
    "Jet Propulsion Laboratory (JPL)": "Jet Propulsion Laboratory",
    "NASA Glenn Research Center": "Glenn Research Center",
    "NASA Langley Research Center": "Langley Research Center",
    "Bldg. 4493, Room 111": "Marshall Space Flight Center",
    "Mansfield Lahm Airport": "Mansfield Lahm Airport",
    "Star City, Russia": "Star City",
    "Baikonur Cosmodrome": "Baikonur Cosmodrome",
    "Baikonur Hotel": "Baikonur (town)",
    "Zhezkazgan, Karagandy Region, Kazakhstan": "Zhezkazgan",
}

# Caption phrases that name a specific site; checked before the location field because
# "Kennedy Space Center, FL" is less precise than "Launch Pad 39B" in the caption.
CAPTION_SITES = [
    ("pad 39a", "Launch Pad 39A"),
    ("pad 39b", "Launch Pad 39B"),
    ("shuttle landing facility", "Shuttle Landing Facility"),
    ("orbiter processing facility", "Orbiter Processing Facility"),
    ("turn basin", "LC-39 Turn Basin"),
    ("press site", "LC-39 Press Site"),
    ("operations and checkout", "Operations and Checkout Building"),
    ("space launch complex 37", "Space Launch Complex 37"),
    ("nasa causeway", "NASA Causeway"),
    ("neutral buoyancy laboratory", "Neutral Buoyancy Laboratory"),
    ("nbl", "Neutral Buoyancy Laboratory"),
]

# Caption phrases that only name a center or a town; checked after the location field.
CAPTION_GENERIC = [
    ("baikonur", "Baikonur Cosmodrome"),
    ("star city", "Star City"),
    ("johnson space center", "Johnson Space Center"),
    ("manned spacecraft center", "Johnson Space Center"),
    ("kennedy space center", "Kennedy Space Center"),
    ("nasa headquarters", "NASA Headquarters"),
    ("moffett field", "Ames Research Center"),
]

MARS_COORDS = re.compile(r"Latitude:\s*(-?[\d.]+)\s+Longitude:\s*(-?[\d.]+)")
# Shuttle onboard cameras: S131-E-..., STS064-311-031. "-S-" ids are ground photos.
SHUTTLE_ONBOARD_ID = re.compile(r"^(s\d{2,3}e|sts\d{2,3}-\d)", re.IGNORECASE)
ORBITER = re.compile(r"(?:space shuttle|orbiter) (Discovery|Atlantis|Endeavour|Columbia)", re.I)
DEEP_SPACE_TARGETS = ("Saturn", "Vesta", "Wide-field Infrared Survey Explorer")


def place(body: str, lat: float | None, lon: float | None, label: str, provenance: str):
    return {"body": body, "lat": lat, "lon": lon, "label": label, "provenance": provenance}


def site(name: str, provenance: str) -> dict[str, Any]:
    lat, lon = SITES[name]
    return place("earth", lat, lon, name, provenance)


def east_to_signed(lon: float) -> float:
    """Mars captions use 0..360 east longitude; the scene uses -180..180 like Earth."""
    return round(lon - 360 if lon > 180 else lon, 4)


def draft(item: dict[str, Any]) -> dict[str, Any]:
    data = item["data"][0]
    nasa_id = data["nasa_id"].strip()
    caption = data.get("description", "")
    keywords = data.get("keywords") or []
    lowered = (data.get("title", "") + " " + caption).lower()

    if "Mars" in keywords and data["center"] == "JPL":
        match = MARS_COORDS.search(caption)
        if match:
            lat, lon = float(match.group(1)), east_to_signed(float(match.group(2)))
            return place("mars", lat, lon, data["title"], "caption")
        return place("mars", None, None, data["title"], "manual")

    for target in DEEP_SPACE_TARGETS:
        if data["center"] == "JPL" and any(target in keyword for keyword in keywords):
            return place("deep_space", None, None, target, "caption")

    if nasa_id.lower().startswith("iss"):
        return place("orbit", None, None, "ISS", "caption")
    if SHUTTLE_ONBOARD_ID.match(nasa_id):
        orbiter = ORBITER.search(caption)
        label = f"Space Shuttle {orbiter.group(1).title()}" if orbiter else "ISS"
        return place("orbit", None, None, label, "caption")

    for phrase, name in CAPTION_SITES:
        if re.search(rf"\b{re.escape(phrase)}\b", lowered):
            return site(name, "caption")
    location = (data.get("location") or "").strip()
    if location in LOCATION_FIELD:
        return site(LOCATION_FIELD[location], "location field")
    for phrase, name in CAPTION_GENERIC:
        if phrase in lowered:
            return site(name, "caption")
    return site(CENTERS[data["center"]], "NASA center (approx.)")


def main() -> None:
    with open(DATA) as f:
        items = json.load(f)["collection"]["items"]
    places = [{"nasa_id": item["data"][0]["nasa_id"].strip(), **draft(item)} for item in items]
    json.dump(places, sys.stdout, indent=2, ensure_ascii=False)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
