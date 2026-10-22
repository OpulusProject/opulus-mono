import { useNavigate } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { useState } from 'react';

import { LaunchLink } from '@/common/LaunchLink';
import {
  type LinkResume,
  clearLinkResume,
  readLinkResume,
} from '@/common/LaunchLink/linkResume';
import { PageHeader } from '@/common/PageHeader';
import { Button } from '@/components/ui';
import { useItems } from '@/hooks/items/useItems';
import type { UpdateMode } from '@/hooks/linkTokens/useLinkToken';

import { ConnectionList } from './components';

interface UpdateTarget {
  itemId: string;
  mode: UpdateMode;
}

/**
 * Where an OAuth bank sends the user back after they log in there. The bank
 * adds the state Link needs to finish (`oauth_state_id`) to this page's address,
 * which is registered with Plaid as the redirect URI. Read once, when the page
 * opens: the address as it was received is what Link must be given back.
 */
interface OAuthReturn {
  receivedRedirectUri: string;
  /** The Link session this tab started, if it still has it. */
  resume: LinkResume | null;
}

function readOAuthReturn(): OAuthReturn | null {
  if (!new URLSearchParams(window.location.search).has('oauth_state_id')) {
    return null;
  }
  return {
    receivedRedirectUri: window.location.href,
    resume: readLinkResume(),
  };
}

export const Connections: React.FC = () => {
  const navigate = useNavigate();
  const [isLinkOpen, setIsLinkOpen] = useState(false);
  const [updateTarget, setUpdateTarget] = useState<UpdateTarget | undefined>();
  const { data: itemsData, isLoading } = useItems();

  // Coming back from an OAuth bank: reopen Link where it left off, or say that
  // it can't be (started in another tab, or expired).
  const [oauthReturn, setOauthReturn] = useState(readOAuthReturn);
  const resuming = oauthReturn?.resume ? oauthReturn : null;
  const couldNotResume = oauthReturn !== null && !oauthReturn.resume;

  const endOAuthReturn = () => {
    clearLinkResume();
    setOauthReturn(null);
    // Take the bank's state out of the address, so a refresh does not try again.
    void navigate({ to: '/settings/connections', search: {}, replace: true });
  };

  const items = itemsData?.items;

  const openLink = (target?: UpdateTarget) => {
    setUpdateTarget(target);
    setIsLinkOpen(true);
  };

  return (
    <>
      <div className="flex flex-col gap-6 px-4 lg:px-6">
        <PageHeader
          title="Your connections"
          description="Connect the banks and cards Opulus tracks."
          actions={
            <Button type="button" onClick={() => openLink()}>
              <Plus className="size-4" />
              Add connection
            </Button>
          }
        />

        {couldNotResume && (
          <div className="flex items-center justify-between gap-4 rounded-md border p-4 text-sm">
            <p>
              We couldn&apos;t finish connecting your bank: the connection was
              started in another tab or has expired. Add the connection again.
            </p>
            <Button type="button" variant="outline" onClick={endOAuthReturn}>
              Dismiss
            </Button>
          </div>
        )}

        <ConnectionList
          items={items}
          isLoading={isLoading}
          onUpdate={(itemId, mode) => openLink({ itemId, mode })}
        />
      </div>

      {resuming?.resume && (
        <LaunchLink
          itemId={resuming.resume.itemId}
          updateMode={resuming.resume.updateMode}
          resume={{
            linkToken: resuming.resume.linkToken,
            receivedRedirectUri: resuming.receivedRedirectUri,
          }}
          onClose={endOAuthReturn}
        />
      )}

      {isLinkOpen && (
        <LaunchLink
          // A new session for each target, so linking an institution we
          // already have starts the manage-accounts one cleanly.
          key={updateTarget?.itemId ?? 'new'}
          itemId={updateTarget?.itemId}
          updateMode={updateTarget?.mode}
          // The institution is already connected: choose its accounts instead.
          onDuplicate={(itemId) =>
            setUpdateTarget({ itemId, mode: 'add-accounts' })
          }
          onClose={() => {
            setIsLinkOpen(false);
            setUpdateTarget(undefined);
          }}
        />
      )}
    </>
  );
};
