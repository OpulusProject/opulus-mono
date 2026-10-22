/**
 * A stand-in for Yahoo Finance's chart endpoint, so the scheduler's service suite
 * runs with no third party. The scheduler is pointed at it with
 * YAHOO_FINANCE_BASE_URL=http://localhost:4547.
 *
 *   GET  /v8/finance/chart/<symbol>   a quote (no period) or daily history (period1/period2)
 *   GET  /health
 *   GET  /__control/requests          the chart requests received so far
 *   POST /__control/fail              answer 503 to every chart request
 *   POST /__control/prices            { symbol, price }: the price quotes give from now on
 *   POST /__control/reset             forget the requests and prices, stop failing
 *
 * Any symbol is known except one starting with "NOPE" (a 404 with Yahoo's
 * reason). A symbol ending in ".TO" is in CAD, any other in USD. A price is the
 * symbol's own (a function of its letters), so specs can tell securities apart,
 * and a close is that price plus a cent for each day since the first bar.
 * Toronto time is UTC-4, bars are at 09:30 there on weekdays.
 */
import { createServer } from "node:http";

const PORT = Number(process.env.STUB_YAHOO_PORT ?? 4547);
const GMT_OFFSET = -14400;
const DAY = 86400;

let failing = false;
/** @type {Record<string, unknown>[]} */
let requests = [];
/** @type {Record<string, number>} */
let prices = {};

/** @param {string} symbol */
export const basePrice = (symbol) =>
  50 + ([...symbol].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % 100);

/** @param {import("node:http").ServerResponse} res @param {number} status @param {unknown} body */
function send(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

/** @param {string} symbol @param {{ meta: Record<string, unknown>, rest: Record<string, unknown> }} extra */
function chart(symbol, extra) {
  return {
    chart: {
      result: [
        {
          meta: {
            currency: symbol.endsWith(".TO") ? "CAD" : "USD",
            symbol,
            gmtoffset: GMT_OFFSET,
            ...extra.meta,
          },
          ...extra.rest,
        },
      ],
      error: null,
    },
  };
}

const notFound = () => ({
  chart: {
    result: null,
    error: { code: "Not Found", description: "No data found, symbol may be delisted" },
  },
});

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  if (req.method === "GET" && url.pathname === "/health") {
    return send(res, 200, { status: "ok" });
  }
  if (url.pathname === "/__control/requests" && req.method === "GET") {
    return send(res, 200, { requests });
  }
  if (url.pathname === "/__control/fail" && req.method === "POST") {
    failing = true;
    return send(res, 200, { failing });
  }
  if (url.pathname === "/__control/prices" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      const { symbol, price } = JSON.parse(body);
      prices[symbol] = price;
      send(res, 200, { prices });
    });
    return;
  }
  if (url.pathname === "/__control/reset" && req.method === "POST") {
    failing = false;
    requests = [];
    prices = {};
    return send(res, 200, { failing });
  }

  const match = url.pathname.match(/^\/v8\/finance\/chart\/(.+)$/);
  if (req.method === "GET" && match) {
    const symbol = decodeURIComponent(match[1]);
    const period1 = url.searchParams.get("period1");
    const period2 = url.searchParams.get("period2");
    requests.push({
      symbol,
      kind: period1 ? "history" : "quote",
      period1: period1 ? Number(period1) : null,
      period2: period2 ? Number(period2) : null,
    });
    if (failing) return send(res, 503, { message: "stub is failing on purpose" });
    if (symbol.startsWith("NOPE")) return send(res, 404, notFound());

    if (!period1) {
      const now = Math.floor(Date.now() / 1000);
      return send(
        res,
        200,
        chart(symbol, {
          meta: { regularMarketPrice: prices[symbol] ?? basePrice(symbol), regularMarketTime: now },
          rest: {},
        }),
      );
    }

    // History: a bar at 13:30 UTC on each weekday from period1 up to period2.
    const timestamp = [];
    const close = [];
    const start = Math.floor(Number(period1) / DAY) * DAY;
    for (let day = start; day < Number(period2); day += DAY) {
      const weekday = new Date(day * 1000).getUTCDay();
      if (weekday === 0 || weekday === 6) continue;
      timestamp.push(day + 13.5 * 3600);
      close.push(Math.round((basePrice(symbol) + timestamp.length * 0.01) * 100) / 100);
    }
    return send(
      res,
      200,
      chart(symbol, { meta: {}, rest: { timestamp, indicators: { quote: [{ close }] } } }),
    );
  }

  return send(res, 404, { message: "not found" });
});

server.listen(PORT, () => {
  console.log(`Yahoo stub listening on http://localhost:${PORT}`);
});
