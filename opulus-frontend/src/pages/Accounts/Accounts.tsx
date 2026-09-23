import { Search } from 'lucide-react';
import { useState } from 'react';

import { AppLayout } from '@/common/AppLayout';
import { LaunchLink } from '@/common/LaunchLink';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
} from '@/components/ui';
import { useItems } from '@/hooks/items/useItems';

import { AddAccountCard, EmptyAccountsView, ItemCard } from './components';

export const Accounts: React.FC = () => {
  const [isLinkOpen, setIsLinkOpen] = useState(false);
  const [updateItemId, setUpdateItemId] = useState<string | undefined>();
  const { data: itemsData, isLoading } = useItems();

  const handleLinkSuccess = (publicToken: string, metadata: unknown) => {
    console.log('Plaid Link Success:', { publicToken, metadata });
    // TODO: Exchange public token for access token
    // TODO: Store account information
  };

  const handleLinkExit = (error: unknown, metadata: unknown) => {
    if (error) {
      console.error('Plaid Link Error:', error);
    }
    console.log('Plaid Link Exit:', metadata);
  };

  return (
    <AppLayout title="Accounts">
      <div className="px-4 lg:px-6">
        <div className="flex items-center gap-4 py-4">
          <InputGroup className="flex-1">
            <InputGroupAddon>
              <Search className="h-4 w-4" />
            </InputGroupAddon>
            <InputGroupInput placeholder="Search accounts..." />
          </InputGroup>
          <Select defaultValue="name">
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="date">Date Added</SelectItem>
              <SelectItem value="balance">Balance</SelectItem>
              <SelectItem value="type">Type</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
            <Spinner className="size-6" />
          </div>
        ) : itemsData && itemsData.items.length > 0 ? (
          <div className="flex flex-wrap gap-8">
            {itemsData.items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                onReconnect={(itemId) => {
                  setUpdateItemId(itemId);
                  setIsLinkOpen(true);
                }}
              />
            ))}
            <AddAccountCard
              onAddAccount={() => {
                setUpdateItemId(undefined);
                setIsLinkOpen(true);
              }}
            />
          </div>
        ) : (
          <div
            className={`transition-opacity duration-300 ${
              isLinkOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}
          >
            <EmptyAccountsView onAddAccount={() => setIsLinkOpen(true)} />
          </div>
        )}
      </div>
      {isLinkOpen && (
        <LaunchLink
          itemId={updateItemId}
          onClose={() => {
            setIsLinkOpen(false);
            setUpdateItemId(undefined);
          }}
          onSuccess={handleLinkSuccess}
          onExit={handleLinkExit}
        />
      )}
    </AppLayout>
  );
};
