import { ChevronRight } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * A bar at the top of a list or of a group of rows: a title, a total and
 * controls. Its props are named like `ListRow`'s (`title`, `trailingTitle`,
 * `action`, `expanded`).
 *
 * Headers with an `onClick` render as a button (a group's expand/collapse).
 */
export const ListHeader = React.forwardRef<HTMLElement, ListHeaderProps>(
  ({ title, titleAction, trailingTitle, action, expanded, ...props }, ref) => {
    const clickable = !!props.onClick;
    const Comp = (clickable ? 'button' : 'div') as React.ElementType<
      React.HTMLAttributes<HTMLElement> & {
        ref?: React.Ref<HTMLElement>;
        type?: 'button';
      }
    >;

    return (
      <Comp
        ref={ref}
        {...(clickable && { type: 'button' })}
        {...(expanded !== undefined && { 'aria-expanded': expanded })}
        {...props}
        className={cn(
          'bg-muted/40 @container flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-left text-sm',
          clickable && 'hover:bg-muted/70 transition-colors'
        )}
      >
        <div className="flex min-w-0 flex-auto items-center gap-2">
          <span className="truncate font-medium" title={title}>
            {title}
          </span>
          {titleAction}
        </div>

        {trailingTitle && (
          <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
            {trailingTitle}
          </span>
        )}

        {action && (
          <div className="ml-auto flex shrink-0 flex-wrap items-center gap-1">
            {action}
          </div>
        )}

        {expanded !== undefined && (
          <ChevronRight
            className={cn(
              'text-muted-foreground size-4 shrink-0 transition-transform duration-200',
              expanded && 'rotate-90'
            )}
          />
        )}
      </Comp>
    );
  }
);

export interface ListHeaderProps
  extends Omit<React.ComponentPropsWithoutRef<'div'>, 'className' | 'title'> {
  title: string;
  /**
   * A button after the title, e.g. "Clear filters". It stays in the same place
   * however many menus are in `action`.
   */
  titleAction?: React.ReactNode;
  /** Right-aligned text, e.g. a total. */
  trailingTitle?: string;
  /**
   * Buttons or a menu at the right. Pass them as siblings or a fragment;
   * ListHeader spaces them in a row.
   */
  action?: React.ReactNode;
  /**
   * Show an expand chevron: pointing down when true, right when false. Leave
   * undefined for a header that does not expand.
   */
  expanded?: boolean;
}
ListHeader.displayName = 'ListHeader';
