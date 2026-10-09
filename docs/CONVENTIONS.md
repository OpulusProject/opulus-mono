# Conventions

How code in this repo is organized, and the patterns to follow when adding to
it. The package READMEs cover setup; this covers the habits that keep the
packages consistent.

## Packages

| Package | Owns |
| --- | --- |
| `opulus-core` | Prisma schema and migrations, repositories (data access), gateways (external APIs), the services both apps share, config, logging, the shared error classes and error handler, and the DTOs |
| `opulus-backend` | The REST API (Express) and Better Auth |
| `opulus-webhooks` | The Plaid webhook receiver, its Redis queue and the handlers |
| `opulus-frontend` | The React app |
| `opulus-tests` | Playwright suites: service, integration and webhook end-to-end |

Apps depend on `@opulus/core`; they don't copy contracts from each other. If
both the backend and the webhooks service need something, it lives in core.

The one place core touches HTTP is `opulus-core/src/middleware`: the Express
middleware both apps share (request id, request logging and the error handler).
Nothing else in core imports Express.

## Backend request flow

```
route -> requireSession -> validate / validateQuery -> controller -> service -> repository / gateway
```

Each layer has one job.

**Routes** (`src/routes`) list the middleware for an endpoint. Every route that
needs a signed-in user has `requireSession`; add a validator when the endpoint
takes a body or query.

**Middleware**
- `requireSession` looks the session up once and keeps it. Controllers read it
  with `getRequestSession(res)`, which answers 401 if the middleware didn't
  run. Don't call `getSession` from a controller.
- `validate(schema)` and `validateQuery(schema)` parse the request once.
  Controllers read the result with `getValidatedBody<typeof schema>(req)` and
  `getValidatedQuery<typeof schema>(req)`; don't parse again.

**Controllers** (`src/controllers/<resource>`) handle HTTP only: read the
request, call a service, map the result to a DTO and send it. They don't call
Plaid, don't use Prisma and don't decide who may do what. A controller types
its response as `Response<<Name>Response>` so the compiler checks what it
sends. Errors go to `next(error)`.

**Services** do the multi-step work for one operation, such as deleting an item
(Plaid, then a database transaction) or creating a link token. They live in
`opulus-backend/src/services/<resource>/<verb><Noun>.ts`; in
`opulus-webhooks/src/services` for logic only the webhooks service uses; or in
`opulus-core/src/services` when both need it (the transaction and liability
syncs). A service:
- takes one params object (`{ userId, ... }`) and exports its `<Name>Params`
  and `<Name>Result` types;
- decides authorization itself: it fetches items with `getItem({ userId, itemId })`,
  which only returns the user's own, so a controller can't forget the check;
- knows nothing about Express (no `req`, no `res`);
- reads and writes through repositories and never imports Prisma (a lint rule
  enforces it). To make several repository calls atomic, use
  `runInTransaction(async (tx) => ...)` and pass `tx` to each call;
- throws `AppError` subclasses.

**Repositories** (`opulus-core/src/repositories`) are data access, one per model
(`itemRepository`, `accountRepository`, ...). They use Prisma and nothing else:
no Plaid calls and no multi-step operations. They also hold the functions that
turn Plaid's shapes into our rows (`normalizePlaid*`).
- Every write takes an optional transaction client as its last argument, so a
  service can join it to a `runInTransaction`.
- Naming: `get…` returns the row or throws `NotFoundError`; `find…` returns
  `null` when there is none; `getAll…` returns a list.

**Gateways** (`opulus-core/src/gateways`) wrap an external API (`plaidGateway`).
They don't use the database.

**Dependencies point down:** controller → service → repository or gateway. Core
never imports from the backend, and the backend and the webhooks service don't
import from each other, which is why logic they share lives in core. The webhook
handlers are the webhooks service's entry layer, the counterpart of controllers:
they read the event and call a service, and don't call Plaid or Prisma
themselves.

Lint enforces most of this (`no-restricted-imports` per folder): controllers and
webhook handlers can't import gateways or Prisma; services, repositories and
gateways can't import Express; services can't import Prisma; repositories can't
import gateways or services; gateways can't import the database or repositories.

A read endpoint that calls one repository and maps rows to DTOs doesn't need a
service of its own.

## Adding an endpoint

The usual path, in the order the pieces are normally written. Each step is a
file the conventions above already describe.

1. **Contract.** In `opulus-core/src/types/dto/<resource>/`, a request schema if
   it takes a body, a response schema, and a `to<Name>DTO` that copies fields
   from the row. Export it from the folder's `index.ts`. The frontend gets the
   types from `@opulus/core/dto`.
2. **Data access.** The repository method(s) it needs in
   `opulus-core/src/repositories`: `get…` throws when missing, `find…` returns
   `null`, and a write takes an optional transaction client.
3. **Business logic.** A service in
   `opulus-backend/src/services/<resource>/<verb><Noun>.ts` with a params object
   and exported `Params` and `Result` types. Fetch items with `getItem` so
   ownership is checked. Skip this for a plain read of one repository.
4. **Controller.** `src/controllers/<resource>/<verb><Noun>Controller.ts`: type
   `res` as `Response<<Name>Response>`, read the user with
   `getRequestSession(res)`, the input with `getValidatedBody` or
   `getValidatedQuery`, call the service, send the DTO, `next(error)` on failure.
5. **Route.** In `src/routes/<resource>.ts`: `requireSession`, then `validate` or
   `validateQuery` with the request schema, then the controller. A new resource's
   router is registered in `src/routes/index.ts`.
6. **Tests.** A service spec in `opulus-tests/services/backend/<resource>/`
   (401 first, validation, another user's data never returned, the response
   schema), and an integration spec if it calls Plaid.
7. **Bruno doc.** `opulus-backend/bruno/collections/<resource>/<Verb> <Noun>.bru`.
8. **Frontend.** A hook in `src/hooks/<resource>/` using that resource's
   `queryKeys.ts`; a page that needs a signed-in user goes in
   `src/routes/_authenticated/`.

## DTOs

The API contract lives in `opulus-core/src/types/dto`, one folder per resource
and a file per endpoint. See `dto/index.ts` for the full rules; in short:
- A DTO is a zod schema (`<Name>DTOSchema`, `<Name>ResponseSchema`,
  `<Name>RequestSchema`) with its type inferred (`z.infer`), so the shape is
  written once.
- Entities are `<Name>DTO`; endpoint envelopes are `<Name>Response`.
- A `to<Name>DTO` function copies fields one by one. That list is the
  allow-list: a new database column isn't exposed until it is added there.
- JSON has no decimals or dates, so DTOs use numbers (`toNumber`) and ISO
  strings (`toIsoString`).
- The backend validates a request body with the same request schema the DTO
  exports; the frontend types its calls with the DTO types.

The types are checked at compile time. The service tests parse real responses
with the schemas, so a field that isn't in the schema fails a test.

## Errors and logging

- Throw `AppError` or one of its subclasses (`ValidationError`, `ConflictError`,
  `NotFoundError`, `UnauthorizedError`) from `@opulus/core`. The shared error
  handler turns them into the response; don't write error responses by hand.
- Log with the pino `logger` from `@opulus/core`, with structured snake_case
  fields (`item_id`, `user_id`, `plaid_request_id`), not interpolated strings.
  Never log access tokens or other secrets.

## Database

- Schema changes go in a Prisma migration. A renaming migration should be
  hand-written so data is kept, and `prisma migrate diff` against the schema
  should report no difference afterwards.
- Deleting an account deletes its transactions and liabilities (cascade).
  Disconnecting an institution and deleting its data are the same operation.

## Frontend

- `src/pages/<Page>` for pages, `src/common` for components used by several
  pages, `src/components/ui` for the shadcn primitives.
- Import contracts from `@opulus/core/dto`, never the `@opulus/core` root: the
  root also exports Prisma, the Plaid gateway and the queue, which must not reach
  the browser. A lint rule enforces it.
- `src/lib` is glue to frameworks and servers (the API client, the auth client,
  shadcn's `cn`). `src/utils` is display and formatting helpers for our own data
  (account types, item status, dates).
- `src/hooks/<resource>` has the data hooks. Each resource has a `queryKeys.ts`
  with an `all` prefix (for invalidation) and a builder for each query; hooks and
  mutations use those instead of writing key arrays inline.
- Two layers of components. `src/components/ui` is shadcn's primitives, copied
  in and kept close to upstream (no app logic), so shadcn updates stay easy to
  compare. `src/common` is our own components built from those primitives and
  from `src/utils` (`ListRow`, `PageHeader`, `AppLayout`). A page uses a
  primitive directly for a one-off (a `Button`, a `Dialog`). When two or more
  pages repeat the same combination, promote it to `common`; don't wrap a
  primitive one-to-one with nothing of our own in it.
- A family of parts is one folder with one `index.ts`: `common/List` has `List`,
  `ListHeader`, `ListGroup`, `ListRow`, `ListFooter` and `ListEmpty`. A list is
  a `ul` of `li`s, built from those parts (the `List` wraps each child in an
  `li`, so pass the parts as direct children, not inside a fragment). It
  borrows shadcn's naming style (`Header`, `Row`, `Footer`) but not its
  `Table`, which is for data in aligned columns; use that for real columns.
- A small component used by one file goes at the bottom of that file, written as
  `const Name: React.FC<NameProps>`. It gets its own file only if several files
  use it or it is large or has real behaviour.
- A shared component takes named props for content that is always the same kind
  (logo, value, action), not generic `leading` / `trailing` slots.
- Routes: pages that need a signed-in user live in `src/routes/_authenticated/`.
  That folder is the guard, so placing the file there is all it takes. Pages
  outside it (`/`, `/login`, `/two-factor`) are public. `routeTree.gen.ts` is
  generated; don't edit it.
- Imports use the `@/` alias, and ESLint enforces their order and the order of
  exports; run `pnpm lint` before pushing.

## Tests

`opulus-tests` has three suites; put a test in the one that matches what it needs.

| Suite | What it covers | Needs |
| --- | --- | --- |
| `services/backend`, `services/webhooks` | The service's own behaviour over HTTP: auth, validation, response shape. No third party. | A running service and `TEST_DATABASE_URL` |
| `integration/backend` | Real round-trips through Plaid's sandbox | Sandbox credentials |
| `integration/webhooks` | Plaid's sandbox delivering real webhooks to the real receiver | A public tunnel to the receiver, plus the above |

Rules that apply to all of them:
- Verify over HTTP. Read the database only to set up a test (for example an
  access token Plaid needs); seed resources that have no create endpoint
  through the fixtures in `shared/fixtures`, and don't write to the database to
  force a state if a Plaid sandbox call or an endpoint can do it. Where the
  sandbox can't (it can't de-select an account, or fire `NEW_ACCOUNTS_AVAILABLE`
  for our items), a direct write is allowed, with a comment saying why.
- Assert responses with `expectMatchesSchema(res, SomeResponseSchema)` so the
  DTO is what is checked.
- Each test makes its own data with `uniqueId`; don't assert on global counts.
- One spec per endpoint, named for the verb the code uses (`create`, `get`, `update`,
  `delete`, `refresh`), with the 401 test first.
- A required check must not silently skip: integration specs fail when sandbox
  credentials are missing.

## CI

| Workflow | Runs | Required to merge |
| --- | --- | --- |
| Service API Tests | Backend and webhooks service suites | "Backend service-api tests", "Webhooks service-api tests" |
| Integration Tests | Plaid sandbox suite, plus nightly | "Backend integration tests" |
| Type Check | `tsc --noEmit` in every package | No |
| Lint | `pnpm -r lint` | No |
| Webhook E2E | The webhook end-to-end suite, nightly and on changes to it or `opulus-webhooks` | No |

The first four run on every pull request, whatever its base branch, and again on
`main` after each merge. A PR is checked against the base it was opened on, so
two PRs that pass alone can fail together (a lint rule and a file that breaks it
once did); the run on `main` catches that. Webhook E2E is left out of the push
runs because it needs a public tunnel.

## Pull requests

- Branch from `main`; merge commits; branches are deleted when merged.
- One concern per PR, but a concern can be big: a new endpoint with its DTO,
  service, repository method, tests and Bruno doc is one PR. Prefer a few larger
  PRs over a chain of small ones. Every PR runs the full suites against Plaid's
  sandbox, which rate-limits (a 429) when many PRs run at once, and a stack
  multiplies that.
- Stack PRs only when a change truly depends on another that isn't merged yet:
  base the PR on the other PR's branch, say so in the description, and merge
  bottom-up. GitHub retargets the next PR when the one below merges.
- Include a test plan in the description, and say what was not verified.
