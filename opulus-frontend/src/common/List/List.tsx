import * as React from 'react';

import { Skeleton } from '@/components/ui';
import { cn } from '@/lib/utils';

import { toListItems } from './items';
import { ListHeader } from './ListHeader';

interface ListProps {
  /** Names the list for screen readers. */
  'aria-label'?: string;
  /**
   * The list's parts: `ListHeader`, `ListGroup`, `ListRow`, `ListFooter` or
   * `ListEmpty`, each as its own child (not inside a fragment).
   */
  children?: React.ReactNode;
  /**
   * Show placeholder rows instead of the children while the data loads. A
   * `ListHeader` stays, since it holds controls that must remain available.
   */
  isLoading?: boolean;
  /** Dim the rows while new ones load and the old ones are still showing. */
  isRefreshing?: boolean;
}

/**
 * A bordered list of rows: the container for `ListRow`s and the parts around
 * them. Each child becomes a list item; rows are separated by dividers.
 *
 * @example
 * <List isLoading={isLoading}>
 *   <ListHeader title="3 connections" />
 *   {items.map((item) => <ListRow key={item.id} title={item.name} />)}
 *   <ListFooter summary="Showing 3 of 3" />
 * </List>
 */
export const List: React.FC<ListProps> = ({
  children,
  isLoading = false,
  isRefreshing = false,
  ...props
}) => (
  <ul
    {...props}
    aria-busy={isLoading || isRefreshing}
    className={cn(
      'divide-y rounded-md border',
      isRefreshing && 'opacity-60 transition-opacity'
    )}
  >
    {isLoading ? (
      <>
        {toListItems(
          React.Children.toArray(children).filter(
            (child) => React.isValidElement(child) && child.type === ListHeader
          )
        )}
        <ListSkeleton />
      </>
    ) : (
      toListItems(children)
    )}
  </ul>
);

/** Placeholder rows shaped like a `ListRow`, so the list keeps its size. */
const ListSkeleton: React.FC = () => (
  <>
    {[0, 1, 2, 3].map((index) => (
      <li key={index} className="flex items-center gap-3 px-4 py-3">
        <Skeleton className="size-9 shrink-0 rounded-[10px]" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        <Skeleton className="h-4 w-16" />
      </li>
    ))}
  </>
);
