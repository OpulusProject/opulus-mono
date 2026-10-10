import { useMatches } from '@tanstack/react-router';
import * as React from 'react';

import { SiteHeader } from '@/common/AppLayout/components/SiteHeader';
import { AppSidebar } from '@/common/AppSidebar';
import { SidebarInset, SidebarProvider } from '@/components/ui';

import { useSidebarPreference } from './useSidebarPreference';

interface AppLayoutProps {
  children: React.ReactNode;
}

/**
 * The sidebar and header around every signed-in page. The header's title and
 * section come from the current route's `staticData`.
 */
export function AppLayout({ children }: AppLayoutProps) {
  const { open, setOpen } = useSidebarPreference();
  const { title, section } = useMatches({
    select: (matches) => matches[matches.length - 1]?.staticData ?? {},
  });

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
