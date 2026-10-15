import { exchangeRateRepository, toDay } from "@opulus/core";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * How many days old the newest stored rate may be before the rates count as
 * stale. The European Central Bank publishes on weekdays, so a Friday's rate is
 * three days old on Monday morning, and a holiday adds a day or two.
 */
export const STALE_AFTER_DAYS = 5;

export interface ExchangeRateStatus {
  /** fresh: recent enough; stale: the scheduler has not stored a rate in a while; empty: none at all. */
  status: "fresh" | "stale" | "empty";
  /** The newest day with a stored rate, "YYYY-MM-DD", or null when there is none. */
  latestDate: string | null;
}

/**
 * Whether exchange rates are being kept up to date. Every aggregate in other
 * currencies needs a rate, and a missing one is an error, so a scheduler that
 * has stopped shows up here before it shows up as failed requests.
 */
export async function getExchangeRateStatus(
  now: Date = new Date()
): Promise<ExchangeRateStatus> {
  const latestDate = await exchangeRateRepository.getLatestDate();
  if (latestDate === null) return { status: "empty", latestDate };

  const age = (Date.parse(toDay(now)) - Date.parse(latestDate)) / DAY_MS;
  return { status: age > STALE_AFTER_DAYS ? "stale" : "fresh", latestDate };
}
