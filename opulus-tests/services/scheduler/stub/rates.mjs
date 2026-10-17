/**
 * The rates the Frankfurter stub publishes. A plain function of the day, so a
 * spec can work out what the scheduler should have stored without asking the
 * stub. Shared by the stub and the specs.
 */

/** The currencies the stub publishes (against the euro, like Frankfurter). */
export const STUB_CURRENCIES = ["CAD", "GBP", "USD"];

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days since 2000-01-01, so every day has its own rates. */
/** @param {string} day */
function dayNumber(day) {
  return Math.round(
    (Date.parse(`${day}T00:00:00Z`) - Date.UTC(2000, 0, 1)) / DAY_MS,
  );
}

/** Units of each currency for one euro on `day` ("YYYY-MM-DD"). */
/** @param {string} day */
export function stubRatesFor(day) {
  const n = dayNumber(day) % 1000;
  return {
    CAD: Number((1.4 + n / 10000).toFixed(4)),
    GBP: Number((0.8 + n / 100000).toFixed(5)),
    USD: Number((1.0 + n / 10000).toFixed(4)),
  };
}

/** Whether the stub publishes on `day`: weekdays only, like the ECB. */
/** @param {string} day */
export function isPublishingDay(day) {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  return weekday !== 0 && weekday !== 6;
}

/** The day `days` after `day` (before it, when negative). */
/** @param {string} day @param {number} days */
export function addDays(day, days) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/** The last publishing day on or before `day`. */
/** @param {string} day */
export function lastPublishingDay(day) {
  let current = day;
  while (!isPublishingDay(current)) current = addDays(current, -1);
  return current;
}

/** Every publishing day from `from` to `to`, starting at the last one on or before `from`. */
/** @param {string} from @param {string} to */
export function publishingDays(from, to) {
  /** @type {string[]} */
  const days = [];
  for (let day = lastPublishingDay(from); day <= to; day = addDays(day, 1)) {
    if (isPublishingDay(day)) days.push(day);
  }
  return days;
}
