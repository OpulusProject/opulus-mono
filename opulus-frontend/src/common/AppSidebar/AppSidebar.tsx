'use client';

import { Link } from '@tanstack/react-router';
import {
  ArrowLeftRight,
  CreditCard,
  GemIcon,
  HelpCircle,
  Landmark,
  LayoutDashboard,
  Search,
  Settings,
} from 'lucide-react';
import * as React from 'react';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
} from '@/components/ui';
import { useSession } from '@/hooks/auth/useSession';

import { type NavItem, NavMain, NavSecondary, NavUser } from './components';

const navMain: NavItem[] = [
  {
    title: 'Search',
    url: '#',
    icon: Search,
  },
  {
    title: 'Dashboard',
    url: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'Transactions',
    url: '/transactions',
    icon: ArrowLeftRight,
  },
  {
    title: 'Accounts',
    url: '/accounts',
    icon: Landmark,
  },
  {
    title: 'Credit & loans',
    url: '/credit-and-loans',
    icon: CreditCard,
  },
];

const navSecondary: NavItem[] = [
  {
    title: 'Settings',
    url: '/settings',
    icon: Settings,
    items: [{ title: 'Connections', url: '/settings/connections' }],
  },
  {
    title: 'Get Help',
    url: '#',
    icon: HelpCircle,
  },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { data: session } = useSession();

  // Get user data from session, or use placeholder if not loaded
  const user = session?.user
    ? {
        name: session.user.name || session.user.email || 'User',
        email: session.user.email || '',
        avatar: session.user.image || '',
      }
    : {
        name: 'Loading...',
        email: '',
        avatar: '',
      };

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          {/* The collapse button sits beside the logo, or under it when only icons show. */}
          <SidebarMenuItem className="flex items-center gap-1 group-data-[collapsible=icon]:flex-col">
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <Link to="/dashboard">
                <GemIcon className="size-4" />
                <span className="text-base font-semibold">Opulus</span>
              </Link>
            </SidebarMenuButton>
            <SidebarTrigger className="shrink-0" />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
        <NavSecondary items={navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
