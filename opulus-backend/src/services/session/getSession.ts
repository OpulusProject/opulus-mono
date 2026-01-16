import { auth } from "@/client/auth.js";
import { IncomingHttpHeaders } from "http";

/**
 * Get the current session from Better Auth
 * @param headers - Request headers containing cookies/auth tokens
 * @returns Session data if authenticated, null otherwise
 */
export async function getSession(headers: IncomingHttpHeaders) {
  try {
    // Log cookie presence for debugging
    const cookieHeader = headers.cookie;
    if (!cookieHeader) {
      console.log("[SESSION] No cookies found in request headers");
    } else {
      console.log(
        "[SESSION] Cookies present:",
        cookieHeader.substring(0, 100) + "..."
      );
    }

    const session = await auth.api.getSession({
      headers: headers as any,
    });

    if (!session) {
      console.log("[SESSION] No session found");
    } else {
      console.log("[SESSION] Session found for user:", session.user?.id);
    }

    return session;
  } catch (error) {
    // Log error for debugging but don't throw - let caller decide how to handle
    console.error("[SESSION] Error getting session:", error);
    return null;
  }
}
