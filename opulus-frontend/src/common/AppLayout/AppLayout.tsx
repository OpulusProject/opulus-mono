import * as React from 'react';

import { SiteHeader } from '@/common/AppLayout/components/SiteHeader';
import { AppSidebar } from '@/common/AppSidebar';
import { SidebarInset, SidebarProvider } from '@/components/ui';

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
  /** Parent section shown before the title in the header, e.g. "Settings". */
  section?: string;
}

/**
 * Whether the sidebar was left open, from the cookie that `SidebarProvider`
 * writes when it is toggled. Each page renders its own `AppLayout`, so without
 * this the sidebar would open again on every navigation.
 */
function wasSidebarOpen() {
  return !document.cookie.split('; ').includes('sidebar_state=false');
}

export function AppLayout({ children, title, section }: AppLayoutProps) {
  return (
    <SidebarProvider
      defaultOpen={wasSidebarOpen()}
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
