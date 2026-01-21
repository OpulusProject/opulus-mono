import { config, prisma } from "@opulus/core";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { twoFactor } from "better-auth/plugins";

/**
 * Cookie Configuration for Cross-Origin Setup
 *
 * Our setup:
 * - Frontend: opulusfrontend-production.up.railway.app
 * - Backend: opulusbackend-production.up.railway.app
 * - These are DIFFERENT domains (cross-origin)
 *
 * For cross-origin cookies to work, we MUST use:
 * - SameSite=None (allows cookies across different domains)
 * - Secure=true (required when SameSite=None)
 * - credentials: 'include' on client (sends cookies with requests)
 */

const isProduction = config.nodeEnv === "production";

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
      domain: config.clientUrl.split("://")[1],
    },
    defaultCookieAttributes: {
      httpOnly: true,
      secure: true,
    },
  },
});

export type Session = typeof auth.$Infer.Session;
``;
