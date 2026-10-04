import React, { useEffect } from 'react';

import { useLinkToken } from '@/hooks/plaid/useLinkToken';

interface LaunchLinkProps {
  /**
   * Existing item id. When set, Link opens in update mode for that item.
   */
  itemId?: string;
  /**
   * Called if we fail to obtain a hosted Link URL (network / Plaid error).
   * The caller is expected to close its "linking" UI state.
   */
  onError?: (error: Error) => void;
}

/**
 * LaunchLink
 *
 * Opulus uses Plaid Hosted Link. The browser is redirected to Plaid's hosted
 * UI; the public_token is delivered server-side to our webhook
 * (ITEM_ADD_RESULT), and the user is redirected back to `${CLIENT_URL}/accounts`
 * when the session completes. There is no `onSuccess` / `onExit` callback —
 * those only exist for the embedded (`react-plaid-link`) flow.
 *
 * Render this component conditionally when the user clicks "Add Account" or
 * "Reconnect". It mounts, requests a link token, and performs a full-page
 * navigation to Plaid as soon as the token is ready.
 */
export const LaunchLink: React.FC<LaunchLinkProps> = ({ itemId, onError }) => {
  const { data, isError, error } = useLinkToken(itemId);

  useEffect(() => {
    if (isError) {
      onError?.(error ?? new Error('Failed to create Plaid Link token'));
      return;
    }
    if (data?.hostedLinkUrl) {
      window.location.assign(data.hostedLinkUrl);
    }
  }, [data?.hostedLinkUrl, isError, error, onError]);

  return null;
};
