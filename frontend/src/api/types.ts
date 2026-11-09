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
  /** The NASA title as recorded: sometimes an ID ("KSC-98pc637") or a whole caption. */
  title: string;
  /** Hand-written display title (backend/data/titles.json), at most 34 characters. */
  short_title: string | null;
  description: string;
  date_created: string; // ISO 8601
  center: string;
  keywords: string[];
  photographer: string | null;
  /** Who to credit: the photographer, else NASA's secondary_creator. */
  credit: string | null;
  location: string | null;
  image_url: string;
  /** Pixel size of the medium rendition (image_url); null for 2 of the 100 images. */
  width: number | null;
  height: number | null;
  thumb_url: string;
  place: Place | null;
}

export interface SourcePage {
  items: Source[];
  total: number;
}

/**
 * What the backend's ID rule did to a result (backend/services/scoring.py, rule 2):
 * "raised" an exact ID match to 50%, or "halved" a result without the ID. null means
 * the confidence is the plain meaning/words blend.
 */
export type IdRule = "raised" | "halved";

/** One search result. All scores are 0–1. */
export interface SearchHit {
  source: Source;
  confidence: number;
  keyword_score: number;
  semantic_score: number;
  rank: number;
  id_rule: IdRule | null;
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

/** One of the top-3 thumbnails on a history row, with its confidence for the little bar. */
export interface SearchPreview {
  thumb_url: string;
  confidence: number;
}

/**
 * One history row. strong_count, best_confidence and previews let the row say
 * "13 images, 5 strong, best 100%" without loading the whole search.
 */
export interface SearchSummary {
  id: number;
  query: string;
  created_at: string;
  result_count: number;
  /** Results with confidence >= STRONG_MATCH. */
  strong_count: number;
  /** null when the search returned nothing. */
  best_confidence: number | null;
  /** Top 3 by rank. */
  previews: SearchPreview[];
  /** How it was scored: "keyword" = matching words only. */
  engine: SearchEngine;
}

/** Keyset page: pass next_cursor back to get the next page; null means the end. */
export interface CursorPage<T> {
  items: T[];
  next_cursor: string | null;
  /** Total rows across all pages (the history list sends it). */
  total?: number;
}

/** A light row for the 3D scene: one pin per image. */
export interface PlaceRow {
  source_id: number;
  nasa_id: string;
  title: string;
  short_title: string | null;
  thumb_url: string;
  date_created: string;
  body: Body;
  lat: number | null;
  lon: number | null;
  label: string;
  provenance: Provenance;
}
