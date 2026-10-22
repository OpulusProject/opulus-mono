import { refreshExchangeRates, refreshSecurityPrices } from "@opulus/core";

export interface ScheduledJob {
  /** What it does, for logs and the README. */
  description: string;
  /** When it runs: a cron pattern, in UTC. */
  pattern: string;
  /** Also run once when the scheduler starts, so a fresh deploy need not wait. */
  runOnStart: boolean;
  /** The work. What it returns is kept as the run's result. */
  run: () => Promise<unknown>;
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
    pattern: process.env.EXCHANGE_RATES_CRON || "0 17 * * *",
    runOnStart: true,
    run: () => refreshExchangeRates(),
  },
  "refresh-security-prices": {
    description:
      "Quote every security and store the price as today's (the last quote of a day is its close), then fetch the history of any that has none",
    // Every 15 minutes, on the quarter hour; SECURITY_PRICES_CRON sets another.
    pattern: process.env.SECURITY_PRICES_CRON || "*/15 * * * *",
    runOnStart: true,
    run: () => refreshSecurityPrices(),
  },
} satisfies Record<string, ScheduledJob>;

export type JobName = keyof typeof jobs;

export function isJobName(name: string): name is JobName {
  return Object.hasOwn(jobs, name);
}
