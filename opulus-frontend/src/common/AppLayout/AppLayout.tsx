import { Separator, SidebarInset, SidebarProvider } from '@gems';
import * as React from 'react';

import { SiteHeader } from '@/common/AppLayout/components/SiteHeader';
import { AppSidebar } from '@/common/AppSidebar';

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export function AppLayout({ children, title }: AppLayoutProps) {
  // Read sidebar state from localStorage on mount
  const [sidebarOpen, setSidebarOpen] = React.useState(() => {
    if (typeof window === 'undefined') return true;
    try {
      const stored = localStorage.getItem('sidebar_state');
      if (stored === null) return true;
      return stored === 'true';
    } catch (error) {
      // localStorage may be unavailable (e.g., private browsing mode)
      return true;
    }
  });

  // Handle sidebar state changes and persist to localStorage
  const handleSidebarOpenChange = React.useCallback((open: boolean) => {
    setSidebarOpen(open);
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('sidebar_state', String(open));
    } catch (error) {
      // localStorage may be unavailable (e.g., private browsing mode)
      console.warn('Failed to save sidebar state to localStorage:', error);
    }
  }, []);

  return (
    <SidebarProvider
      open={sidebarOpen}
      onOpenChange={handleSidebarOpenChange}
      style={
        {
          '--sidebar-width': 'calc(var(--spacing) * 72)',
          '--header-height': 'calc(var(--spacing) * 12)',
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader title={title} />
        <Separator />
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
