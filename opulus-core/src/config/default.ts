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

const config = {
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
  webhookUrl: getEnv("WEBHOOK_URL"),
  // Demo mode configuration
  demoMode: getEnv("DEMO_MODE", "false") === "true",
  demoPlaidClientId: getEnv("DEMO_PLAID_CLIENT_ID", ""),
  demoPlaidSecret: getEnv("DEMO_PLAID_SECRET", ""),
};

export default config;

/**
 * Check if we're running in demo mode
 * Can be set via DEMO_MODE env var or detected from hostname in middleware
 */
export const isDemoMode = (): boolean => {
  return config.demoMode;
};
