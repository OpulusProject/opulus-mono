// Helper to strip quotes from env vars (dotenv-cli sometimes includes them)
const getEnv = (key: string, defaultValue: string = ""): string => {
  const value = process.env[key] || defaultValue;
  // Remove surrounding quotes if present
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
};

export default {
  port: parseInt(process.env.PORT || "8080", 10),
  nodeEnv: getEnv("NODE_ENV", "development"),
  clientUrl: getEnv("CLIENT_URL", "http://localhost:5173"),
  databaseUrl: getEnv("DATABASE_URL"),
  plaidClientId: getEnv("PLAID_CLIENT_ID"),
  plaidSecret: getEnv("PLAID_SECRET"),
  plaidEnv: getEnv("PLAID_ENV", "sandbox"),
  plaidVersion: getEnv("PLAID_VERSION", "2020-09-14"),
  betterAuthSecret: getEnv("BETTER_AUTH_SECRET"),
  betterAuthBaseURL: getEnv("BETTER_AUTH_BASE_URL"),
  // Every user must have two-factor authentication set up before the API serves
  // them anything but their session. On unless REQUIRE_TWO_FACTOR is "false"
  // (for local development of a frontend that cannot enroll yet).
  requireTwoFactor: getEnv("REQUIRE_TWO_FACTOR", "true") !== "false",
  // Reject passwords that appear in known breaches (Have I Been Pwned) at
  // sign-up and password change. On unless BREACHED_PASSWORD_CHECK is "off";
  // the service test suite turns it off because it makes no third-party calls.
  breachedPasswordCheck: getEnv("BREACHED_PASSWORD_CHECK", "on") !== "off",
  plaidWebhookUrl: getEnv("PLAID_WEBHOOK_URL"),
  // Requests per minute: one IP address across the API, and one user on the
  // routes that call Plaid (link tokens, connecting, refreshing).
  rateLimitPerIp: parseInt(getEnv("RATE_LIMIT_PER_IP", "600"), 10),
  rateLimitPlaidPerUser: parseInt(
    getEnv("RATE_LIMIT_PLAID_PER_USER", "10"),
    10
  ),
  // Where the counters live: "redis" (REDIS_HOST and friends) so every instance
  // of the backend counts together, or in memory (the default), where each
  // instance counts for itself.
  rateLimitUsesRedis: getEnv("RATE_LIMIT_STORE") === "redis",
  // Frankfurter (the European Central Bank's daily rates). Point it elsewhere
  // to use another deployment of Frankfurter, or a stub in tests.
  frankfurterBaseUrl: getEnv(
    "FRANKFURTER_BASE_URL",
    "https://api.frankfurter.dev/v1"
  ),
};
