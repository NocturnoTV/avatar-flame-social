/** Mirrors the bump_message_streak/restore_streak Postgres logic (see the
 * matching migration) so the UI can show the right flame state without a
 * round trip: a streak stays lit through the day right after streak_date
 * (the existing DB trigger still increments through that grace day), turns
 * gray in the last few hours of it as a heads-up, and once frozen broken
 * (streak_broken_at set) stays restorable for 30h before it's gone for
 * good - matched here by treating a stale broken_at as "none" instead of
 * showing a restore option that would just fail server-side. */
export type StreakStatus = "none" | "active" | "warning" | "broken";

const WARNING_WINDOW_HOURS = 4;
const RESTORE_WINDOW_HOURS = 30;

export function streakStatus(streak: {
  count: number;
  date: string | null;
  brokenAt: string | null;
}): StreakStatus {
  if (streak.brokenAt) {
    const hoursSinceBroken = (Date.now() - new Date(streak.brokenAt).getTime()) / 3_600_000;
    return hoursSinceBroken <= RESTORE_WINDOW_HOURS ? "broken" : "none";
  }
  if (streak.count <= 0 || !streak.date) return "none";

  // streak.date is the last UTC calendar day both sides exchanged - the
  // streak survives through the next day too (matching the DB trigger),
  // so the real deadline is the start of the day after that.
  const deadline = new Date(`${streak.date}T00:00:00Z`);
  deadline.setUTCDate(deadline.getUTCDate() + 2);
  const hoursLeft = (deadline.getTime() - Date.now()) / 3_600_000;
  if (hoursLeft <= 0) return "none"; // DB will freeze/clear it on the next message
  return hoursLeft <= WARNING_WINDOW_HOURS ? "warning" : "active";
}

export function restoreDeadline(brokenAt: string): Date {
  return new Date(new Date(brokenAt).getTime() + RESTORE_WINDOW_HOURS * 3_600_000);
}

export function hoursUntil(date: Date): number {
  return Math.max(0, Math.round((date.getTime() - Date.now()) / 3_600_000));
}
