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
import { useCreateItem } from '@/hooks/plaid/useCreateItem';
import { type UpdateMode, useLinkToken } from '@/hooks/plaid/useLinkToken';
import { useUpdateItemAccounts } from '@/hooks/plaid/useUpdateItemAccounts';

interface LaunchLinkProps {
  /**
   * Existing item id. When set, Link opens in update mode for that item.
   */
  itemId?: string;
  /**
   * Update-mode flavor (only meaningful when `itemId` is set).
   * Defaults to `reconnect` (standard repair flow).
   */
  updateMode?: UpdateMode;
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
  updateMode,
  onClose,
  onSuccess,
  onExit,
}) => {
  const {
    data: tokenData,
    isLoading: isLinkTokenLoading,
    isError: isLinkTokenError,
    error: linkTokenError,
  } = useLinkToken(itemId, updateMode);
  const createItem = useCreateItem();
  const updateItemAccounts = useUpdateItemAccounts();

  const handleSuccess: PlaidLinkOnSuccess = (
    publicToken: string,
    metadata: PlaidLinkOnSuccessMetadata
  ) => {
    onSuccess?.(publicToken, metadata);

    if (itemId) {
      updateItemAccounts.mutate(itemId, {
        onError: (error) =>
          console.error('Failed to update item accounts:', error),
        onSettled: onClose,
      });
      return;
    }

    if (!metadata.institution?.institution_id) {
      console.error(
        'Plaid Link onSuccess returned no institution_id; skipping create.'
      );
      onClose();
      return;
    }

    createItem.mutate(
      {
        publicToken,
        institutionId: metadata.institution.institution_id,
      },
      {
        onSuccess: (result) => {
          if (result.data.duplicate) {
            console.info(
              result.message ??
                'This institution is already linked to your account.'
            );
          }
        },
        onError: (error) => console.error('Failed to create item:', error),
        onSettled: onClose,
      }
    );
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
