// TypeScript mirrors of the backend's Pydantic schemas (backend/models.py).
// Field names stay snake_case, exactly as the JSON arrives, so there is no
// mapping layer to keep in sync.

export type Body = "earth" | "orbit" | "moon" | "mars" | "deep_space";

/** How we know where an image was taken. Shown to the user as-is, so the place is honest. */
export type Provenance = "caption" | "location field" | "NASA center (approx.)" | "manual";

export interface Place {
  body: Body;
  lat: number | null;
  lon: number | null;
  label: string;
  provenance: Provenance;
}

export interface Source {
  id: number;
  nasa_id: string;
  title: string;
  description: string;
  date_created: string; // ISO 8601
  center: string;
  keywords: string[];
  photographer: string | null;
  location: string | null;
  image_url: string;
  thumb_url: string;
  place: Place | null;
}

export interface SourcePage {
  items: Source[];
  total: number;
}

export interface FacetValue<T extends string = string> {
  value: T;
  count: number;
}

export interface Facets {
  centers: FacetValue[];
  bodies: FacetValue<Body>[];
}

/** One search result. All scores are 0–1. */
export interface SearchHit {
  source: Source;
  confidence: number;
  keyword_score: number;
  semantic_score: number;
  rank: number;
}

/** "keyword" means the embedding model did not load and the backend fell back to full-text only. */
export type SearchEngine = "hybrid" | "keyword";

export interface SearchDetail {
  id: number;
  query: string;
  created_at: string;
  engine: SearchEngine;
  result_count: number;
  results: SearchHit[];
}

export interface SearchSummary {
  id: number;
  query: string;
  created_at: string;
  result_count: number;
  preview_thumbs: string[];
}

/** Keyset page: pass next_cursor back to get the next page; null means the end. */
export interface CursorPage<T> {
  items: T[];
  next_cursor: string | null;
}

/** A light row for the 3D scene: one pin per image. */
export interface PlaceRow {
  source_id: number;
  nasa_id: string;
  title: string;
  thumb_url: string;
  date_created: string;
  body: Body;
  lat: number | null;
  lon: number | null;
  label: string;
  provenance: Provenance;
}

export interface Health {
  status: string;
  db: string;
  embedder: "bge-small" | "keyword-only";
}
