/**
 * Escapes user-supplied text before it is embedded in PostgREST filter grammar
 * (`.or()`, `.cs.`, ...). Without this, characters like `,` `.` `(` `)` `"`
 * let a caller inject extra filter clauses into the query.
 */
export function pgQuote(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/** Quoted `%value%` pattern safe for `ilike` inside an `.or()` filter string. */
export function pgIlikePattern(value: string): string {
  const escaped = value.replace(/[\\%_]/g, (c) => `\\${c}`);
  return pgQuote(`%${escaped}%`);
}
