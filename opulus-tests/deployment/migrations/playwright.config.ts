import { defineConfig } from "@playwright/test";

/**
 * Playwright config for the MIGRATIONS deployment suite.
 *
 *   DATABASE_URL=postgresql://... pnpm --filter @opulus/tests test:deployment-migrations
 *
 * Every spec creates a new, empty database on the server DATABASE_URL points
 * at, applies the migrations to it with the Prisma CLI exactly as the images
 * do on start, and drops it again. The database DATABASE_URL names is not
 * touched. The role needs permission to create databases.
 */
export default defineConfig({
  testDir: ".",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  timeout: 120_000,

  projects: [{ name: "migrations", testMatch: /.*\.spec\.ts$/ }],
});
