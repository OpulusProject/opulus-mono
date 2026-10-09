import { ChevronRight } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * A bar at the top of a list or of a group of rows: a title, optional muted
 * text and a total, and controls. It uses the same props as `ListRow`.
 *
 * Headers with an `onClick` render as a button (a group's expand/collapse).
 */
export const ListHeader = React.forwardRef<HTMLElement, ListHeaderProps>(
  ({ title, subtitle, trailingTitle, action, expanded, ...props }, ref) => {
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
          'bg-muted/40 flex w-full items-center gap-3 px-4 py-2 text-left text-sm',
          clickable && 'hover:bg-muted/70 transition-colors'
        )}
      >
        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          <span className="truncate font-medium" title={title}>
            {title}
          </span>
          {subtitle && (
            <span className="text-muted-foreground truncate text-xs">
              {subtitle}
            </span>
          )}
        </div>

        {trailingTitle && (
          <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
            {trailingTitle}
          </span>
        )}

        {action && (
          <div className="flex shrink-0 items-center gap-2">{action}</div>
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
  /** Muted text after the title, e.g. a count. */
  subtitle?: string;
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
