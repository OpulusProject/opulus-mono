import * as React from 'react';

import { useSession } from '@/hooks/auth/useSession';

/** From this width (px) the sidebar starts open; below it, as icons only. */
const WIDE_QUERY = '(min-width: 1024px)';
const LAST_USER_KEY = 'opulus:sidebar-last-user';

function read(key: string): boolean | undefined {
  try {
    const value = window.localStorage.getItem(key);
    return value === null ? undefined : value === 'true';
  } catch {
    return undefined;
  }
}

function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage is blocked; the choice just won't be remembered.
  }
}

function subscribeToWidth(onChange: () => void) {
  const query = window.matchMedia(WIDE_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

/**
 * Whether the sidebar is open, and a way to change it, remembered per account
 * and per screen size: a wide screen and a narrow one each keep their own
 * choice, so opening it on a desktop does not open it on a tablet. With no
 * choice made yet it is open on a wide screen and icons only on a narrow one.
 *
 * The choice is read from storage on each render rather than kept in state, so
 * it follows the account and the screen size when either changes.
 */
export function useSidebarPreference() {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const isWide = React.useSyncExternalStore(
    subscribeToWidth,
    () => window.matchMedia(WIDE_QUERY).matches
  );

  // The session loads after the first render on a fresh page load; until it
  // does, use whoever was signed in last so the sidebar does not flash open.
  React.useEffect(() => {
    if (userId) write(LAST_USER_KEY, userId);
  }, [userId]);
  let owner = userId;
  if (!owner) {
    try {
      owner = window.localStorage.getItem(LAST_USER_KEY) ?? undefined;
    } catch {
      owner = undefined;
    }
  }

  const key = `opulus:sidebar-open:${owner ?? 'signed-out'}:${
    isWide ? 'wide' : 'narrow'
  }`;
  const [, rerender] = React.useReducer((count: number) => count + 1, 0);

  const open = read(key) ?? isWide;
  const setOpen = React.useCallback(
    (value: boolean) => {
      write(key, String(value));
      rerender();
    },
    [key]
  );

  return { open, setOpen };
}
