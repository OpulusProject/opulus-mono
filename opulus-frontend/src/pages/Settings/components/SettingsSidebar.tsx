'use client';

import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@gems';
import { Link2, Lock, Settings as SettingsIcon } from 'lucide-react';

const settingsNavItems = [
  {
    title: 'General',
    icon: SettingsIcon,
  },
  {
    title: 'Security',
    icon: Lock,
  },
  {
    title: 'Connections',
    icon: Link2,
  },
];

export function SettingsSidebar() {
  return (
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupContent className="flex flex-col gap-2">
          <SidebarMenu>
            {settingsNavItems.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton tooltip={item.title}>
                  <item.icon />
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
  );
}
