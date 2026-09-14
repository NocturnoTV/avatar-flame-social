/** Helpers for "local day" logic (daily quests, streaks) driven by the
 * user's own timezone (profiles.timezone) rather than the browser's, so
 * these always agree with what the bump_quest_progress SQL function used
 * to decide which day an action belongs to. */

/** YYYY-MM-DD for `tz`'s current wall-clock date - matches Postgres's
 * `(now() at time zone tz)::date` formatting. */
export function localDateStr(tz: string, date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Milliseconds remaining until `tz`'s next local midnight. */
export function msUntilNextLocalMidnight(tz: string, date: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  // A midnight boundary can format the hour as "24" in some environments.
  const hour = get("hour") % 24;
  const elapsedMs = ((hour * 60 + get("minute")) * 60 + get("second")) * 1000;
  return 24 * 60 * 60 * 1000 - elapsedMs;
}

export function formatCountdown(ms: number): { hours: number; minutes: number } {
  const total = Math.max(0, ms);
  return {
    hours: Math.floor(total / 3_600_000),
    minutes: Math.floor((total % 3_600_000) / 60_000),
  };
}
