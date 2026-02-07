import { Separator, SidebarTrigger } from '@gems';

interface SiteHeaderProps {
  title?: string;
}

export function SiteHeader({ title }: SiteHeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2">
      <div className="flex items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mr-2 data-[orientation=vertical]:h-4"
        />
        {title && <h1 className="text-base font-medium">{title}</h1>}
      </div>
    </header>
  );
}
