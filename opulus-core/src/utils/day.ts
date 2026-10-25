/**
 * Calendar days as "YYYY-MM-DD" strings (UTC), for work that is about days and
 * not moments in time.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Days in a year, for turning a yearly amount into a daily one. */
export const DAYS_IN_YEAR = 365;

/** The day a moment falls on, in UTC. */
export function toDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** The day this many days after `day` (before it, when negative). */
export function addDays(day: string, days: number): string {
  return toDay(new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS));
}

/** How many days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS
  );
}
