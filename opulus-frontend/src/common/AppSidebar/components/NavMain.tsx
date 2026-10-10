import { SidebarGroup, SidebarGroupContent } from '@/components/ui';

import { type NavItem, NavMenu } from './NavMenu';

export function NavMain({ items }: { items: NavItem[] }) {
  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <NavMenu items={items} />
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
