/**
 * A stand-in for Plaid's API, so the backend's service suite can run the parts
 * of Link that go through Plaid with no third party. The backend is pointed at
 * it with PLAID_BASE_URL=http://localhost:4546.
 *
 *   POST /user/create          a user token
 *   POST /link/token/create    a link token (and the request is remembered)
 *   POST /investments/holdings/get   the holdings a test set with /__control/holdings
 *                              (none by default), or the Plaid error it set
 *   GET  /health
 *   GET  /__control/requests   the link token requests received so far
 *   POST /__control/holdings   set what /investments/holdings/get answers:
 *                              { response } (accounts, holdings, securities) or
 *                              { error_code } for a Plaid error
 *   POST /__control/reset      forget the requests and the holdings
 *
 * Everything else answers 404 in Plaid's error shape, as an unsupported call.
 */
import { createServer } from "node:http";

const PORT = Number(process.env.PLAID_STUB_PORT ?? 4546);

let linkTokenRequests = [];
let counter = 0;
/** What /investments/holdings/get answers: a response, or a Plaid error. */
const NO_HOLDINGS = { response: { accounts: [], holdings: [], securities: [] } };
let holdings = NO_HOLDINGS;

function send(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  if (req.method === "GET" && url.pathname === "/health") {
    return send(res, 200, { status: "ok" });
  }
  if (req.method === "GET" && url.pathname === "/__control/requests") {
    return send(res, 200, { requests: linkTokenRequests });
  }
  if (req.method === "POST" && url.pathname === "/__control/reset") {
    linkTokenRequests = [];
    holdings = NO_HOLDINGS;
    return send(res, 200, {});
  }
  if (req.method === "POST" && url.pathname === "/__control/holdings") {
    holdings = await readJson(req);
    return send(res, 200, {});
  }

  if (req.method === "POST" && url.pathname === "/user/create") {
    const body = await readJson(req);
    counter += 1;
    return send(res, 200, {
      user_id: `stub-user-${counter}`,
      user_token: `stub-user-token-${counter}`,
      request_id: `stub-request-${counter}`,
      client_user_id: body.client_user_id,
    });
  }

  if (req.method === "POST" && url.pathname === "/link/token/create") {
    const body = await readJson(req);
    // The credentials are in the body or headers; only keep what the tests read.
    const { client_id, secret, ...request } = body;
    linkTokenRequests.push(request);
    counter += 1;
    return send(res, 200, {
      link_token: `link-stub-${counter}`,
      expiration: new Date(Date.now() + 4 * 3600_000).toISOString(),
      request_id: `stub-request-${counter}`,
    });
  }

  if (req.method === "POST" && url.pathname === "/investments/holdings/get") {
    counter += 1;
    if (holdings.error_code) {
      return send(res, 400, {
        error_type: "ITEM_ERROR",
        error_code: holdings.error_code,
        error_message: `the stub answers ${holdings.error_code} on purpose`,
        request_id: `stub-request-${counter}`,
      });
    }
    return send(res, 200, {
      ...holdings.response,
      item: {},
      request_id: `stub-request-${counter}`,
    });
  }

  return send(res, 404, {
    error_type: "INVALID_REQUEST",
    error_code: "UNKNOWN_ENDPOINT",
    error_message: `the stub does not implement ${req.method} ${url.pathname}`,
    request_id: "stub",
  });
});

server.listen(PORT, () => console.log(`Plaid stub listening on ${PORT}`));
