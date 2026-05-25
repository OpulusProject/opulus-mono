import { auth } from "@/client/auth.js";
import { IncomingHttpHeaders } from "http";
import { config } from "@opulus/core";

/**
 * Get the current session from Better Auth
 * In demo mode, returns a mock session without checking authentication
 * @param headers - Request headers containing cookies/auth tokens
 * @param isDemoMode - Optional flag to force demo mode (from request context)
 * @returns Session data if authenticated, null otherwise (or mock session in demo mode)
 */
export async function getSession(
  headers: IncomingHttpHeaders,
  isDemoMode?: boolean
) {
  // Check if we're in demo mode
  const demoMode = isDemoMode ?? config.demoMode;
  
  if (demoMode) {
    // Return mock session for demo mode
    return {
      user: {
        id: "demo-user-id",
        email: "demo@opulus.app",
        name: "Demo User",
        emailVerified: true,
        image: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      session: {
        id: "demo-session-id",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    };
  }

  try {
    const session = await auth.api.getSession({
      headers: headers as any,
    });

    return session;
  } catch (error) {
    // Log error but don't throw - let caller decide how to handle
    console.error("[SESSION] Error getting session:", error);
    return null;
  }
}
