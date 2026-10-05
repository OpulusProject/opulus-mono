import { Search } from 'lucide-react';

import { AppLayout } from '@/common/AppLayout';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui';

import { InstitutionList } from './components';

export const Accounts: React.FC = () => {
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

        <InstitutionList />
      </div>
    </AppLayout>
  );
};
