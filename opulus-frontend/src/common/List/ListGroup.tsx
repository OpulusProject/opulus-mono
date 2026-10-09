import * as React from 'react';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui';

import { toListItems } from './items';
import { ListHeader, type ListHeaderProps } from './ListHeader';

interface ListGroupProps
  extends Pick<
    ListHeaderProps,
    'action' | 'subtitle' | 'title' | 'trailingTitle'
  > {
  /** The group's rows, each as its own child (not inside a fragment). */
  children?: React.ReactNode;
  /** Let the header collapse and expand the rows. */
  collapsible?: boolean;
  /** Start expanded (default). Only for a collapsible group. */
  defaultOpen?: boolean;
}

/**
 * A header and the rows under it, inside a `List`: the transactions of a day,
 * or the accounts of a type. With `collapsible` the header toggles the rows.
 */
export const ListGroup: React.FC<ListGroupProps> = ({
  children,
  collapsible = false,
  defaultOpen = true,
  ...header
}) => {
  const [open, setOpen] = React.useState(defaultOpen);
  const rows = <ul className="divide-y border-t">{toListItems(children)}</ul>;

  if (!collapsible) {
    return (
      <div>
        <ListHeader {...header} />
        {rows}
      </div>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <ListHeader {...header} expanded={open} />
      </CollapsibleTrigger>
      <CollapsibleContent className="data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden">
        {rows}
      </CollapsibleContent>
    </Collapsible>
  );
};
