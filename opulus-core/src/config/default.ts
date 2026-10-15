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
  // Key for Better Auth's infrastructure (audit logs of sign-ins and other
  // auth events). Optional: without it the plugin is not added.
  betterAuthApiKey: getEnv("BETTER_AUTH_API_KEY"),
  plaidWebhookUrl: getEnv("PLAID_WEBHOOK_URL"),
  // Frankfurter (the European Central Bank's daily rates). Point it elsewhere
  // to use another deployment of Frankfurter, or a stub in tests.
  frankfurterBaseUrl: getEnv(
    "FRANKFURTER_BASE_URL",
    "https://api.frankfurter.dev/v1"
  ),
};
