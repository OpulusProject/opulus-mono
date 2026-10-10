export interface DayRange {
  /** First day, as `YYYY-MM-DD`. */
  start: string;
  /** Last day (inclusive), as `YYYY-MM-DD`. */
  end: string;
}

/** Every preset covers a fixed number of days, counting today as the first. */
export const RANGE_LABELS = {
  today: 'Today',
  '7d': 'Past 7 days',
  '30d': 'Past 30 days',
  year: 'Past year',
} as const;

export type RangePreset = keyof typeof RANGE_LABELS;

const RANGE_DAYS: Record<RangePreset, number> = {
  today: 1,
  '7d': 7,
  '30d': 30,
  year: 365,
};

/** A `YYYY-MM-DD` day as a local Date, for a calendar. */
export function fromDay(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** The days a preset covers, ending today (so "Past 7 days" is 7 days). */
export function resolveRange(
  preset: RangePreset,
  today: Date = new Date()
): DayRange {
  const start = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - (RANGE_DAYS[preset] - 1)
  );
  return { start: toDay(start), end: toDay(today) };
}

/** A local calendar date as `YYYY-MM-DD` (no time zone shift, unlike toISOString). */
export function toDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
