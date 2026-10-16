import type { UpdateMode } from '@/hooks/linkTokens/useLinkToken';

/**
 * What the page needs to pick Plaid Link up again after an OAuth bank has sent
 * the browser away to log in and back (to the Connections page). Link must be reopened with the same link
 * token, so it is kept here (in this tab only) while the user is away.
 */
export interface LinkResume {
  linkToken: string;
  /** Set when Link was in update mode for this item. */
  itemId?: string;
  updateMode?: UpdateMode;
}

const KEY = 'opulus.plaidLinkResume';

export function clearLinkResume(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}

/** The Link session to resume, if one was saved in this tab. */
export function readLinkResume(): LinkResume | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LinkResume>;
    return typeof parsed.linkToken === 'string' ? (parsed as LinkResume) : null;
  } catch {
    return null;
  }
}

/** Remember the Link session that is about to open. Storage can be blocked; that only loses the resume. */
export function saveLinkResume(resume: LinkResume): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(resume));
  } catch {
    // Without storage an OAuth bank cannot be resumed, other banks are unaffected.
  }
}
