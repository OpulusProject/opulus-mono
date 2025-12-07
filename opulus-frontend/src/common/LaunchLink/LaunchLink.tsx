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

interface LaunchLinkProps {
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
  onClose,
  onSuccess,
  onExit,
}) => {
  const {
    data: tokenData,
    isLoading: isLinkTokenLoading,
    isError: isLinkTokenError,
    error: linkTokenError,
  } = useLinkToken();

  // Default success handler
  const handleSuccess: PlaidLinkOnSuccess = (
    publicToken: string,
    metadata: PlaidLinkOnSuccessMetadata
  ) => {
    // Call custom success handler if provided
    onSuccess?.(publicToken, metadata);

    // Always close Link after success
    onClose();
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
