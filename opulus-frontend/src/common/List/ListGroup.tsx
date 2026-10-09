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
}

/**
 * A header and the rows under it, inside a `List`: the transactions of a day,
 * or the accounts of a type. The header collapses and expands the rows, so every
 * grouped list works the same way.
 */
export const ListGroup: React.FC<ListGroupProps> = ({
  children,
  ...header
}) => {
  const [open, setOpen] = React.useState(true);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <ListHeader {...header} expanded={open} />
      </CollapsibleTrigger>
      <CollapsibleContent className="data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden">
        <ul className="divide-y border-t">{toListItems(children)}</ul>
      </CollapsibleContent>
    </Collapsible>
  );
};
