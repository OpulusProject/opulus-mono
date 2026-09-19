import { Link2, Lock, Settings as SettingsIcon } from 'lucide-react';
import * as React from 'react';

import { AppLayout } from '@/common/AppLayout';
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui';

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

export const Settings: React.FC = () => {
  return (
    <AppLayout title="Settings">
      <div className="px-4 lg:px-6">
        <div className="flex gap-6">
          {/* Settings Navigation Sidebar */}
          <aside className="w-[240px] shrink-0">
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
          </aside>

          {/* Settings Content Area */}
          <div className="flex-1 min-w-0">
            {/* Settings content will go here */}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};
