import {
  config,
  logger,
  refreshExchangeRates,
  refreshSecurityPrices,
} from "@opulus/core";

export interface ScheduledJob {
  /** What it does, for logs and the README. */
  description: string;
  /** When it runs: a cron pattern (UTC), or every so many milliseconds. */
  schedule: { pattern: string } | { everyMs: number };
  /** Also run once when the scheduler starts, so a fresh deploy need not wait. */
  runOnStart: boolean;
  /** The work. What it returns is kept as the run's result. */
  run: () => Promise<unknown>;
}

/**
 * How often securities are quoted, from SECURITY_PRICES_INTERVAL_MINUTES (15 if
 * unset). A value that is not a whole number of minutes from 1 to 1440 is
 * ignored with a warning, so a typo cannot stop prices updating.
 */
function securityPricesIntervalMs(): number {
  const minutes = config.securityPricesIntervalMinutes;
  if (Number.isInteger(minutes) && minutes >= 1 && minutes <= 1440) {
    return minutes * 60 * 1000;
  }
  logger.warn(
    { minutes: process.env.SECURITY_PRICES_INTERVAL_MINUTES },
    "SECURITY_PRICES_INTERVAL_MINUTES is not a whole number from 1 to 1440; using 15",
  );
  return 15 * 60 * 1000;
}

/**
 * Every recurring job. A job is a name, a schedule and a call to a core service;
 * the work itself lives in the service. Adding one here is all it takes: the
 * scheduler registers its schedule at start-up (and drops schedules whose job
 * is gone), and the jobs API and `run-job` script can run it by name.
 */
export const jobs = {
  "refresh-exchange-rates": {
    description:
      "Bring exchange_rate up to date from Frankfurter (about two years when it is empty)",
    // The European Central Bank publishes around 16:00 CET; 17:00 UTC is after
    // that all year round.
    schedule: { pattern: process.env.EXCHANGE_RATES_CRON || "0 17 * * *" },
    runOnStart: true,
    run: () => refreshExchangeRates(),
  },
  "refresh-security-prices": {
    description:
      "Quote every security and store the price as today's (the last quote of a day is its close), then fetch the history of any that has none",
    schedule: { everyMs: securityPricesIntervalMs() },
    runOnStart: true,
    run: () => refreshSecurityPrices(),
  },
} satisfies Record<string, ScheduledJob>;

export type JobName = keyof typeof jobs;

export function isJobName(name: string): name is JobName {
  return Object.hasOwn(jobs, name);
}
