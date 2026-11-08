"""API tests through the real app and a real Postgres (see conftest.py)."""

import pytest

from services.embedding import NullEmbedder


async def test_health(client):
    response = await client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "db": True, "embedder": "minilm"}


async def test_sources_page_is_newest_first_with_total(client):
    body = (await client.get("/api/sources", params={"limit": 5})).json()
    assert body["total"] == 100
    dates = [item["date_created"] for item in body["items"]]
    assert len(dates) == 5 and dates == sorted(dates, reverse=True)

    second = (await client.get("/api/sources", params={"limit": 5, "offset": 5})).json()
    assert not {i["id"] for i in body["items"]} & {i["id"] for i in second["items"]}


async def test_sources_filters_match_facets(client):
    facets = (await client.get("/api/sources/facets")).json()
    mars = next(f for f in facets["bodies"] if f["value"] == "mars")
    jsc = next(f for f in facets["centers"] if f["value"] == "JSC")

    by_body = (await client.get("/api/sources", params={"body": "mars", "limit": 100})).json()
    assert by_body["total"] == mars["count"] == len(by_body["items"])
    assert all(item["place"]["body"] == "mars" for item in by_body["items"])

    by_center = (await client.get("/api/sources", params={"center": "JSC"})).json()
    assert by_center["total"] == jsc["count"]

    assert (await client.get("/api/sources", params={"body": "venus"})).status_code == 422


async def test_source_detail_and_404(client):
    first = (await client.get("/api/sources", params={"limit": 1})).json()["items"][0]
    detail = (await client.get(f"/api/sources/{first['id']}")).json()
    assert detail == first
    assert set(detail["place"]) == {"body", "lat", "lon", "label", "provenance"}
    # Gale Crater's ~medium rendition is listed as 660 x 1280 in the NASA record.
    gale = (await client.get("/api/sources", params={"body": "mars", "limit": 100})).json()
    gale = next(item for item in gale["items"] if item["nasa_id"] == "PIA22505")
    assert (gale["width"], gale["height"]) == (660, 1280)
    assert (await client.get("/api/sources/999999")).status_code == 404


async def test_similar_excludes_itself(client):
    response = await client.get("/api/sources/1/similar", params={"limit": 4})
    hits = response.json()
    assert response.status_code == 200 and len(hits) == 4
    assert all(hit["source"]["id"] != 1 for hit in hits)
    assert [hit["rank"] for hit in hits] == [1, 2, 3, 4]
    assert (await client.get("/api/sources/999999/similar")).status_code == 404


async def test_places_has_every_image(client):
    places = (await client.get("/api/places")).json()
    assert len(places) == 100
    assert "description" not in places[0]


@pytest.mark.parametrize("query", ["", "   ", "x" * 201])
async def test_search_rejects_bad_queries(client, query):
    assert (await client.post("/api/searches", json={"query": query})).status_code == 422


async def test_search_ranks_exact_mission_id_first(client):
    response = await client.post("/api/searches", json={"query": "  STS-135  "})
    assert response.status_code == 201
    search = response.json()
    assert search["query"] == "STS-135"  # stripped
    assert search["engine"] == "hybrid"
    assert search["result_count"] == len(search["results"]) > 0
    top = search["results"][0]
    assert "STS-135" in top["source"]["title"] + top["source"]["description"]
    confidences = [hit["confidence"] for hit in search["results"]]
    assert confidences == sorted(confidences, reverse=True)
    assert all(
        0 <= hit["keyword_score"] <= 1 and 0 <= hit["semantic_score"] <= 1
        for hit in search["results"]
    )


async def test_reopened_search_is_the_stored_snapshot(client):
    created = (await client.post("/api/searches", json={"query": "Mars"})).json()
    reopened = await client.get(f"/api/searches/{created['id']}")
    assert reopened.status_code == 200
    assert reopened.json() == created
    assert (await client.get("/api/searches/999999")).status_code == 404


async def test_history_keyset_pagination_and_delete(client):
    ids = []
    for i in range(25):
        ids.append((await client.post("/api/searches", json={"query": f"rocket {i}"})).json()["id"])

    seen, cursor = [], None
    while True:
        params = {"limit": 10, **({"cursor": cursor} if cursor else {})}
        page = (await client.get("/api/searches", params=params)).json()
        seen += [item["id"] for item in page["items"]]
        assert page["total"] == 25
        assert all(len(item["previews"]) <= 3 for item in page["items"])
        cursor = page["next_cursor"]
        if cursor is None:
            break
    assert seen == list(reversed(ids))  # newest first, nothing skipped or repeated

    first_page = (await client.get("/api/searches", params={"limit": 10})).json()
    victim = first_page["items"][3]["id"]
    assert (await client.delete(f"/api/searches/{victim}")).status_code == 204
    assert (await client.delete(f"/api/searches/{victim}")).status_code == 404
    assert (await client.get(f"/api/searches/{victim}")).status_code == 404
    assert (await client.get("/api/searches")).json()["total"] == 24

    # The cursor from before the delete still continues exactly where it left off.
    next_page = (
        await client.get("/api/searches", params={"limit": 10, "cursor": first_page["next_cursor"]})
    ).json()
    assert [item["id"] for item in next_page["items"]] == list(reversed(ids))[10:20]


async def test_history_summary_matches_the_snapshot(client):
    from config import STRONG_MATCH

    search = (await client.post("/api/searches", json={"query": "STS-135 crew"})).json()
    empty = (await client.post("/api/searches", json={"query": "qwxzv"})).json()  # no match
    page = (await client.get("/api/searches")).json()
    summary = next(item for item in page["items"] if item["id"] == search["id"])
    confidences = [hit["confidence"] for hit in search["results"]]

    assert summary["result_count"] == len(confidences)
    assert summary["strong_count"] == sum(c >= STRONG_MATCH for c in confidences)
    assert summary["best_confidence"] == pytest.approx(max(confidences))
    assert summary["previews"] == [
        {"thumb_url": hit["source"]["thumb_url"], "confidence": hit["confidence"]}
        for hit in search["results"][:3]
    ]
    assert summary["preview_thumbs"] == [p["thumb_url"] for p in summary["previews"]]

    no_results = next(item for item in page["items"] if item["id"] == empty["id"])
    assert no_results["result_count"] == 0
    assert (no_results["strong_count"], no_results["best_confidence"]) == (0, None)
    assert no_results["previews"] == []


async def test_history_rejects_bad_cursor(client):
    response = await client.get("/api/searches", params={"cursor": "garbage"})
    assert response.status_code == 400


@pytest.fixture
def keyword_only(client):
    from app import app
    from controllers.dependencies import get_embedder

    app.dependency_overrides[get_embedder] = NullEmbedder
    return client


async def test_keyword_only_fallback(keyword_only):
    health = (await keyword_only.get("/api/health")).json()
    assert health == {"status": "degraded", "db": True, "embedder": "keyword-only"}

    search = (await keyword_only.post("/api/searches", json={"query": "Saturn"})).json()
    assert search["engine"] == "keyword"
    assert search["results"], "keyword search alone still finds Saturn"
    assert all(hit["semantic_score"] == 0 for hit in search["results"])
