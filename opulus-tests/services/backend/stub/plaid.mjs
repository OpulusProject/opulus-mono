/**
 * A stand-in for Plaid's API, so the backend's service suite can run the parts
 * of Link that go through Plaid with no third party. The backend is pointed at
 * it with PLAID_BASE_URL=http://localhost:4546.
 *
 *   POST /user/create          a user token
 *   POST /link/token/create    a link token (and the request is remembered)
 *   POST /item/public_token/exchange   an access token and item id
 *   POST /item/get             the item (no error, background updates)
 *   POST /institutions/get_by_id   the institution a test set with /__control/item
 *   POST /accounts/get         the accounts a test set with /__control/item
 *   POST /liabilities/get      always PRODUCTS_NOT_SUPPORTED (no liabilities here)
 *   POST /investments/holdings/get   the holdings a test set with /__control/holdings
 *                              (none by default), or the Plaid error it set
 *   GET  /health
 *   GET  /__control/requests   the link token requests received so far
 *   POST /__control/item       set the institution and accounts the calls above
 *                              describe: { institution_id, institution_name, accounts }
 *   POST /transactions/recurring/get   the streams a test set with /__control/recurring
 *                              (none by default), or the Plaid error it set; the
 *                              request is remembered
 *   POST /__control/recurring  set what /transactions/recurring/get answers:
 *                              { response } (inflow_streams, outflow_streams) or
 *                              { error_code }
 *   GET  /__control/recurring-requests   the recurring requests received so far
 *   POST /__control/holdings   set what /investments/holdings/get answers:
 *                              { response } (accounts, holdings, securities) or
 *                              { error_code } for a Plaid error
 *   POST /__control/reset      forget the requests, the item and the holdings
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
/** The institution and accounts the item, institution and accounts calls describe. */
const DEFAULT_ITEM = {
  institution_id: "ins_stub",
  institution_name: "Stub Bank",
  accounts: [
    {
      account_id: "stub-account-checking",
      name: "Stub Checking",
      official_name: null,
      type: "depository",
      subtype: "checking",
      mask: "0000",
      balances: { available: 100, current: 100, limit: null, iso_currency_code: "CAD", unofficial_currency_code: null },
    },
  ],
};
let itemSetup = DEFAULT_ITEM;
const NO_STREAMS = { response: { inflow_streams: [], outflow_streams: [] } };
let recurring = NO_STREAMS;
let recurringRequests = [];

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
    itemSetup = DEFAULT_ITEM;
    recurring = NO_STREAMS;
    recurringRequests = [];
    return send(res, 200, {});
  }
  if (req.method === "POST" && url.pathname === "/__control/item") {
    itemSetup = { ...DEFAULT_ITEM, ...(await readJson(req)) };
    return send(res, 200, {});
  }
  if (req.method === "POST" && url.pathname === "/__control/recurring") {
    recurring = await readJson(req);
    return send(res, 200, {});
  }
  if (req.method === "GET" && url.pathname === "/__control/recurring-requests") {
    return send(res, 200, { requests: recurringRequests });
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

  const plaidItem = () => ({
    item_id: `stub-item-${itemSetup.institution_id}`,
    institution_id: itemSetup.institution_id,
    webhook: null,
    error: null,
    available_products: [],
    billed_products: ["transactions"],
    products: ["transactions"],
    consent_expiration_time: null,
    update_type: "background",
  });

  if (req.method === "POST" && url.pathname === "/item/public_token/exchange") {
    counter += 1;
    return send(res, 200, {
      access_token: `access-stub-${counter}`,
      item_id: `stub-item-${itemSetup.institution_id}`,
      request_id: `stub-request-${counter}`,
    });
  }

  if (req.method === "POST" && url.pathname === "/item/get") {
    counter += 1;
    return send(res, 200, { item: plaidItem(), status: null, request_id: `stub-request-${counter}` });
  }

  if (req.method === "POST" && url.pathname === "/institutions/get_by_id") {
    counter += 1;
    return send(res, 200, {
      institution: {
        institution_id: itemSetup.institution_id,
        name: itemSetup.institution_name,
        country_codes: ["CA"],
        products: ["transactions"],
        routing_numbers: [],
        oauth: false,
        logo: null,
        primary_color: null,
      },
      request_id: `stub-request-${counter}`,
    });
  }

  if (req.method === "POST" && url.pathname === "/accounts/get") {
    counter += 1;
    return send(res, 200, {
      accounts: itemSetup.accounts,
      item: plaidItem(),
      request_id: `stub-request-${counter}`,
    });
  }

  if (req.method === "POST" && url.pathname === "/liabilities/get") {
    counter += 1;
    return send(res, 400, {
      error_type: "ITEM_ERROR",
      error_code: "PRODUCTS_NOT_SUPPORTED",
      error_message: "the stub has no liabilities",
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

  if (req.method === "POST" && url.pathname === "/transactions/recurring/get") {
    const { client_id, secret, access_token, ...request } = await readJson(req);
    recurringRequests.push(request);
    counter += 1;
    if (recurring.error_code) {
      return send(res, 400, {
        error_type: "ITEM_ERROR",
        error_code: recurring.error_code,
        error_message: `the stub answers ${recurring.error_code} on purpose`,
        request_id: `stub-request-${counter}`,
      });
    }
    return send(res, 200, {
      ...recurring.response,
      updated_datetime: new Date().toISOString(),
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
