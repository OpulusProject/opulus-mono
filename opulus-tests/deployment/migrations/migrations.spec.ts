import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { PrismaClient } from "@opulus/core";
import { expect, test } from "@playwright/test";

const run = promisify(execFile);
const core = path.resolve(process.cwd(), "../opulus-core");
const prisma = path.join(core, "node_modules/.bin/prisma");

/** The server DATABASE_URL points at, with another database name. */
function urlFor(database: string): string {
  const url = new URL(process.env.DATABASE_URL ?? "");
  url.pathname = `/${database}`;
  return url.toString();
}

/** Run the Prisma CLI in opulus-core against a database; its output and exit code. */
async function prismaCli(args: string[], databaseUrl: string) {
  try {
    const { stdout, stderr } = await run(prisma, [...args], {
      cwd: core,
      env: { ...process.env, DATABASE_URL: databaseUrl },
    });
    return { code: 0, output: stdout + stderr };
  } catch (error) {
    const failed = error as { code?: number; stdout?: string; stderr?: string };
    return { code: failed.code ?? 1, output: (failed.stdout ?? "") + (failed.stderr ?? "") };
  }
}

/**
 * This file: the migrations apply cleanly to an empty database, as a new
 * environment (or a deploy) applies them, and they leave exactly the schema
 * prisma/schema.prisma describes. A migration that fails halfway, or a change
 * to the schema file without a migration for it, shows up here and not on
 * deploy.
 */
test.describe("database migrations", () => {
  const database = `opulus_migrations_${Date.now()}`;
  const url = urlFor(database);
  const schema = "--schema=./prisma/schema.prisma";
  let admin: PrismaClient;

  test.beforeAll(async () => {
    expect(process.env.DATABASE_URL, "DATABASE_URL must point at a Postgres server").toBeTruthy();
    admin = new PrismaClient({ datasources: { db: { url: urlFor("postgres") } } });
    await admin.$executeRawUnsafe(`CREATE DATABASE ${database}`);
  });

  test.afterAll(async () => {
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
    await admin.$disconnect();
  });

  test("applies every migration to an empty database", async () => {
    // Act
    const result = await prismaCli(["migrate", "deploy", schema], url);

    // Assert
    expect(result.output).toContain("All migrations have been successfully applied");
    expect(result.code).toBe(0);
  });

  test("reports the database as up to date, and a second deploy has nothing to do", async () => {
    // Act
    const status = await prismaCli(["migrate", "status", schema], url);
    const again = await prismaCli(["migrate", "deploy", schema], url);

    // Assert
    expect(status.output).toContain("Database schema is up to date");
    expect(again.output).toContain("No pending migrations to apply");
    expect(again.code).toBe(0);
  });

  test("leaves exactly the schema in schema.prisma", async () => {
    // Act: compare the migrated database with the schema file (exit code 2 means a difference).
    const drift = await prismaCli(
      ["migrate", "diff", "--from-url", url, "--to-schema-datamodel", "./prisma/schema.prisma", "--exit-code"],
      url,
    );

    // Assert
    expect(drift.output).toContain("No difference detected");
    expect(drift.code).toBe(0);
  });
});
