import type { APIRequestContext } from "@playwright/test";
import { expectOk } from "../../../shared/assertions.js";

/**
 * Controlling the Yahoo stub (stub/yahoo.mjs) the scheduler is pointed at.
 * YAHOO_STUB_URL is where the specs reach it.
 */
export const YAHOO_STUB_URL = process.env.YAHOO_STUB_URL ?? "http://localhost:4547";

export interface YahooStubRequest {
  symbol: string;
  kind: "quote" | "history";
  period1: number | null;
  period2: number | null;
}

/** Forget the requests and prices set so far, and stop failing. */
export async function resetYahooStub(request: APIRequestContext): Promise<void> {
  await expectOk(await request.post(`${YAHOO_STUB_URL}/__control/reset`));
}

/** Answer 503 to every chart request from now on. */
export async function failYahooStub(request: APIRequestContext): Promise<void> {
  await expectOk(await request.post(`${YAHOO_STUB_URL}/__control/fail`));
}

/** The price the stub quotes for a symbol from now on. */
export async function setYahooPrice(
  request: APIRequestContext,
  symbol: string,
  price: number,
): Promise<void> {
  await expectOk(
    await request.post(`${YAHOO_STUB_URL}/__control/prices`, { data: { symbol, price } }),
  );
}

/** The chart requests the stub received since the last reset. */
export async function yahooRequests(request: APIRequestContext): Promise<YahooStubRequest[]> {
  const res = await request.get(`${YAHOO_STUB_URL}/__control/requests`);
  await expectOk(res);
  return (await res.json()).requests as YahooStubRequest[];
}
