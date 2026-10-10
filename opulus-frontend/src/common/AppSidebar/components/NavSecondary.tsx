import * as React from 'react';

import { SidebarGroup, SidebarGroupContent } from '@/components/ui';

import { type NavItem, NavMenu } from './NavMenu';

/** The links at the bottom of the sidebar, below the main ones. */
export function NavSecondary({
  items,
  ...props
}: { items: NavItem[] } & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <NavMenu items={items} />
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
