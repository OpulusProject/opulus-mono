import { isIP } from "node:net";

/**
 * Where the session cookie is valid, and the passkey relying party that goes
 * with it.
 *
 * - `domain` set: the cookie is shared by every subdomain of it (for example
 *   ".opulus.app" for www., api. and webhooks.opulus.app), and passkeys are
 *   made for that domain.
 * - `domain` null: a host-only cookie, sent back only to the host that set it,
 *   and passkeys made for the client's own hostname. For a single hostname that
 *   serves both the frontend and the API, such as a Tailscale name
 *   (opulus.tail1234.ts.net) or an IP address on a home network.
 */
export type CookieScope = { domain: string | null; rpID: string };

/** COOKIE_DOMAIN value for a host-only cookie. */
export const HOST_ONLY = "host";

const FALLBACK: CookieScope = { domain: ".opulus.app", rpID: "opulus.app" };

/**
 * The cookie scope for a client URL and the COOKIE_DOMAIN setting:
 * - unset: the last two labels of the client's hostname
 *   ("https://www.opulus.app" -> ".opulus.app"), or host-only when the
 *   hostname is an IP address, where that would not be a domain at all;
 * - "host": host-only;
 * - anything else: that domain ("opulus.app" or ".opulus.app").
 *
 * The last two labels are wrong wherever the registrable domain is longer
 * (*.ts.net, *.co.uk): the browser refuses a cookie for "ts.net". Set
 * COOKIE_DOMAIN there.
 */
export function getCookieScope(
  clientUrl: string,
  cookieDomain: string = ""
): CookieScope {
  const setting = cookieDomain.trim().toLowerCase();

  if (setting && setting !== HOST_ONLY) {
    const bare = setting.replace(/^\./, "");
    return { domain: `.${bare}`, rpID: bare };
  }

  let hostname: string;
  try {
    hostname = new URL(clientUrl).hostname;
  } catch {
    return FALLBACK;
  }

  // URL keeps the brackets around an IPv6 address.
  if (setting === HOST_ONLY || isIP(hostname.replace(/^\[|\]$/g, ""))) {
    return { domain: null, rpID: hostname };
  }

  const root = hostname.split(".").slice(-2).join(".");
  return { domain: `.${root}`, rpID: root };
}
