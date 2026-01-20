import { config, prisma } from "@opulus/core";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { twoFactor } from "better-auth/plugins";

// Determine if we need SameSite=None for cookies
// In production: always cross-origin (frontend and backend on different Railway subdomains)
// In development: same-origin (localhost), so SameSite=Lax is more secure
const needsSameSiteNone = config.nodeEnv === "production";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
  },
  session: {
    // Session lasts 7 days
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    // Refresh session if user was active within last day
    updateAge: 60 * 60 * 24, // 1 day
  },
  secret: config.betterAuthSecret,
  baseURL: config.betterAuthBaseURL || `http://localhost:${config.port}`,
  basePath: "/api/auth",
  appName: "Opulus", // Used as issuer for TOTP
  plugins: [
    twoFactor({
      issuer: "Opulus", // Display name in authenticator apps
    }),
  ],
  // Trusted origins: only the frontend client URL
  // Bruno sends Origin header matching the client URL (simulating browser behavior)
  // Ensure clientUrl is properly trimmed and not empty
  trustedOrigins: (() => {
    const clientUrl = config.clientUrl?.trim();
    if (!clientUrl) {
      console.warn(
        "⚠️  CLIENT_URL is not set. Better Auth origin validation may fail."
      );
      return [];
    }

    return [clientUrl];
  })(),
  // Advanced cookie configuration for cross-origin support
  // Reference: https://www.better-auth.com/docs/concepts/cookies
  // Note: crossSubDomainCookies won't work here because frontend and backend
  // are on different Railway subdomains (not subdomains of YOUR domain)
  // We must use SameSite=None + Secure=true for cross-origin cookies
  advanced: {
    // Remove __Secure- prefix - it can cause issues with cross-origin cookies
    // The prefix requires strict host matching which doesn't work across different Railway subdomains
    cookiePrefix: "better-auth",
    // Force secure cookies (required for SameSite=None)
    useSecureCookies: true,
    // Default cookie attributes for ALL cookies (including temporary 2FA cookies)
    // This is critical - Better Auth creates temporary cookies during 2FA flow
    // that need the same cross-origin settings as session_token
    defaultCookieAttributes: {
      secure: true, // Required for SameSite=None
      sameSite: needsSameSiteNone ? "none" : "lax", // "none" for production (cross-origin), "lax" for development (same-origin)
      // Don't set domain - let browser handle it (important for Railway subdomains)
      // Setting domain would try to set cookies for Railway's domain which won't work
    },
    // Explicitly configure session_token cookie
    // Only specify httpOnly here since secure and sameSite are already in defaultCookieAttributes
    cookies: {
      session_token: {
        attributes: {
          httpOnly: true, // Security: prevent JavaScript access (not in defaultCookieAttributes)
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
``;
