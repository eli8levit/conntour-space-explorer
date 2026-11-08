import type {
  Body,
  CursorPage,
  Facets,
  Health,
  PlaceRow,
  SearchDetail,
  SearchHit,
  SearchSummary,
  Source,
  SourcePage,
} from "./types";

/** A non-2xx response. `status` lets callers tell "not found" (404) from "invalid input" (422). */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * A message for the user. ApiError carries the server's message; anything
 * else means fetch itself failed (network down, backend not running).
 */
export function describeError(error: unknown): string {
  return error instanceof ApiError ? error.message : "Could not reach the server.";
}

// FastAPI errors look like {detail: "text"} or, for validation (422),
// {detail: [{msg: "text", ...}]}. Turn either into one readable line.
function errorMessage(status: number, body: unknown): string {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && typeof detail[0]?.msg === "string") return detail[0].msg;
  return `Request failed (${status})`;
}

/** The single place that calls fetch. Every endpoint below goes through it. */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    // Only requests with a body send JSON; GETs need no Content-Type.
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
  });

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    throw new ApiError(response.status, errorMessage(response.status, body));
  }
  // 204 No Content (DELETE) has no body to parse.
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** Builds "?a=1&b=2", leaving out empty values so filters are optional. */
function queryString(params: Record<string, string | number | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

export interface SourceFilters {
  center?: string;
  body?: Body;
}

export const api = {
  listSources: (filters: SourceFilters, limit: number, offset: number) =>
    request<SourcePage>(`/sources${queryString({ ...filters, limit, offset })}`),

  getSource: (id: number) => request<Source>(`/sources/${id}`),

  getSimilar: (id: number, limit = 6) =>
    request<SearchHit[]>(`/sources/${id}/similar${queryString({ limit })}`),

  getFacets: () => request<Facets>("/sources/facets"),

  runSearch: (query: string) =>
    request<SearchDetail>("/searches", { method: "POST", body: JSON.stringify({ query }) }),

  getSearch: (id: number) => request<SearchDetail>(`/searches/${id}`),

  listSearches: (cursor: string | null, limit = 20) =>
    request<CursorPage<SearchSummary>>(`/searches${queryString({ limit, cursor })}`),

  deleteSearch: (id: number) => request<void>(`/searches/${id}`, { method: "DELETE" }),

  /**
   * The same DELETE, fired while the page closes (an undo was still pending).
   * `keepalive` lets the request finish after the tab is gone; nobody reads the answer.
   */
  deleteSearchOnUnload: (id: number) => {
    void fetch(`/api/searches/${id}`, { method: "DELETE", keepalive: true }).catch(() => undefined);
  },

  listPlaces: () => request<PlaceRow[]>("/places"),

  health: () => request<Health>("/health"),
};
