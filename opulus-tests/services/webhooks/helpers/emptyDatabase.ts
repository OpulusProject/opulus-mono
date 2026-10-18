import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { PrismaClient } from "@opulus/core";
import { uniqueId } from "../../../shared/client.js";

const run = promisify(execFile);
const core = path.resolve(process.cwd(), "../opulus-core");

/** The server the test database is on, with another database name. */
function urlFor(database: string): string {
  const url = new URL(process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? "");
  url.pathname = `/${database}`;
  return url.toString();
}

/**
 * A new database on the test server with every migration applied and nothing in
 * it, for a spec about what a script does when there is nothing to work on (the
 * shared test database always has other specs' rows). `drop` removes it.
 */
export async function createEmptyDatabase(): Promise<{ url: string; drop: () => Promise<void> }> {
  const name = uniqueId("opulus_empty").toLowerCase();
  const url = urlFor(name);
  const admin = new PrismaClient({ datasources: { db: { url: urlFor("postgres") } } });
  await admin.$executeRawUnsafe(`CREATE DATABASE ${name}`);
  await run(path.join(core, "node_modules/.bin/prisma"), ["migrate", "deploy", "--schema=./prisma/schema.prisma"], {
    cwd: core,
    env: { ...process.env, DATABASE_URL: url },
  });
  return {
    url,
    drop: async () => {
      await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      await admin.$disconnect();
    },
  };
}
