/**
 * What each service needs in its environment to run in production. The config
 * module falls back to empty strings and localhost defaults so development
 * works with a small `.env`; in production those defaults are mistakes, and a
 * service that starts anyway fails later and further from the cause (a Plaid
 * call with no credentials, a session secret that is empty, Redis on localhost).
 * This checks them at startup, and the service refuses to start.
 */
export type ServiceName = "backend" | "webhooks" | "scheduler";

/** The shortest session secret accepted: Better Auth recommends 32 characters. */
const MIN_SECRET_LENGTH = 32;

/** What `.env.example` ships, which must never run in production. */
const PLACEHOLDER = /^replace-me/i;

type Env = Record<string, string | undefined>;

const present = (env: Env, name: string) => Boolean(env[name]?.trim());

const plaid = (env: Env): string[] => [
  ...["PLAID_CLIENT_ID", "PLAID_SECRET"].flatMap((name) =>
    !present(env, name) || PLACEHOLDER.test(env[name]!)
      ? [`${name} is not set`]
      : []
  ),
  ...(["sandbox", "production"].includes(env.PLAID_ENV ?? "")
    ? []
    : [
        `PLAID_ENV must be "sandbox" or "production" (it is "${env.PLAID_ENV ?? ""}")`,
      ]),
];

/**
 * The problems with an environment for a service, as sentences; empty when it
 * is fine. Pure: the environment is passed in, so it can be checked in a test.
 */
export function findConfigProblems(service: ServiceName, env: Env): string[] {
  const problems: string[] = [];

  if (!present(env, "DATABASE_URL")) problems.push("DATABASE_URL is not set");

  if (service === "backend") {
    const secret = env.BETTER_AUTH_SECRET ?? "";
    if (secret.length < MIN_SECRET_LENGTH || PLACEHOLDER.test(secret)) {
      problems.push(
        `BETTER_AUTH_SECRET must be a real secret of at least ${MIN_SECRET_LENGTH} characters (openssl rand -base64 32)`
      );
    }
    if (!present(env, "BETTER_AUTH_BASE_URL")) {
      problems.push("BETTER_AUTH_BASE_URL is not set");
    } else if (!env.BETTER_AUTH_BASE_URL!.startsWith("https://")) {
      problems.push(
        "BETTER_AUTH_BASE_URL must be an https:// URL in production"
      );
    }
    if (!present(env, "CLIENT_URL")) {
      problems.push(
        "CLIENT_URL is not set (it is the only origin allowed to call the API)"
      );
    }
    problems.push(...plaid(env));
  }

  if (service === "webhooks") {
    problems.push(...plaid(env));
  }

  if (service === "webhooks" || service === "scheduler") {
    if (!present(env, "REDIS_HOST")) {
      problems.push(
        "REDIS_HOST is not set (the default, localhost, is not Redis in production)"
      );
    }
  }

  return problems;
}

/**
 * Stop a service that is about to run in production with a bad environment:
 * logs every problem and exits with status 1, before it listens or connects to
 * anything. Does nothing outside production.
 */
export function assertRequiredConfig(
  service: ServiceName,
  env: Env = process.env
): void {
  if (env.NODE_ENV !== "production") return;

  const problems = findConfigProblems(service, env);
  if (problems.length === 0) return;

  console.error(
    `The ${service} service cannot start: its configuration is incomplete.\n` +
      problems.map((problem) => `  - ${problem}`).join("\n")
  );
  process.exit(1);
}
