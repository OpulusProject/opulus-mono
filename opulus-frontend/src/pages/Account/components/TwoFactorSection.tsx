import { useState } from 'react';

import { Badge, Button, Skeleton } from '@/components/ui';
import { useSession } from '@/hooks/auth/useSession';

import { AccountSection } from './AccountSection';
import { TwoFactorDisableDialog } from './TwoFactorDisableDialog';
import { TwoFactorSetupDialog } from './TwoFactorSetupDialog';

export const TwoFactorSection: React.FC = () => {
  const { data: session, isPending } = useSession();
  const [dialog, setDialog] = useState<'setup' | 'disable' | null>(null);

  const enabled = Boolean(session?.user.twoFactorEnabled);

  return (
    <AccountSection
      title="Two-factor authentication"
      description="Ask for a code from an authenticator app when you sign in, on top of your password."
    >
      {isPending ? (
        <Skeleton className="h-9 w-full" />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Badge variant={enabled ? 'default' : 'secondary'}>
            {enabled ? 'Enabled' : 'Not enabled'}
          </Badge>
          {enabled ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialog('disable')}
            >
              Turn off
            </Button>
          ) : (
            <Button type="button" onClick={() => setDialog('setup')}>
              Set up
            </Button>
          )}
        </div>
      )}

      {dialog === 'setup' && (
        <TwoFactorSetupDialog onClose={() => setDialog(null)} />
      )}
      {dialog === 'disable' && (
        <TwoFactorDisableDialog onClose={() => setDialog(null)} />
      )}
    </AccountSection>
  );
};
