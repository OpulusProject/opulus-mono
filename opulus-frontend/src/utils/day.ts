/** "Thu, Oct 8" for a `YYYY-MM-DD` day (or an ISO date, whose time is ignored). */
export function formatDay(
  day: string,
  options: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }
): string {
  const [y, m, d] = day.slice(0, 10).split('-').map(Number);
  // Format in UTC so the calendar day never shifts with the viewer's time zone.
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-CA', {
    ...options,
    timeZone: 'UTC',
  });
}
