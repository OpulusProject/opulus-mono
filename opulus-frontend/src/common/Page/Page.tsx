import { Link } from '@tanstack/react-router';
import { Landmark } from 'lucide-react';
import * as React from 'react';

import { List, ListEmpty } from '@/common/List';
import { PageHeader } from '@/common/PageHeader';
import { Button } from '@/components/ui';
import { useItems } from '@/hooks/items/useItems';
import { cn } from '@/lib/utils';

interface PageProps {
  title: string;
  description?: React.ReactNode;
  /** Primary page actions, right-aligned on wide screens. */
  actions?: React.ReactNode;
  /**
   * The page shows data from connected accounts, so with none connected it
   * shows one prompt to connect instead of its content.
   */
  requiresConnections?: boolean;
  /** Spacing and the like for the page's own layout. */
  className?: string;
  children?: React.ReactNode;
}

/**
 * The frame every page sits in: padding, the page header, then the content.
 *
 * With `requiresConnections`, the content is not rendered (so it makes no
 * requests) until something is connected. While that is loading the header
 * stays with a placeholder, so a page with nothing connected never flashes its
 * content. If the connections fail to load the content is shown, since that
 * says nothing about whether any are connected.
 *
 * @example
 * <Page title="Spending" description="Where your money went." requiresConnections>
 *   <SpendingByCategory />
 * </Page>
 */
export const Page: React.FC<PageProps> = ({
  title,
  description,
  actions,
  requiresConnections = false,
  className,
  children,
}) => (
  <div className={cn('flex flex-col gap-6 px-4 lg:px-6', className)}>
    <PageHeader title={title} description={description} actions={actions} />
    {requiresConnections ? (
      <ConnectionsGate>{children}</ConnectionsGate>
    ) : (
      children
    )}
  </div>
);

const ConnectionsGate: React.FC<{ children?: React.ReactNode }> = ({
  children,
}) => {
  const items = useItems();

  if (items.isLoading) {
    return <List isLoading aria-label="Loading" />;
  }
  if (items.data?.items.length === 0) {
    return (
      <List>
        <ListEmpty
          icon={Landmark}
          title="No connections yet"
          description="Connect an account to get started."
          action={
            <Button asChild>
              <Link to="/settings/connections">Go to connections</Link>
            </Button>
          }
        />
      </List>
    );
  }
  return <>{children}</>;
};
