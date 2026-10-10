'use client';

import { Link, useRouterState } from '@tanstack/react-router';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import * as React from 'react';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui';

export interface NavItem {
  title: string;
  url: string;
  icon?: LucideIcon;
  /** Child links. When present the item renders as an expandable group. */
  items?: { title: string; url: string }[];
}

function isPathActive(pathname: string, url: string) {
  return url !== '#' && (pathname === url || pathname.startsWith(`${url}/`));
}

function NavGroup({ item, pathname }: { item: NavItem; pathname: string }) {
  const children = item.items ?? [];
  const hasActiveChild = children.some((child) =>
    isPathActive(pathname, child.url)
  );
  const [open, setOpen] = React.useState(hasActiveChild);

  // Landing on a child route (deep link, redirect) expands its group.
  React.useEffect(() => {
    if (hasActiveChild) setOpen(true);
  }, [hasActiveChild]);

  // The sidebar is icons only, so there is no room to expand the group inline:
  // its links open in a menu beside the icon instead.
  const { state, isMobile } = useSidebar();
  if (state === 'collapsed' && !isMobile) {
    return (
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton isActive={hasActiveChild}>
              {item.icon && <item.icon />}
              <span>{item.title}</span>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start" sideOffset={4}>
            <DropdownMenuLabel>{item.title}</DropdownMenuLabel>
            {children.map((child) => (
              <DropdownMenuItem key={child.title} asChild>
                <Link to={child.url}>{child.title}</Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={item.title}>
            {item.icon && <item.icon />}
            <span>{item.title}</span>
            <ChevronRight
              className={`ml-auto transition-transform duration-200 ${
                open ? 'rotate-90' : ''
              }`}
            />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent className="data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden">
          <SidebarMenuSub className="mr-0 pr-0">
            {children.map((child) => (
              <SidebarMenuSubItem key={child.title}>
                <SidebarMenuSubButton
                  asChild
                  className="h-8"
                  isActive={isPathActive(pathname, child.url)}
                >
                  <Link to={child.url}>
                    <span>{child.title}</span>
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

export function NavMain({ items }: { items: NavItem[] }) {
  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <NavMenu items={items} />
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

/** The links of a sidebar group: plain links, and groups that expand. */
export function NavMenu({ items }: { items: NavItem[] }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <SidebarMenu>
      {items.map((item) =>
        item.items?.length ? (
          <NavGroup key={item.title} item={item} pathname={pathname} />
        ) : (
          <SidebarMenuItem key={item.title}>
            <SidebarMenuButton
              tooltip={item.title}
              isActive={isPathActive(pathname, item.url)}
              asChild
            >
              <Link to={item.url}>
                {item.icon && <item.icon />}
                <span>{item.title}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )
      )}
    </SidebarMenu>
  );
}
