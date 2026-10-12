import { Link } from '@tanstack/react-router';
import { Landmark } from 'lucide-react';
import * as React from 'react';

import { List, ListEmpty } from '@/common/List';
import { PageHeader } from '@/common/PageHeader';
import { Button } from '@/components/ui';
import { useItems } from '@/hooks/items/useItems';

interface ConnectionsPrompt {
  title: string;
  description: string;
}

interface PageProps {
  title: string;
  description?: string;
  /** Primary page actions, right-aligned on wide screens. */
  actions?: React.ReactNode;
  /**
   * The page shows data from connected accounts, so with none connected it
   * shows one prompt to connect instead of its content. This is what the
   * prompt says, in the page's own terms.
   */
  requiresConnections?: ConnectionsPrompt;
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
 * <Page
 *   title="Spending"
 *   description="Where your money went."
 *   requiresConnections={{
 *     title: 'No spending yet',
 *     description: 'Connect an account to see where your money goes.',
 *   }}
 * >
 *   <SpendingByCategory />
 * </Page>
 */
export const Page: React.FC<PageProps> = ({
  title,
  description,
  actions,
  requiresConnections,
  children,
}) => (
  <div className="flex flex-col gap-6 px-4 lg:px-6">
    <PageHeader title={title} description={description} actions={actions} />
    {requiresConnections ? (
      <ConnectionsGate prompt={requiresConnections}>{children}</ConnectionsGate>
    ) : (
      children
    )}
  </div>
);

const ConnectionsGate: React.FC<{
  prompt: ConnectionsPrompt;
  children?: React.ReactNode;
}> = ({ prompt, children }) => {
  const items = useItems();

  if (items.isLoading) {
    return <List isLoading aria-label="Loading" />;
  }
  if (items.data?.items.length === 0) {
    return (
      <List>
        <ListEmpty
          icon={Landmark}
          title={prompt.title}
          description={prompt.description}
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
