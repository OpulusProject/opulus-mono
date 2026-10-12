/**
 * Calendar days as "YYYY-MM-DD" strings (UTC), for work that is about days and
 * not moments in time.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** The day a moment falls on, in UTC. */
export function toDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** The day this many days after `day` (before it, when negative). */
export function addDays(day: string, days: number): string {
  return toDay(new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS));
}
