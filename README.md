# Opulus

A personal finance dashboard prototype built around Plaid, transaction sync,
and a small design system.

Opulus is not a production financial product. It is a portfolio project that
explores the shape of a multi-service finance app: auth, bank-account linking,
transaction reads, webhook ingestion, async processing, shared DTOs, and a React
frontend that can run against either real services or demo fixtures.

> Demo and sandbox use only. Do not connect real financial accounts to a public
> deployment of this project.

## What's in the box

```
.
├── opulus-backend/              Express API, Better Auth, Bruno collections
│   ├── src/controllers/         Thin request handlers for session, Plaid, items, transactions
│   ├── src/middleware/          error handling, auth/session, demo-mode checks
│   ├── src/routes/              API route registration
│   └── bruno/                   API client collections and local/prod environments
├── opulus-frontend/             React + Vite + TanStack Router/Query app
│   ├── src/common/              app layout, sidebar, shared UI glue
│   ├── src/hooks/               auth, Plaid, items, transactions hooks
│   ├── src/lib/                 API clients, including demo-mode client
│   ├── src/pages/               dashboard, accounts, login, 2FA, settings
│   └── src/routes/              file-based TanStack Router routes
├── opulus-core/                 Shared Prisma, Plaid client, services, DTOs, config
│   ├── prisma/                  schema and migrations
│   └── src/services/            item, transaction, Plaid, demo services
├── opulus-gems/                 Shared Radix/Tailwind component library
├── opulus-webhooks/             Plaid webhook receiver + Redis/BullMQ worker
├── docs/                        Notes on demo mode, observability, privacy
├── docker-compose.yml           Local Postgres + Redis
├── package.json                 pnpm workspace orchestration
└── pnpm-workspace.yaml          Declares the five workspace packages
```

## Stack

| Layer      | Choice                                      |
| ---------- | ------------------------------------------- |
| Frontend   | React · Vite · TanStack Router · TanStack Query |
| UI         | Tailwind CSS · Radix UI · shared `@opulus/gems` package |
| Backend    | Express · Better Auth · Prisma              |
| Integrations | Plaid sandbox · Plaid webhooks           |
| Storage    | PostgreSQL · Redis for webhook jobs         |
| Queueing   | BullMQ                                      |
| Tooling    | pnpm workspaces · TypeScript · tsup         |
| API testing | Bruno collections                          |

## Public Repo Notes

This repo is best read as a working prototype and portfolio case study. A few
things are intentionally scoped that way:

- Plaid should be used in sandbox mode for local development.
- Demo mode exists so the UI can be shown without auth, database reads, or
  network calls.
- Transaction privacy work is documented in `docs/TRANSACTION_PRIVACY.md`, but
  this repo should not be treated as production-ready financial infrastructure.
- Local `.env` files are ignored. Use `.env.example` as the public template.

## Local Development

### Prereqs

- Node 18+
- pnpm 9 (`corepack enable` will use the version pinned in `package.json`)
- Docker Desktop
- Plaid sandbox credentials, unless you only use demo mode

### One-time setup

```bash
# 1. Install all workspaces
pnpm install

# 2. Start local Postgres and Redis
docker compose up -d

# 3. Create local environment
cp .env.example .env

# 4. Generate Prisma client and apply migrations
pnpm prisma:generate
pnpm prisma:migrate
```

`docker-compose.yml` starts Postgres on `localhost:5432` with database
`opulus`, username `postgres`, password `password`, plus Redis on
`localhost:6379`.

### Run

From the repo root:

```bash
pnpm dev:backend      # API on http://localhost:8080, core in watch mode
pnpm dev:frontend     # frontend on http://localhost:5173, gems in watch mode
pnpm dev:webhooks     # webhook receiver on http://localhost:8081, core in watch mode
```

The root scripts are thin wrappers around `pnpm --filter ...` commands. You can
also run package scripts directly from each workspace.

### Demo mode

Demo mode is intended for portfolio display. It returns static fixtures instead
of touching auth, Plaid, the API, or the database.

```bash
DEMO_MODE=true pnpm dev:backend
VITE_DEMO_MODE=true pnpm dev:frontend
```

See `docs/DEMO_MODE_IMPLEMENTATION.md` for the implementation notes.

## Useful Commands

Run these from the repo root unless noted.

| Command                 | What                                      |
| ----------------------- | ----------------------------------------- |
| `pnpm install`          | Install all workspace dependencies        |
| `pnpm dev:frontend`     | Run frontend + gems watch mode            |
| `pnpm dev:backend`      | Run backend + core watch mode             |
| `pnpm dev:webhooks`     | Run webhook service + core watch mode     |
| `pnpm build`            | Build core, then all workspace packages   |
| `pnpm lint`             | Run lint scripts across workspaces        |
| `pnpm format`           | Run formatting across workspaces          |
| `pnpm type-check`       | Run TypeScript checks across workspaces   |
| `pnpm prisma:generate`  | Generate Prisma client via `@opulus/core` |
| `pnpm prisma:migrate`   | Apply local Prisma migrations             |
| `pnpm prisma:studio`    | Open Prisma Studio                        |

## Architecture

### Plaid link and account data

1. The frontend requests a Plaid Link token from the backend.
2. Plaid Link returns a public token after the user selects an institution.
3. The backend exchanges that public token for an access token.
4. Core services persist the Plaid item and normalized account data.
5. The frontend reads connected items through typed DTOs from `@opulus/core`.

### Webhook processing

Plaid webhook callbacks are acknowledged quickly, then queued for background
work:

```
Plaid webhook -> opulus-webhooks -> Redis/BullMQ -> handler -> core services
```

That keeps provider callbacks fast while still allowing retries, observability,
and a separate worker process for heavier sync work.

### Shared package boundaries

- `@opulus/core` owns Prisma, external clients, business services, config, and
  DTOs shared between apps.
- `@opulus/gems` owns reusable UI primitives and styles.
- App packages consume those shared packages instead of duplicating contracts.

## Environment

Copy `.env.example` to `.env` and fill in local values.

| Var                    | Default / Example                                      | Notes |
| ---------------------- | ------------------------------------------------------ | ----- |
| `DATABASE_URL`         | `postgresql://postgres:password@localhost:5432/opulus?schema=public` | Local Postgres URL |
| `REDIS_HOST`           | `localhost`                                            | Webhook queue Redis host |
| `REDIS_PORT`           | `6379`                                                 | Webhook queue Redis port |
| `BETTER_AUTH_SECRET`   | _none_                                                 | Generate with `openssl rand -base64 32` |
| `BETTER_AUTH_BASE_URL` | `http://localhost:8080`                                | Backend auth base URL |
| `PLAID_CLIENT_ID`      | _sandbox client id_                                    | Plaid sandbox credential |
| `PLAID_SECRET`         | _sandbox secret_                                       | Plaid sandbox credential |
| `PLAID_ENV`            | `sandbox`                                              | Keep public/demo work in sandbox |
| `PLAID_WEBHOOK_URL`    | _blank_                                                | Public tunnel URL for local webhook tests |
| `CLIENT_URL`           | `http://localhost:5173`                                | CORS origin for frontend |
| `PORT`                 | `8080`                                                 | Backend API port |
| `WEBHOOK_PORT`         | `8081`                                                 | Webhook receiver port |
| `DEMO_MODE`            | `false`                                                | Backend demo-mode switch |
| `VITE_DEMO_MODE`       | `false`                                                | Frontend demo-mode switch |

## Service Documentation

- [Backend](./opulus-backend/README.md) - Express API, auth, endpoints, Bruno testing
- [Frontend](./opulus-frontend/README.md) - React app, routing, query hooks, UI integration
- [Webhooks](./opulus-webhooks/README.md) - Plaid webhook receiver, queueing, local tunnel setup
- [Core](./opulus-core/README.md) - Shared services, Prisma, DTOs, Plaid client
- [Gems](./opulus-gems/README.md) - Shared component library and Storybook notes
- [Docs](./docs/README.md) - Demo mode, observability, and transaction privacy notes

