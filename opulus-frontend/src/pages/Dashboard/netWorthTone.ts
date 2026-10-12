/** How net worth moved over some stretch: up, down, or flat. */
export type NetWorthTone = 'up' | 'down' | 'flat';

/** Text color for each tone (also the line's color, which draws in the text color). */
export const TONE_CLASS: Record<NetWorthTone, string> = {
  up: 'text-emerald-600 dark:text-emerald-400',
  down: 'text-red-600 dark:text-red-400',
  flat: 'text-muted-foreground',
};

/** The tone of a change: flat when it is within half a cent. */
export const toneOf = (change: number): NetWorthTone =>
  change > 0.005 ? 'up' : change < -0.005 ? 'down' : 'flat';
