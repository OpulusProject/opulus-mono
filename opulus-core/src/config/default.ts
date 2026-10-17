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
  // Requests per minute: one IP address across the API, and one signed-in user
  // for reads (GET) and, separately, for writes (every other method). Writes are
  // the requests that call Plaid or change data, so their limit is the low one.
  rateLimitPerIp: parseInt(getEnv("RATE_LIMIT_PER_IP", "600"), 10),
  rateLimitReadsPerUser: parseInt(
    getEnv("RATE_LIMIT_READS_PER_USER", "300"),
    10
  ),
  rateLimitWritesPerUser: parseInt(
    getEnv("RATE_LIMIT_WRITES_PER_USER", "10"),
    10
  ),
  // Requests per minute the webhook receiver accepts from one IP address. They
  // are counted before the signature is checked, which calls Plaid.
  webhookRateLimitPerIp: parseInt(
    getEnv("WEBHOOK_RATE_LIMIT_PER_IP", "120"),
    10
  ),
  // Where the counters live: "redis" (REDIS_HOST and friends) so every instance
  // of the backend counts together, or in memory (the default), where each
  // instance counts for itself.
  rateLimitUsesRedis: getEnv("RATE_LIMIT_STORE") === "redis",
  // Where Plaid sends the user back after logging in at an OAuth bank: a page
  // on our frontend (for example https://www.opulus.app/settings/connections) that
  // must be registered under Allowed redirect URIs in the Plaid dashboard.
  // Without it OAuth institutions cannot complete Link; leave it unset and no
  // redirect is offered.
  plaidRedirectUri: getEnv("PLAID_REDIRECT_URI"),
  // Point the Plaid client at another server (a stub in the service tests).
  // Unset uses PLAID_ENV's real one.
  plaidBaseUrl: getEnv("PLAID_BASE_URL"),
  // Frankfurter (the European Central Bank's daily rates). Point it elsewhere
  // to use another deployment of Frankfurter, or a stub in tests.
  frankfurterBaseUrl: getEnv(
    "FRANKFURTER_BASE_URL",
    "https://api.frankfurter.dev/v1"
  ),
  // 32 bytes, base64. Encrypts Plaid access tokens at rest; see utils/itemTokenCrypto.ts.
  itemTokenEncryptionKey: getEnv("ITEM_TOKEN_ENCRYPTION_KEY"),
};
