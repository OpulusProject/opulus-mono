import * as React from 'react';

interface ListFooterProps {
  /** Muted text at the left, e.g. "Showing 50 of 63". */
  summary?: string;
  /** A button or link at the right, e.g. "Load more". */
  action?: React.ReactNode;
}

/** A bar at the bottom of a list: a summary and an action. */
export const ListFooter: React.FC<ListFooterProps> = ({ summary, action }) => (
  <div className="flex items-center justify-between gap-3 px-4 py-3">
    <p className="text-muted-foreground text-xs">{summary}</p>
    {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
  </div>
);
