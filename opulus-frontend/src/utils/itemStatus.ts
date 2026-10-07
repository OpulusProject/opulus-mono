import type { StatusVariant } from '@/components/ui';
import type { Notice } from '@/types/notice';

/**
 * Plaid Item error codes that are resolved by sending the user through Link's
 * update mode (reconnect). Sourced from https://plaid.com/docs/errors/item/.
 */
const RECONNECT_ERROR_CODES = new Set<string>([
  // User must re-authenticate at the institution.
  'ITEM_LOGIN_REQUIRED',
  'INVALID_CREDENTIALS',
  'INSUFFICIENT_CREDENTIALS',
  'INVALID_MFA',
  // User revoked access and must re-grant it via update mode.
  'USER_PERMISSION_REVOKED',
  'USER_ACCOUNT_REVOKED',
  'ACCESS_NOT_GRANTED',
  // Proactive: still working, but will stop soon unless the user re-auths.
  'PENDING_DISCONNECT',
  'PENDING_EXPIRATION',
]);

/**
 * Error codes where the problem is not something the user can fix via
 * reconnect (institution-side outages, permanent removals, etc.).
 */
const NON_RECONNECTABLE_ERROR_CODES = new Set<string>([
  'INSTITUTION_DOWN',
  'INSTITUTION_NOT_RESPONDING',
  'INSTITUTION_NO_LONGER_SUPPORTED',
  'ITEM_NOT_SUPPORTED',
  'NO_ACCOUNTS',
]);

export interface ItemStatus {
  variant: StatusVariant;
  label: string;
  inlineText: string | null;
  ctaLabel: string | null;
}

export function getItemStatus(errorCode: string | null): ItemStatus {
  if (!errorCode) {
    return {
      variant: 'online',
      label: 'Connected',
      inlineText: null,
      ctaLabel: null,
    };
  }

  // Yellow — item still working but will stop soon unless the user re-auths.
  if (
    errorCode === 'PENDING_DISCONNECT' ||
    errorCode === 'PENDING_EXPIRATION'
  ) {
    return {
      variant: 'degraded',
      label: 'Pending disconnect',
      inlineText: 'Pending disconnect',
      ctaLabel: 'Reconnect',
    };
  }

  // Red — reconnectable auth error (user action fixes it).
  if (RECONNECT_ERROR_CODES.has(errorCode)) {
    return {
      variant: 'offline',
      label: 'Login required',
      inlineText: 'Login required',
      ctaLabel: 'Reconnect',
    };
  }

  // Red — institution-side outage (user can't fix; just wait).
  if (
    errorCode === 'INSTITUTION_DOWN' ||
    errorCode === 'INSTITUTION_NOT_RESPONDING'
  ) {
    return {
      variant: 'offline',
      label: 'Institution unavailable',
      inlineText: 'Institution unavailable',
      ctaLabel: null,
    };
  }

  // Gray — no longer receiving data by design (unsupported / no_accounts).
  if (NON_RECONNECTABLE_ERROR_CODES.has(errorCode)) {
    return {
      variant: 'unknown',
      label: 'Not supported',
      inlineText: 'Not supported',
      ctaLabel: null,
    };
  }

  // Red — unknown error. Data has stopped; no deterministic remediation.
  return {
    variant: 'offline',
    label: 'Unknown error',
    inlineText: 'Unknown error',
    ctaLabel: null,
  };
}

/** The connection problem worth showing next to a row, or null if healthy. */
export function getStatusNotice(errorCode: string | null): Notice | null {
  const status = getItemStatus(errorCode);
  if (!status.inlineText) return null;

  return {
    text: status.inlineText,
    tone:
      status.variant === 'offline'
        ? 'danger'
        : status.variant === 'degraded'
          ? 'warning'
          : 'muted',
  };
}
