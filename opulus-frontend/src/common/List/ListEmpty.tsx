import type { LucideIcon } from 'lucide-react';
import * as React from 'react';

interface ListEmptyProps {
  icon: LucideIcon;
  title: string;
  /** What to do about it, or why it is empty. */
  description?: string;
  /** A button or link at the right, e.g. "Clear search". */
  action?: React.ReactNode;
}

/**
 * What a list shows when there is nothing to list (or it failed to load): a row
 * shaped like a `ListRow`, so the list is about the same height either way.
 */
export const ListEmpty: React.FC<ListEmptyProps> = ({
  icon: Icon,
  title,
  description,
  action,
}) => (
  <div className="flex items-center gap-3 px-4 py-3">
    <div className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-[10px]">
      <Icon className="size-4" />
    </div>
    <div className="min-w-0 flex-1">
      <div className="text-sm font-medium">{title}</div>
      {description && (
        <div className="text-muted-foreground text-xs">{description}</div>
      )}
    </div>
    {action && <div className="flex shrink-0 items-center gap-3">{action}</div>}
  </div>
);
