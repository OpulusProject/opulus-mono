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
 *   POST /liabilities/get      PRODUCTS_NOT_SUPPORTED unless a test set liabilities with
 *                              /__control/liabilities: { response } (liabilities.credit /
 *                              .mortgage / .student) or { error_code }
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
 *   POST /webhook_verification_key/get   the public key that Plaid signs webhooks with:
 *                              the stub's own (key id "stub-webhook-key"); the key
 *                              id "stub-expired-key" answers the same key marked
 *                              expired; the key id "stub-broken-key" is a Plaid server error (500);
 *                              any other id is Plaid's INVALID_WEBHOOK_VERIFICATION_KEY_ID
 *   GET  /__control/webhook-key   that key's id and its PRIVATE key, so a test can
 *                              sign a webhook the receiver will accept
 *   POST /item/remove          revokes an access token (remembered); answers the
 *                              error a test set with /__control/item-remove, if any
 *   GET  /__control/removed-items   the access tokens removed so far
 *   POST /__control/item-remove  { error_code } makes /item/remove fail; {} makes it work
 *   GET  /__control/exchanges  the public tokens exchanged so far
 *   POST /institutions/get     a page of 25 stub institutions (count and offset honoured)
 *   POST /__control/liabilities  set what /liabilities/get answers
 *   POST /__control/accounts-error  { error_code } makes /accounts/get fail as an ITEM_ERROR
 *                              (for example ITEM_LOGIN_REQUIRED); {} makes it work again
 *   POST /transactions/sync    the next page a test queued for that access token
 *                              (/__control/transactions-sync), or an empty one; the cursor
 *                              asked from is remembered
 *   POST /__control/transactions-sync  { access_token, pages }: pages of added, modified,
 *                              removed, accounts, next_cursor, has_more, or { error_code }
 *   GET  /__control/transactions-sync-cursors?access_token=  the cursors it was asked from
 *   POST /sandbox/public_token/create   a public token (the request is remembered)
 *   POST /sandbox/item/fire_webhook     remembers the webhook asked for, delivers nothing
 *   GET  /__control/sandbox-requests    the two sandbox calls above, oldest first
 *   POST /__control/institution-error  { error_code } makes /institutions/get_by_id fail; {} makes it work
 *   POST /__control/sandbox-error  { error_code } makes both sandbox calls fail; {} makes them work
 *   POST /investments/transactions/get   the investment transactions a test set with
 *                              /__control/investment-transactions (none by default), a page at
 *                              a time as asked (count, offset), or the Plaid error it set; the
 *                              request (dates) is remembered
 *   POST /__control/investment-transactions  set what it answers: { response } (investment_transactions,
 *                              securities) or { error_code }
 *   GET  /__control/investment-transaction-requests  the requests received so far
 *   POST /__control/reset      forget the requests, the item and the holdings
 *
 * Everything else answers 404 in Plaid's error shape, as an unsupported call.
 */
import { generateKeyPairSync } from "node:crypto";
import { createServer } from "node:http";

const PORT = Number(process.env.PLAID_STUB_PORT ?? 4546);

/**
 * The stub is type-checked (`pnpm --filter @opulus/tests type-check`): what it
 * answers is held to the Plaid SDK's own response types, so a field Plaid renamed
 * or dropped in a newer SDK fails the check instead of passing against a stub
 * that agrees with our code.
 * @typedef {{ error_code?: string }} Failing
 * @typedef {import("../../../shared/plaid-stub.js").AccountBase} AccountBase
 * @typedef {import("../../../shared/plaid-stub.js").Holding} Holding
 * @typedef {import("../../../shared/plaid-stub.js").Security} Security
 * @typedef {import("../../../shared/plaid-stub.js").InvestmentTransaction} InvestmentTransaction
 */

/**
 * @template T
 * @typedef {import("../../../shared/plaid-stub.js").Plaid<T>} Plaid
 */

/**
 * @template T
 * @typedef {import("../../../shared/plaid-stub.js").Wire<T>} Wire
 */

/** @type {Record<string, unknown>[]} */
let linkTokenRequests = [];
let counter = 0;
/** @type {string[]} */
let removedItems = [];
/** @type {Failing & { response?: { liabilities: import("../../../shared/plaid-stub.js").PlaidLiabilities } }} */
const NO_LIABILITIES = { error_code: "PRODUCTS_NOT_SUPPORTED" };
let liabilities = NO_LIABILITIES;
/** @type {Failing} */
let accountsError = {};
/** @type {Failing} */
let institutionError = {};
/** @type {Failing} */
let itemRemove = {};
/** @type {string[]} */
let exchanges = [];
/** @type {{ path: string; body: Record<string, unknown> }[]} */
let sandboxRequests = [];
/** @type {Failing} */
let sandboxError = {};
/** @type {Wire<import("plaid").Institution>[]} */
const STUB_INSTITUTIONS = Array.from({ length: 25 }, (_, i) => ({
  institution_id: `ins_stub_${i}`,
  name: `Stub Bank ${i}`,
  country_codes: ["CA"],
  products: ["transactions"],
  routing_numbers: [],
  oauth: false,
  connection_availability: "SUPPORTED",
  logo: null,
  primary_color: null,
  url: null,
}));
/** Per access token (so a retry of one test's job cannot take another's page): what /transactions/sync answers in turn, and what it was asked from. */
let syncPages = new Map();
let syncCursors = new Map();

/** The key this stub signs webhooks with, made fresh each time the stub starts. */
const WEBHOOK_KEY_ID = "stub-webhook-key";
const EXPIRED_KEY_ID = "stub-expired-key";
const BROKEN_KEY_ID = "stub-broken-key";
const webhookKeys = generateKeyPairSync("ec", { namedCurve: "P-256" });
/** @param {string} kid @param {number | null} expiredAt */
const publicWebhookKey = (kid, expiredAt) => ({
  alg: "ES256",
  created_at: 1_700_000_000,
  expired_at: expiredAt,
  kid,
  use: "sig",
  .../** @type {{ kty: string; crv: string; x: string; y: string }} */ (webhookKeys.publicKey.export({ format: "jwk" })),
});
/** What /investments/holdings/get answers: a response, or a Plaid error. */
/** @type {Failing & { response?: { accounts: Plaid<AccountBase>[]; holdings: Plaid<Holding>[]; securities: Plaid<Security>[] } }} */
const NO_HOLDINGS = { response: { accounts: [], holdings: [], securities: [] } };
let holdings = NO_HOLDINGS;
/**
 * The institution and accounts the item, institution and accounts calls describe.
 * @type {{ institution_id: string; institution_name: string; consent_expiration_time: string | null; accounts: Plaid<AccountBase>[] }}
 */
const DEFAULT_ITEM = {
  institution_id: "ins_stub",
  institution_name: "Stub Bank",
  consent_expiration_time: null,
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
/** @type {Failing & { response?: { inflow_streams: unknown[]; outflow_streams: unknown[] } }} */
const NO_STREAMS = { response: { inflow_streams: [], outflow_streams: [] } };
let recurring = NO_STREAMS;
/** @type {Record<string, unknown>[]} */
let recurringRequests = [];
/** @type {Failing & { response?: { investment_transactions: Plaid<InvestmentTransaction>[]; securities: Plaid<Security>[] } }} */
const NO_INVESTMENT_TRANSACTIONS = { response: { investment_transactions: [], securities: [] } };
let investmentTransactions = NO_INVESTMENT_TRANSACTIONS;
/** @type {Record<string, unknown>[]} */
let investmentTransactionRequests = [];

/** @param {import("node:http").ServerResponse} res @param {number} status @param {unknown} body */
function send(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

/** @param {import("node:http").IncomingMessage} req @returns {Promise<any>} */
function readJson(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (/** @type {Buffer} */ chunk) => (raw += chunk));
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
  if (req.method === "GET" && url.pathname === "/__control/webhook-key") {
    return send(res, 200, {
      kid: WEBHOOK_KEY_ID,
      expiredKid: EXPIRED_KEY_ID,
      privateJwk: webhookKeys.privateKey.export({ format: "jwk" }),
    });
  }
  if (req.method === "POST" && url.pathname === "/__control/transactions-sync") {
    const { access_token, pages } = await readJson(req);
    syncPages.set(access_token, pages ?? []);
    return send(res, 200, {});
  }
  if (req.method === "GET" && url.pathname === "/__control/transactions-sync-cursors") {
    return send(res, 200, { cursors: syncCursors.get(url.searchParams.get("access_token")) ?? [] });
  }
  if (req.method === "POST" && url.pathname === "/__control/reset") {
    linkTokenRequests = [];
    holdings = NO_HOLDINGS;
    syncPages = new Map();
    syncCursors = new Map();
    itemSetup = DEFAULT_ITEM;
    recurring = NO_STREAMS;
    recurringRequests = [];
    investmentTransactions = NO_INVESTMENT_TRANSACTIONS;
    investmentTransactionRequests = [];
    removedItems = [];
    itemRemove = {};
    exchanges = [];
    sandboxRequests = [];
    sandboxError = {};
    liabilities = NO_LIABILITIES;
    accountsError = {};
    institutionError = {};
    return send(res, 200, {});
  }
  if (req.method === "POST" && url.pathname === "/__control/liabilities") {
    liabilities = await readJson(req);
    return send(res, 200, {});
  }
  if (req.method === "POST" && url.pathname === "/__control/accounts-error") {
    accountsError = await readJson(req);
    return send(res, 200, {});
  }
  if (req.method === "POST" && url.pathname === "/__control/institution-error") {
    institutionError = await readJson(req);
    return send(res, 200, {});
  }
  if (req.method === "GET" && url.pathname === "/__control/removed-items") {
    return send(res, 200, { accessTokens: removedItems });
  }
  if (req.method === "POST" && url.pathname === "/__control/item-remove") {
    itemRemove = await readJson(req);
    return send(res, 200, {});
  }
  if (req.method === "POST" && url.pathname === "/__control/sandbox-error") {
    sandboxError = await readJson(req);
    return send(res, 200, {});
  }
  if (req.method === "GET" && url.pathname === "/__control/sandbox-requests") {
    return send(res, 200, { requests: sandboxRequests });
  }
  if (req.method === "GET" && url.pathname === "/__control/exchanges") {
    return send(res, 200, { publicTokens: exchanges });
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
  if (req.method === "POST" && url.pathname === "/__control/investment-transactions") {
    investmentTransactions = await readJson(req);
    return send(res, 200, {});
  }
  if (req.method === "GET" && url.pathname === "/__control/investment-transaction-requests") {
    return send(res, 200, { requests: investmentTransactionRequests });
  }
  if (req.method === "POST" && url.pathname === "/__control/holdings") {
    holdings = await readJson(req);
    return send(res, 200, {});
  }

  if (req.method === "POST" && url.pathname === "/webhook_verification_key/get") {
    const { key_id } = await readJson(req);
    counter += 1;
    if (key_id === WEBHOOK_KEY_ID || key_id === EXPIRED_KEY_ID) {
      return send(res, 200, /** @satisfies {Wire<import("plaid").WebhookVerificationKeyGetResponse>} */ ({
        key: publicWebhookKey(key_id, key_id === EXPIRED_KEY_ID ? 1_700_100_000 : null),
        request_id: `stub-request-${counter}`,
      }));
    }
    if (key_id === BROKEN_KEY_ID) {
      return send(res, 500, {
        error_type: "API_ERROR",
        error_code: "INTERNAL_SERVER_ERROR",
        error_message: "the stub fails this key id on purpose",
        request_id: `stub-request-${counter}`,
      });
    }
    return send(res, 400, {
      error_type: "INVALID_REQUEST",
      error_code: "INVALID_WEBHOOK_VERIFICATION_KEY_ID",
      error_message: "the stub does not know that key id",
      request_id: `stub-request-${counter}`,
    });
  }

  if (req.method === "POST" && url.pathname === "/user/create") {
    counter += 1;
    return send(res, 200, /** @satisfies {Wire<import("plaid").UserCreateResponse>} */ ({
      user_id: `stub-user-${counter}`,
      user_token: `stub-user-token-${counter}`,
      request_id: `stub-request-${counter}`,
    }));
  }

  if (req.method === "POST" && url.pathname === "/link/token/create") {
    const body = await readJson(req);
    // The credentials are in the body or headers; only keep what the tests read.
    const { client_id, secret, ...request } = body;
    linkTokenRequests.push(request);
    counter += 1;
    return send(res, 200, /** @satisfies {Wire<import("plaid").LinkTokenCreateResponse>} */ ({
      link_token: `link-stub-${counter}`,
      expiration: new Date(Date.now() + 4 * 3600_000).toISOString(),
      request_id: `stub-request-${counter}`,
    }));
  }

  /** @returns {Wire<import("plaid").Item>} */
  const plaidItem = () => ({
    item_id: `stub-item-${itemSetup.institution_id}`,
    institution_id: itemSetup.institution_id,
    webhook: null,
    error: null,
    available_products: [],
    billed_products: ["transactions"],
    products: ["transactions"],
    consent_expiration_time: itemSetup.consent_expiration_time ?? null,
    update_type: "background",
  });

  if (req.method === "POST" && url.pathname === "/item/public_token/exchange") {
    exchanges.push((await readJson(req)).public_token);
    counter += 1;
    return send(res, 200, /** @satisfies {Wire<import("plaid").ItemPublicTokenExchangeResponse>} */ ({
      access_token: `access-stub-${counter}`,
      item_id: `stub-item-${itemSetup.institution_id}`,
      request_id: `stub-request-${counter}`,
    }));
  }

  if (req.method === "POST" && url.pathname === "/item/get") {
    counter += 1;
    return send(res, 200, /** @satisfies {Wire<import("plaid").ItemGetResponse>} */ ({ item: plaidItem(), status: null, request_id: `stub-request-${counter}` }));
  }

  if (req.method === "POST" && url.pathname === "/sandbox/public_token/create") {
    const { client_id, secret, ...request } = await readJson(req);
    sandboxRequests.push({ path: url.pathname, body: request });
    counter += 1;
    if (sandboxError.error_code) {
      return send(res, 400, {
        error_type: "INVALID_REQUEST",
        error_code: sandboxError.error_code,
        error_message: `the stub answers ${sandboxError.error_code} on purpose`,
        request_id: `stub-request-${counter}`,
      });
    }
    if (sandboxError.error_code) {
      return send(res, 400, {
        error_type: "INVALID_REQUEST",
        error_code: sandboxError.error_code,
        error_message: `the stub answers ${sandboxError.error_code} on purpose`,
        request_id: `stub-request-${counter}`,
      });
    }
    return send(res, 200, /** @satisfies {Wire<import("plaid").SandboxPublicTokenCreateResponse>} */ ({
      public_token: `public-sandbox-stub-${counter}`,
      request_id: `stub-request-${counter}`,
    }));
  }

  if (req.method === "POST" && url.pathname === "/sandbox/item/fire_webhook") {
    const { client_id, secret, ...request } = await readJson(req);
    sandboxRequests.push({ path: url.pathname, body: request });
    counter += 1;
    return send(res, 200, /** @satisfies {Wire<import("plaid").SandboxItemFireWebhookResponse>} */ ({
      webhook_fired: true,
      request_id: `stub-request-${counter}`,
    }));
  }

  if (req.method === "POST" && url.pathname === "/item/remove") {
    const { access_token } = await readJson(req);
    counter += 1;
    if (itemRemove.error_code) {
      return send(res, 500, {
        error_type: "API_ERROR",
        error_code: itemRemove.error_code,
        error_message: `the stub answers ${itemRemove.error_code} on purpose`,
        request_id: `stub-request-${counter}`,
      });
    }
    removedItems.push(access_token);
    return send(res, 200, /** @satisfies {Wire<import("plaid").ItemRemoveResponse>} */ ({ request_id: `stub-request-${counter}` }));
  }

  if (req.method === "POST" && url.pathname === "/institutions/get") {
    const { count = 500, offset = 0 } = await readJson(req);
    counter += 1;
    return send(res, 200, {
      institutions: STUB_INSTITUTIONS.slice(offset, offset + count),
      total: STUB_INSTITUTIONS.length,
      request_id: `stub-request-${counter}`,
    });
  }

  if (req.method === "POST" && url.pathname === "/institutions/get_by_id") {
    counter += 1;
    if (institutionError.error_code) {
      return send(res, 500, {
        error_type: "API_ERROR",
        error_code: institutionError.error_code,
        error_message: `the stub answers ${institutionError.error_code} on purpose`,
        request_id: `stub-request-${counter}`,
      });
    }
    return send(res, 200, /** @satisfies {Wire<import("plaid").InstitutionsGetByIdResponse>} */ ({
      institution: {
        institution_id: itemSetup.institution_id,
        name: itemSetup.institution_name,
        country_codes: ["CA"],
        products: ["transactions"],
        routing_numbers: [],
        oauth: false,
        connection_availability: "SUPPORTED",
        logo: null,
        primary_color: null,
      },
      request_id: `stub-request-${counter}`,
    }));
  }

  if (req.method === "POST" && url.pathname === "/accounts/get") {
    counter += 1;
    if (accountsError.error_code) {
      return send(res, 400, {
        error_type: "ITEM_ERROR",
        error_code: accountsError.error_code,
        error_message: `the stub answers ${accountsError.error_code} on purpose`,
        request_id: `stub-request-${counter}`,
      });
    }
    return send(res, 200, {
      accounts: itemSetup.accounts,
      item: plaidItem(),
      request_id: `stub-request-${counter}`,
    });
  }

  if (req.method === "POST" && url.pathname === "/liabilities/get") {
    counter += 1;
    if (liabilities.error_code) {
      return send(res, 400, {
        error_type: "ITEM_ERROR",
        error_code: liabilities.error_code,
        error_message: `the stub answers ${liabilities.error_code} on purpose`,
        request_id: `stub-request-${counter}`,
      });
    }
    return send(res, 200, {
      accounts: itemSetup.accounts,
      item: plaidItem(),
      liabilities: liabilities.response?.liabilities,
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

  if (req.method === "POST" && url.pathname === "/transactions/sync") {
    const { access_token, cursor } = await readJson(req);
    syncCursors.set(access_token, [...(syncCursors.get(access_token) ?? []), cursor ?? null]);
    const page = (syncPages.get(access_token) ?? []).shift() ?? {};
    counter += 1;
    if (page.error_code) {
      return send(res, 500, {
        error_type: "API_ERROR",
        error_code: page.error_code,
        error_message: `the stub answers ${page.error_code} on purpose`,
        request_id: `stub-request-${counter}`,
      });
    }
    return send(res, 200, {
      added: [],
      modified: [],
      removed: [],
      accounts: [],
      next_cursor: cursor ?? "stub-cursor-0",
      has_more: false,
      transactions_update_status: "HISTORICAL_UPDATE_COMPLETE",
      ...page,
      request_id: `stub-request-${counter}`,
    });
  }

  if (req.method === "POST" && url.pathname === "/investments/transactions/get") {
    const { client_id, secret, access_token, ...request } = await readJson(req);
    investmentTransactionRequests.push(request);
    counter += 1;
    if (investmentTransactions.error_code) {
      return send(res, 400, {
        error_type: "ITEM_ERROR",
        error_code: investmentTransactions.error_code,
        error_message: `the stub answers ${investmentTransactions.error_code} on purpose`,
        request_id: `stub-request-${counter}`,
      });
    }
    const all = investmentTransactions.response?.investment_transactions ?? [];
    const { count = 100, offset = 0 } = request.options ?? {};
    return send(res, 200, {
      accounts: itemSetup.accounts,
      item: plaidItem(),
      securities: investmentTransactions.response?.securities ?? [],
      investment_transactions: all.slice(offset, offset + count),
      total_investment_transactions: all.length,
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
