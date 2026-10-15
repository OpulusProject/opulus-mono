/**
 * A stand-in for Frankfurter, so the scheduler's service suite runs with no third party. The
 * scheduler is pointed at it with FRANKFURTER_BASE_URL=http://localhost:4545/v1.
 *
 *   GET  /v1/<from>..<to>?base=EUR   a time series, like Frankfurter's
 *   GET  /health
 *   GET  /__control/requests         the time series requests received so far
 *   POST /__control/fail             answer 503 to every time series request
 *   POST /__control/reset            forget the requests, stop failing
 *
 * Rates come from rates.mjs (a function of the day); weekends have none, and a
 * range that starts on one starts at the Friday before, as Frankfurter does.
 */
import { createServer } from "node:http";
import { publishingDays, stubRatesFor } from "./rates.mjs";

const PORT = Number(process.env.STUB_PORT ?? 4545);

let failing = false;
let requests = [];

function send(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

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
  if (url.pathname === "/__control/reset" && req.method === "POST") {
    failing = false;
    requests = [];
    return send(res, 200, { failing });
  }

  const range = url.pathname.match(
    /^\/v1\/(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/,
  );
  if (req.method === "GET" && range) {
    const [, from, to] = range;
    requests.push({ from, to, base: url.searchParams.get("base") });
    if (failing)
      return send(res, 503, { message: "stub is failing on purpose" });
    const days = publishingDays(from, to);
    return send(res, 200, {
      amount: 1,
      base: "EUR",
      start_date: days[0] ?? from,
      end_date: days.at(-1) ?? to,
      rates: Object.fromEntries(days.map((day) => [day, stubRatesFor(day)])),
    });
  }

  return send(res, 404, { message: "not found" });
});

server.listen(PORT, () => {
  console.log(`Frankfurter stub listening on http://localhost:${PORT}`);
});
