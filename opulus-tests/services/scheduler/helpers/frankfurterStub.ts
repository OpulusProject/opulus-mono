import type { APIRequestContext } from "@playwright/test";
import { expectOk } from "../../../shared/assertions.js";

/**
 * Controlling the Frankfurter stub (stub/frankfurter.mjs) the scheduler is
 * pointed at. STUB_URL is where the specs reach it.
 */
export const STUB_URL = process.env.STUB_URL ?? "http://localhost:4545";

export interface StubRequest {
  from: string;
  to: string;
  base: string | null;
}

/** Forget the requests seen so far and stop failing. */
export async function resetStub(request: APIRequestContext): Promise<void> {
  await expectOk(await request.post(`${STUB_URL}/__control/reset`));
}

/** Answer 503 to every time series request from now on. */
export async function failStub(request: APIRequestContext): Promise<void> {
  await expectOk(await request.post(`${STUB_URL}/__control/fail`));
}

/** The time series requests the stub received since the last reset. */
export async function stubRequests(
  request: APIRequestContext,
): Promise<StubRequest[]> {
  const res = await request.get(`${STUB_URL}/__control/requests`);
  await expectOk(res);
  return (await res.json()).requests as StubRequest[];
}
