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
 * shaped like a `ListRow`, so the list is about the same height either way. On
 * a narrow list the action goes under the text, in line with it.
 */
export const ListEmpty: React.FC<ListEmptyProps> = ({
  icon: Icon,
  title,
  description,
  action,
}) => (
  <div className="@container/empty">
    <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 px-4 py-3 @md/empty:grid-cols-[auto_1fr_auto]">
      <div className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-[10px]">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium">{title}</div>
        {description && (
          <div className="text-muted-foreground text-xs">{description}</div>
        )}
      </div>
      {action && (
        <div className="col-start-2 flex items-center gap-3 @md/empty:col-start-3 @md/empty:row-start-1">
          {action}
        </div>
      )}
    </div>
  </div>
);
