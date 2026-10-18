import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { PrismaClient } from "@opulus/core";
import { expect, test } from "@playwright/test";

const run = promisify(execFile);
const core = path.resolve(process.cwd(), "../opulus-core");
const prisma = path.join(core, "node_modules/.bin/prisma");

/**
 * The newest migration that was already deployed when this test was written.
 * The database is brought to exactly this point and filled with data before the
 * migrations after it are applied, so those are tested on data that was written
 * under the schema at this point. A migration is never edited after it ships, so
 * the rows below stay valid for ever; it only needs to move if the migrations
 * before it are ever squashed.
 */
const ANCHOR = "20261015000000_drop_account_historic_balance";

/** The server DATABASE_URL points at, with another database name. */
function urlFor(database: string): string {
  const url = new URL(process.env.DATABASE_URL ?? "");
  url.pathname = `/${database}`;
  return url.toString();
}

/** Run the Prisma CLI against a database; its output and exit code. */
async function prismaCli(args: string[], databaseUrl: string) {
  try {
    const { stdout, stderr } = await run(prisma, args, { cwd: core, env: { ...process.env, DATABASE_URL: databaseUrl } });
    return { code: 0, output: stdout + stderr };
  } catch (error) {
    const failed = error as { code?: number; stdout?: string; stderr?: string };
    return { code: failed.code ?? 1, output: (failed.stdout ?? "") + (failed.stderr ?? "") };
  }
}

/** A copy of the schema with only the migrations up to and including `anchor`, to deploy as "the database as it was". */
async function schemaUpTo(anchor: string): Promise<{ dir: string; schema: string }> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "opulus-migrations-"));
  const migrations = path.join(dir, "prisma/migrations");
  await mkdir(migrations, { recursive: true });
  await cp(path.join(core, "prisma/schema.prisma"), path.join(dir, "prisma/schema.prisma"));
  await cp(path.join(core, "prisma/migrations/migration_lock.toml"), path.join(migrations, "migration_lock.toml"));
  const names = (await readdir(path.join(core, "prisma/migrations"), { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && entry.name <= anchor)
    .map((entry) => entry.name);
  expect(names, `the anchor migration ${anchor} must exist`).toContain(anchor);
  for (const name of names) await cp(path.join(core, "prisma/migrations", name), path.join(migrations, name), { recursive: true });
  return { dir, schema: path.join(dir, "prisma/schema.prisma") };
}

/**
 * This file: the migrations applied to a database that already has data, as a
 * deploy applies them to production. The empty-database spec cannot see a
 * migration that loses, rewrites or rejects existing rows. The database is
 * brought to an earlier schema, filled in raw SQL as that schema's code would
 * have, and then migrated to the current one.
 *
 * Test cases:
 * - the migrations after the anchor apply to a database with a user, an item, an account and a transaction
 * - the rows are all still there afterwards, with their values
 * - the migrated database still has exactly the schema in schema.prisma
 */
test.describe("database migrations on existing data", () => {
  const database = `opulus_upgrade_${Date.now()}`;
  const url = urlFor(database);
  let admin: PrismaClient;
  let old: { dir: string; schema: string };
  let db: PrismaClient;

  test.beforeAll(async () => {
    expect(process.env.DATABASE_URL, "DATABASE_URL must point at a Postgres server").toBeTruthy();
    admin = new PrismaClient({ datasources: { db: { url: urlFor("postgres") } } });
    await admin.$executeRawUnsafe(`CREATE DATABASE ${database}`);
    old = await schemaUpTo(ANCHOR);
    db = new PrismaClient({ datasources: { db: { url } } });
  });

  test.afterAll(async () => {
    await db?.$disconnect();
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
    await admin.$disconnect();
    await rm(old.dir, { recursive: true, force: true });
  });

  test("the migrations after the anchor apply to a database with a user, an item, an account and a transaction", async () => {
    // Arrange: the database as it was at the anchor, with rows written under that schema.
    const before = await prismaCli(["migrate", "deploy", `--schema=${old.schema}`], url);
    expect(before.code, before.output).toBe(0);
    const rows = [
      `INSERT INTO "user" (id, name, email) VALUES ('u1', 'Existing User', 'existing@example.test')`,
      `INSERT INTO "item" (id, "plaidItemId", "userId", "accessToken", "updateType", "institutionName", "transactionCursor", "updatedAt") VALUES ('i1', 'plaid-item-1', 'u1', 'enc:v1:stored-token', 'background', 'Old Bank', 'cursor-9', now())`,
      `INSERT INTO "account" (id, "providerAccountId", "itemId", "userId", name, type, subtype, "balanceCurrent", "balanceAvailable", "isoCurrencyCode", "updatedAt") VALUES ('a1', 'plaid-acct-1', 'i1', 'u1', 'Chequing', 'depository', 'checking', 1234.5678, 1200, 'CAD', now())`,
      `INSERT INTO "transaction" (id, "providerTransactionId", "accountId", "itemId", "userId", amount, date, name, "merchantName", "categoryPrimary", pending, "updatedAt") VALUES ('t1', 'plaid-txn-1', 'a1', 'i1', 'u1', 12.3456, '2026-10-10', 'COFFEE', 'Coffee Shop', 'FOOD_AND_DRINK', false, now())`,
    ];
    for (const statement of rows) await db.$executeRawUnsafe(statement);

    // Act: the migrations that came after, as a deploy applies them.
    const after = await prismaCli(["migrate", "deploy", "--schema=./prisma/schema.prisma"], url);

    // Assert
    expect(after.output).toContain("have been successfully applied");
    expect(after.output).toMatch(/Applying migration/);
    expect(after.code, after.output).toBe(0);
  });

  test("the rows are all still there afterwards, with their values", async () => {
    const [user] = await db.$queryRawUnsafe<{ name: string; email: string }[]>(`SELECT name, email FROM "user" WHERE id = 'u1'`);
    const [item] = await db.$queryRawUnsafe<{ accessToken: string; institutionName: string; transactionCursor: string; userId: string }[]>(
      `SELECT "accessToken", "institutionName", "transactionCursor", "userId" FROM "item" WHERE id = 'i1'`,
    );
    const [account] = await db.$queryRawUnsafe<{ name: string; balanceCurrent: number; balanceAvailable: number; itemId: string }[]>(
      `SELECT name, "balanceCurrent"::float8 AS "balanceCurrent", "balanceAvailable"::float8 AS "balanceAvailable", "itemId" FROM "account" WHERE id = 'a1'`,
    );
    const [transaction] = await db.$queryRawUnsafe<{ amount: number; name: string; categoryPrimary: string; accountId: string }[]>(
      `SELECT amount::float8 AS amount, name, "categoryPrimary", "accountId" FROM "transaction" WHERE id = 't1'`,
    );

    expect(user).toEqual({ name: "Existing User", email: "existing@example.test" });
    expect(item).toEqual({ accessToken: "enc:v1:stored-token", institutionName: "Old Bank", transactionCursor: "cursor-9", userId: "u1" });
    expect(account).toEqual({ name: "Chequing", balanceCurrent: 1234.5678, balanceAvailable: 1200, itemId: "i1" });
    expect(transaction).toEqual({ amount: 12.3456, name: "COFFEE", categoryPrimary: "FOOD_AND_DRINK", accountId: "a1" });
  });

  test("the migrated database still has exactly the schema in schema.prisma", async () => {
    const drift = await prismaCli(["migrate", "diff", "--from-url", url, "--to-schema-datamodel", "./prisma/schema.prisma", "--exit-code"], url);

    expect(drift.output).toContain("No difference detected");
    expect(drift.code).toBe(0);
  });
});
