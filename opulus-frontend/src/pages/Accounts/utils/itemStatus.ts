import type { StatusVariant } from '@/components/ui';

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
  needsReconnect: boolean;
}

export function getItemStatus(errorCode: string | null): ItemStatus {
  if (!errorCode) {
    return { variant: 'online', label: 'Connected', needsReconnect: false };
  }

  if (
    errorCode === 'PENDING_DISCONNECT' ||
    errorCode === 'PENDING_EXPIRATION'
  ) {
    return {
      variant: 'degraded',
      label: 'Reconnect soon',
      needsReconnect: true,
    };
  }

  if (RECONNECT_ERROR_CODES.has(errorCode)) {
    return {
      variant: 'offline',
      label: 'Reconnect required',
      needsReconnect: true,
    };
  }

  if (
    errorCode === 'INSTITUTION_DOWN' ||
    errorCode === 'INSTITUTION_NOT_RESPONDING'
  ) {
    return {
      variant: 'maintenance',
      label: 'Institution unavailable',
      needsReconnect: false,
    };
  }

  if (NON_RECONNECTABLE_ERROR_CODES.has(errorCode)) {
    return {
      variant: 'offline',
      label: 'Not supported',
      needsReconnect: false,
    };
  }

  return { variant: 'unknown', label: 'Error', needsReconnect: false };
}
