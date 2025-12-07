import {
  Button,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@gems';
import { Plus, Search } from 'lucide-react';
import { useState } from 'react';

import { AppLayout } from '@/common/AppLayout';
import { LaunchLink } from '@/common/LaunchLink';

export const Accounts: React.FC = () => {
  const [isLinkOpen, setIsLinkOpen] = useState(false);

  const handleLinkSuccess = (publicToken: string, metadata: any) => {
    console.log('Plaid Link Success:', { publicToken, metadata });
    // TODO: Exchange public token for access token
    // TODO: Store account information
  };

  const handleLinkExit = (error: any, metadata: any) => {
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
          <Button onClick={() => setIsLinkOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Account
          </Button>
        </div>
      </div>
      {isLinkOpen && (
        <LaunchLink
          onClose={() => setIsLinkOpen(false)}
          onSuccess={handleLinkSuccess}
          onExit={handleLinkExit}
        />
      )}
    </AppLayout>
  );
};
