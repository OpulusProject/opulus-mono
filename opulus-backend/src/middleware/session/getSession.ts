import { auth } from "@/auth.js";
import { logger } from "@opulus/core";
import { fromNodeHeaders } from "better-auth/node";
import { IncomingHttpHeaders } from "http";

/**
 * Get the current session from Better Auth
 * @param headers - Request headers containing cookies/auth tokens
 * @returns Session data if authenticated, null otherwise
 */
export async function getSession(headers: IncomingHttpHeaders) {
  try {
    return await auth.api.getSession({
      headers: fromNodeHeaders(headers),
    });
  } catch (error) {
    // Log but don't throw - let the caller decide how to handle it
    logger.error(
      { error_message: error instanceof Error ? error.message : String(error) },
      "Error getting session"
    );
    return null;
  }
}
