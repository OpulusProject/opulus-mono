import { useState } from 'react';

import { Button } from '@/components/ui';

import { AccountSection } from './AccountSection';
import { DeleteAccountDialog } from './DeleteAccountDialog';

export const DeleteAccountSection: React.FC = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <AccountSection
      destructive
      title="Delete account and data"
      description="Permanently delete your account, disconnect every bank and card, and erase all of your accounts and transactions. This can't be undone."
    >
      <Button
        type="button"
        variant="destructive"
        onClick={() => setIsDialogOpen(true)}
      >
        Delete account...
      </Button>

      {isDialogOpen && (
        <DeleteAccountDialog onClose={() => setIsDialogOpen(false)} />
      )}
    </AccountSection>
  );
};
