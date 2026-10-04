import { useQueryClient } from '@tanstack/react-query';
import React, { useEffect } from 'react';
import {
  PlaidLinkError,
  PlaidLinkOnEvent,
  PlaidLinkOnEventMetadata,
  PlaidLinkOnExit,
  PlaidLinkOnExitMetadata,
  PlaidLinkOnSuccess,
  PlaidLinkOnSuccessMetadata,
  PlaidLinkOptionsWithLinkToken,
  PlaidLinkStableEvent,
  usePlaidLink,
} from 'react-plaid-link';

import { useLinkToken } from '@/hooks/plaid/useLinkToken';
import { apiClient } from '@/lib/api/client';

interface LaunchLinkProps {
  /**
   * Existing item id. When set, Link opens in update mode for that item.
   */
  itemId?: string;
  /**
   * Callback when Link is closed (successfully or with error)
   */
  onClose: () => void;
  /**
   * Callback when user successfully links an account
   * @param publicToken - Public token to exchange for access token
   * @param metadata - Metadata about the linked account
   */
  onSuccess?: (
    publicToken: string,
    metadata: PlaidLinkOnSuccessMetadata
  ) => void;
  /**
   * Callback when user exits Link without completing
   * @param error - Error if any occurred
   * @param metadata - Metadata about the exit
   */
  onExit?: (
    error: PlaidLinkError | null,
    metadata: PlaidLinkOnExitMetadata
  ) => void;
}

/**
 * LaunchLink Component
 *
 * Handles Plaid Link initialization and opening.
 * Follows Plaid best practices:
 * - Only opens Link when token is ready
 * - Handles loading and error states
 * - Provides callbacks for success/exit events
 * - Automatically opens Link when ready
 *
 * @example
 * ```tsx
 * <LaunchLink
 *   onClose={() => setIsOpen(false)}
 *   onSuccess={(publicToken, metadata) => {
 *     // Exchange public token for access token
 *   }}
 * />
 * ```
 */
export const LaunchLink: React.FC<LaunchLinkProps> = ({
  itemId,
  onClose,
  onSuccess,
  onExit,
}) => {
  const queryClient = useQueryClient();
  const {
    data: tokenData,
    isLoading: isLinkTokenLoading,
    isError: isLinkTokenError,
    error: linkTokenError,
  } = useLinkToken(itemId);

  // Default success handler.
  //
  // Plaid does not fire a webhook for the completion of a standard embedded
  // Link session (we removed Multi-Item Link + ITEM_ADD_RESULT), so the
  // onSuccess callback is the authoritative signal to persist/refresh server
  // state. There are two cases:
  //
  //   1. New item (no `itemId` prop):   POST /api/plaid/items { publicToken }
  //      Backend exchanges the public_token for an access_token and persists
  //      the Item + its initial accounts. Idempotent on plaidItemId.
  //
  //   2. Update mode (itemId present):  POST /api/plaid/items/:id/sync-accounts
  //      Access token didn't change (per Plaid's update-mode docs), so we
  //      don't exchange anything — we just reconcile the account set. Safe
  //      no-op for pure reconnects, and the only way the backend learns
  //      about new accounts picked up in an "add accounts" session.
  const handleSuccess: PlaidLinkOnSuccess = (
    publicToken: string,
    metadata: PlaidLinkOnSuccessMetadata
  ) => {
    onSuccess?.(publicToken, metadata);

    const persist = itemId
      ? apiClient.post(`/api/plaid/items/${itemId}/sync-accounts`)
      : apiClient.post('/api/plaid/items', { publicToken });

    void persist
      .catch((error: unknown) => {
        // TODO: surface a toast + retry UI. For now, log so the user can
        // report; the publicToken is already lost from Plaid's side so a
        // one-shot server failure requires the user to re-link.
        console.error('Failed to persist Plaid Link result:', error);
      })
      .finally(() => {
        void queryClient.invalidateQueries({ queryKey: ['items'] });
        onClose();
      });
  };

  // Default exit handler
  const handleExit: PlaidLinkOnExit = (
    error: PlaidLinkError | null,
    metadata: PlaidLinkOnExitMetadata
  ) => {
    // Call custom exit handler if provided
    onExit?.(error, metadata);

    // Always close Link after exit
    onClose();
  };

  // Event handler for Link events (for analytics/logging)
  const handleEvent: PlaidLinkOnEvent = (
    eventName: PlaidLinkStableEvent | string,
    metadata: PlaidLinkOnEventMetadata
  ) => {
    // Log events for debugging/analytics
    // TODO: Implement proper event logging
    console.log('Plaid Link Event:', eventName, metadata);
  };

  // Configure Plaid Link
  const config: PlaidLinkOptionsWithLinkToken = {
    token: tokenData?.linkToken || null,
    onSuccess: handleSuccess,
    onExit: handleExit,
    onEvent: handleEvent,
  };

  // Initialize Plaid Link hook
  const { open, ready } = usePlaidLink(config);

  // Open Link when ready and token is available
  useEffect(() => {
    if (ready && tokenData?.linkToken) {
      open();
    }
  }, [ready, tokenData?.linkToken, open]);

  // Handle loading state
  if (isLinkTokenLoading) {
    return null; // Or return a loading spinner if desired
  }

  // Handle error state
  if (isLinkTokenError) {
    console.error('Failed to create link token:', linkTokenError);
    // Close immediately on error
    onClose();
    return null;
  }

  // Component doesn't render anything visible
  // Plaid Link opens as a modal overlay
  return null;
};
