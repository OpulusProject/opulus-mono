import * as React from 'react';

interface PageHeaderProps {
  title: string;
  description?: React.ReactNode;
  /** Primary page actions, right-aligned on wide screens. */
  actions?: React.ReactNode;
}

/**
 * Standard in-page heading: title, a short description of what the page is
 * for, and the page's primary action(s).
 */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {description && (
          <p className="text-muted-foreground max-w-prose text-sm">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
  );
}
