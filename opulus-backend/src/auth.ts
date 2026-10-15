import { disconnectUserItems } from "@/services/items/disconnectUserItems.js";
import { passkey } from "@better-auth/passkey";
import { AppError, config, prisma } from "@opulus/core";
import { betterAuth } from "better-auth";
import {
  APIError,
  createAuthMiddleware,
  getSessionFromCtx,
} from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { haveIBeenPwned, twoFactor } from "better-auth/plugins";

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
  // better-auth's account table is our AuthAccount model (see schema.prisma)
  account: {
    modelName: "authAccount",
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    // How recently a sign-in counts as "fresh". Adding a passkey needs a fresh
    // session, so that a stolen cookie cannot enroll the thief's device.
    freshAge: 60 * 5, // 5 minutes
  },
  secret: config.betterAuthSecret,
  baseURL: config.betterAuthBaseURL || `http://localhost:${config.port}`,
  basePath: "/api/auth",
  appName: "Opulus",
  // Account deletion (POST /api/auth/delete-user). The user's rows go with the
  // user (every relation cascades); beforeDelete first removes their items from
  // Plaid, which would otherwise keep the connections. If Plaid refuses any, the
  // delete is refused (502) and nothing is deleted, so it can be tried again.
  user: {
    deleteUser: {
      enabled: true,
      beforeDelete: async (user) => {
        try {
          await disconnectUserItems({ userId: user.id });
        } catch (error) {
          if (error instanceof AppError) {
            throw APIError.from("BAD_GATEWAY", {
              message: error.message,
              code: error.code ?? "PLAID_DISCONNECT_FAILED",
            });
          }
          throw error;
        }
      },
    },
  },
  hooks: {
    // Better Auth deletes an account without a password when the session is
    // "fresh", and a session stays fresh for a day. Deleting an account is the
    // end of the data, so it always takes the password.
    before: createAuthMiddleware(async (ctx) => {
      // Changing the password signs every other device out. Better Auth only
      // does so when the caller asks, and a stolen session should not survive
      // the password being changed, so it is always on.
      if (ctx.path === "/change-password") {
        return {
          context: { ...ctx, body: { ...ctx.body, revokeOtherSessions: true } },
        };
      }

      if (ctx.path !== "/delete-user" || ctx.body?.password) return;
      // Let the endpoint answer 401 for callers who are not signed in.
      if (!(await getSessionFromCtx(ctx))) return;
      throw new APIError("BAD_REQUEST", {
        message: "Password is required to delete your account",
        code: "PASSWORD_REQUIRED",
      });
    }),
  },
  // Throttle guessing: sign-in, sign-up and the two-factor codes get tight
  // limits per client address, everything else the default. Counted in our
  // database (the rate_limit table), so every backend instance shares them.
  // Windows are in seconds.
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 3600, max: 10 },
      "/two-factor/verify-totp": { window: 60, max: 5 },
      "/two-factor/verify-backup-code": { window: 60, max: 5 },
      "/change-password": { window: 60, max: 5 },
      "/passkey/generate-authenticate-options": { window: 60, max: 20 },
      "/passkey/verify-authentication": { window: 60, max: 10 },
      "/passkey/verify-registration": { window: 60, max: 10 },
    },
  },
  plugins: [
    twoFactor({
      issuer: "Opulus",
    }),
    // Passkeys (WebAuthn): sign in with a device's own unlock instead of a
    // password. The relying party is the site's registrable domain, so a passkey
    // made on www.opulus.app also works on api.opulus.app and the other
    // subdomains, and the origin is the frontend. A passkey must be used with
    // user verification (PIN, fingerprint, face): that is what makes it a
    // second factor and not just something that is possessed.
    passkey({
      rpID: getRootDomain(config.clientUrl).replace(/^\./, ""),
      rpName: "Opulus",
      origin: config.clientUrl,
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "required",
      },
      authentication: {
        afterVerification: async ({ verification }) => {
          if (!verification.authenticationInfo.userVerified) {
            throw new APIError("UNAUTHORIZED", {
              message: "The passkey was used without user verification",
              code: "USER_VERIFICATION_REQUIRED",
            });
          }
        },
      },
    }),
    // Refuse a password found in a known breach, at sign-up and on a password
    // change. Only the first five characters of the password's SHA-1 hash leave
    // the server (Have I Been Pwned's k-anonymity range API). If that service
    // cannot be reached the request fails (500) rather than letting the
    // password through unchecked.
    haveIBeenPwned({ enabled: config.breachedPasswordCheck }),
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
