/**
 * Reads a database id from the URL ("/search/12", "?image=7").
 * Returns null for anything that is not a positive whole number, so a bad
 * link shows "not found" instead of sending "NaN" to the API.
 */
export function parseId(raw: string | null | undefined): number | null {
  if (!raw || !/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return id > 0 && Number.isSafeInteger(id) ? id : null;
}
