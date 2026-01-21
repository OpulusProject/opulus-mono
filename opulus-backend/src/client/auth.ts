import { config, prisma } from "@opulus/core";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { twoFactor } from "better-auth/plugins";

/**
 * Cookie Configuration for Cross-Subdomain Setup
 *
 * Our setup:
 * - Frontend: www.opulus.app
 * - Backend: api.opulus.app
 * - Webhooks: webhooks.opulus.app
 *
 * With crossSubDomainCookies, cookies are shared across all subdomains of opulus.app
 * This allows us to use SameSite=Lax (more secure than SameSite=None)
 */

const isProduction = config.nodeEnv === "production";

// Extract root domain from clientUrl (e.g., "https://www.opulus.app" -> ".opulus.app")
const getRootDomain = (url: string): string => {
  try {
    const urlObj = new URL(url);
    const parts = urlObj.hostname.split(".");
    // Get last two parts (e.g., "opulus.app") and add leading dot
    const rootDomain = parts.slice(-2).join(".");
    return `.${rootDomain}`;
  } catch {
    return ".opulus.app"; // Fallback
  }
};

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  secret: config.betterAuthSecret,
  baseURL: config.betterAuthBaseURL || `http://localhost:${config.port}`,
  basePath: "/api/auth",
  appName: "Opulus",
  plugins: [
    twoFactor({
      issuer: "Opulus",
    }),
  ],
  // Only allow requests from our frontend
  trustedOrigins: (() => {
    const clientUrl = config.clientUrl;
    if (!clientUrl) {
      console.warn(
        "⚠️  CLIENT_URL is not set. Better Auth origin validation may fail."
      );
      return [];
    }
    return [clientUrl];
  })(),
  advanced: {
    cookiePrefix: "opulus",
    crossSubDomainCookies: {
      enabled: true,
      // Must be ".opulus.app" (with leading dot) for cross-subdomain cookies to work
      domain: getRootDomain(config.clientUrl),
    },
    defaultCookieAttributes: {
      httpOnly: true,
      secure: true,
      // With crossSubDomainCookies, we can use SameSite=Lax (more secure than None)
      sameSite: "lax",
    },
  },
});

export type Session = typeof auth.$Infer.Session;
``;
