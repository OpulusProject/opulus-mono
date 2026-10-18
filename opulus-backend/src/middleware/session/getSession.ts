import { auth } from "@/auth.js";
import { fromNodeHeaders } from "better-auth/node";
import { IncomingHttpHeaders } from "http";

/**
 * Get the current session from Better Auth
 * @param headers - Request headers containing cookies/auth tokens
 * @returns Session data if authenticated, null otherwise. A failure to look the
 *   session up (rather than no session to find) is thrown, so it is answered as
 *   a server error and does not look like a signed-out user.
 */
export async function getSession(headers: IncomingHttpHeaders) {
  return auth.api.getSession({
    headers: fromNodeHeaders(headers),
  });
}
