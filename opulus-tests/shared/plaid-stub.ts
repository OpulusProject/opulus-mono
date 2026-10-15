/**
 * The control side of the Plaid stub (opulus-tests/services/backend/stub/plaid.mjs),
 * for specs that check what the backend asked Plaid for. The backend runs with
 * PLAID_BASE_URL pointing at the stub, so no real Plaid is involved.
 */
const STUB_URL = process.env.PLAID_STUB_URL ?? "http://localhost:4546";

/** The link token requests the backend has made to the stub since the last reset, oldest first. */
export async function linkTokenRequests(): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${STUB_URL}/__control/requests`);
  return (await res.json()).requests;
}

/** Forget the requests received so far. */
export async function resetPlaidStub(): Promise<void> {
  await fetch(`${STUB_URL}/__control/reset`, { method: "POST" });
}
