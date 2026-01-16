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
  clientUrl: getEnv("CLIENT_URL",),
  databaseUrl: getEnv("DATABASE_URL"),
  plaidClientId: getEnv("PLAID_CLIENT_ID"),
  plaidSecret: getEnv("PLAID_SECRET"),
  plaidEnv: getEnv("PLAID_ENV", "sandbox"),
  plaidVersion: getEnv("PLAID_VERSION", "2020-09-14"),
  betterAuthSecret: getEnv("BETTER_AUTH_SECRET"),
  betterAuthBaseURL: getEnv("BETTER_AUTH_BASE_URL"),
  plaidWebhookUrl: getEnv("PLAID_WEBHOOK_URL"),
};
