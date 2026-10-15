import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

import { LaunchLink } from '@/common/LaunchLink/LaunchLink';
import {
  clearLinkResume,
  readLinkResume,
} from '@/common/LaunchLink/linkResume';
import { Page } from '@/common/Page';
import { Button } from '@/components/ui';

/**
 * Where an OAuth bank sends the user back after they log in there. Plaid Link
 * is reopened with the link token it started with, which was kept in this tab,
 * and the address the bank sent the browser to (that address carries the state
 * Link needs to finish). When it is done the user goes back to their
 * connections.
 */
export const OAuthRedirect: React.FC = () => {
  const navigate = useNavigate();
  // Read once: Link clears it as soon as it finishes.
  const [resume] = useState(readLinkResume);

  const backToConnections = () => {
    clearLinkResume();
    void navigate({ to: '/settings/connections' });
  };

  if (!resume) {
    return (
      <Page
        title="Connecting your bank"
        description="This link can no longer be used."
      >
        <p className="text-muted-foreground text-sm">
          The connection was started in another tab or has expired. Start again
          from your connections.
        </p>
        <Button className="mt-4" onClick={backToConnections}>
          Go to connections
        </Button>
      </Page>
    );
  }

  return (
    <Page
      title="Connecting your bank"
      description="Finishing the connection with your bank…"
    >
      <LaunchLink
        itemId={resume.itemId}
        updateMode={resume.updateMode}
        resume={{
          linkToken: resume.linkToken,
          receivedRedirectUri: window.location.href,
        }}
        onClose={backToConnections}
      />
    </Page>
  );
};
