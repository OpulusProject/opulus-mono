import * as React from 'react';

import { SiteHeader } from '@/common/AppLayout/components/SiteHeader';
import { AppSidebar } from '@/common/AppSidebar';
import { SidebarInset, SidebarProvider } from '@/components/ui';

import { useSidebarPreference } from './useSidebarPreference';

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
  /** Parent section shown before the title in the header, e.g. "Settings". */
  section?: string;
}

export function AppLayout({ children, title, section }: AppLayoutProps) {
  const { open, setOpen } = useSidebarPreference();

  return (
    <SidebarProvider
      open={open}
      onOpenChange={setOpen}
      style={
        {
          '--sidebar-width': '18rem',
          '--header-height': '3rem',
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader title={title} section={section} />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              {children}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
