/**
 * Opaque keyset cursors for reverse/forward-chronological lists.
 *
 * A cursor encodes the ordering key of the last row on a page — `(created_at, id)`
 * — so the next page can use a lexicographic `(created_at, id)` predicate instead
 * of a bare `created_at` comparison. The `id` tiebreaker is what makes boundary
 * rows that share a timestamp reachable rather than silently skipped or repeated.
 *
 * The token is base64url of `created_at|id`. It is treated as opaque by callers
 * and by the client — only this module encodes/decodes it.
 */

export type CursorKey = { created_at: string; id: string };

export function encodeCursor(created_at: string, id: string): string {
  return Buffer.from(`${created_at}|${id}`, "utf8").toString("base64url");
}

export function decodeCursor(
  cursor?: string | null
): CursorKey | null {
  if (!cursor) return null;
  try {
    const raw = Buffer.from(cursor, "base64url").toString("utf8");
    const sep = raw.indexOf("|");
    if (sep === -1) return null;
    const created_at = raw.slice(0, sep);
    const id = raw.slice(sep + 1);
    if (!created_at || !id) return null;
    return { created_at, id };
  } catch {
    return null;
  }
}

/**
 * PostgREST `.or()` filter string for a keyset page after `cursor`.
 * `desc` → `(created_at, id) < cursor`; `asc` → `(created_at, id) > cursor`.
 * Pair with `.order("created_at", { ascending }).order("id", { ascending })`.
 */
export function keysetFilter(
  cursor: CursorKey,
  direction: "asc" | "desc"
): string {
  const op = direction === "desc" ? "lt" : "gt";
  const { created_at, id } = cursor;
  return `created_at.${op}.${created_at},and(created_at.eq.${created_at},id.${op}.${id})`;
}

/**
 * Given `limit + 1` rows fetched in order, return the visible page (`limit` rows)
 * and the cursor for the following page. Fetching one extra row is how we know
 * whether more exist without a second count query.
 */
export function pageFromRows<Row>(
  rows: Row[],
  limit: number,
  key: (row: Row) => CursorKey
): { pageRows: Row[]; nextCursor: string | null } {
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const last = pageRows[pageRows.length - 1];
  const nextCursor =
    hasMore && last ? encodeCursor(key(last).created_at, key(last).id) : null;
  return { pageRows, nextCursor };
}
