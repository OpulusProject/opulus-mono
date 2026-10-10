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
    const innerRef = React.useRef<HTMLElement>(null);
    React.useImperativeHandle(ref, () => innerRef.current as HTMLElement);
    const width = useElementWidth(innerRef, typeof action === 'function');
    const clickable = !!props.onClick;
    const Comp = (clickable ? 'button' : 'div') as React.ElementType<
      React.HTMLAttributes<HTMLElement> & {
        ref?: React.Ref<HTMLElement>;
        type?: 'button';
      }
    >;

    return (
      <Comp
        ref={innerRef}
        {...(clickable && { type: 'button' })}
        {...(expanded !== undefined && { 'aria-expanded': expanded })}
        {...props}
        className={cn(
          'bg-muted/40 flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-left text-sm',
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
            {typeof action === 'function'
              ? width !== undefined && action({ width })
              : action}
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
   *
   * Pass a function to choose what to show by the header's width (in px, not
   * counting its padding): it is called with `{ width }` once that is known.
   * Choosing in JS rather than with container queries means only one version
   * is mounted, so a menu left open in the one that goes away closes with it
   * instead of losing its anchor and jumping to the corner of the page.
   */
  action?: React.ReactNode | ((header: { width: number }) => React.ReactNode);
  /**
   * Show an expand chevron: pointing down when true, right when false. Leave
   * undefined for a header that does not expand.
   */
  expanded?: boolean;
}
ListHeader.displayName = 'ListHeader';

/** The element's content width, once measured; only measures when `enabled`. */
function useElementWidth(
  ref: React.RefObject<HTMLElement | null>,
  enabled: boolean
) {
  const [width, setWidth] = React.useState<number>();

  React.useLayoutEffect(() => {
    const element = ref.current;
    if (!enabled || !element) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry?.contentRect.width)
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, enabled]);

  return width;
}
