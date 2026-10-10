# Opulus

A personal finance dashboard prototype built around Plaid, transaction sync,
and a small design system.

Opulus is not a production financial product. It is a portfolio project that
explores the shape of a multi-service finance app: auth, bank-account linking,
transaction reads, webhook ingestion, async processing, shared DTOs, and a React
frontend.

> Demo and sandbox use only. Do not connect real financial accounts to a public
> deployment of this project.

## What's in the box

```
.
├── opulus-backend/              Express API, Better Auth, Bruno collections
│   ├── src/controllers/         HTTP-only handlers for session, Plaid, items, transactions
│   ├── src/services/            business logic, one operation per file (delete an item, ...)
│   ├── src/middleware/          session auth and request validation
│   ├── src/routes/              API route registration
│   └── bruno/                   API client collections and local/prod environments
├── opulus-frontend/             React + Vite + TanStack Router/Query app
│   ├── src/common/              app layout, sidebar, shared UI glue
│   ├── src/hooks/               auth, Plaid, items, transactions hooks
│   ├── src/lib/                 API and auth clients
│   ├── src/pages/               dashboard, accounts, login, 2FA, settings
│   └── src/routes/              file-based TanStack Router routes
├── opulus-core/                 Shared Prisma, Plaid gateway, repositories, DTOs, config
│   ├── prisma/                  schema and migrations
│   ├── src/repositories/        data access, one per model
│   ├── src/gateways/            the Plaid API wrapper
│   └── src/services/            business logic shared by the backend and webhooks
├── opulus-webhooks/             Plaid webhook receiver + Redis/BullMQ worker
├── docs/                        Notes on observability and privacy
├── docker-compose.yml           Local Postgres + Redis
├── package.json                 pnpm workspace orchestration
└── pnpm-workspace.yaml          Declares the workspace packages
```

## Stack


| Layer        | Choice                                                  |
| ------------ | ------------------------------------------------------- |
| Frontend     | React · Vite · TanStack Router · TanStack Query         |
| UI           | Tailwind CSS · Radix UI · shadcn/ui components           |
| Backend      | Express · Better Auth · Prisma                          |
| Integrations | Plaid sandbox · Plaid webhooks                          |
| Storage      | PostgreSQL · Redis for webhook jobs                     |
| Queueing     | BullMQ                                                  |
| Tooling      | pnpm workspaces · TypeScript · tsup                     |
| API testing  | Bruno collections                                       |


## Public Repo Notes

This repo is best read as a working prototype and portfolio case study. A few
things are intentionally scoped that way:

- Plaid should be used in sandbox mode for local development.
- Transaction privacy work is documented in `docs/TRANSACTION_PRIVACY.md`, but
this repo should not be treated as production-ready financial infrastructure.
- Local `.env` files are ignored. Use `.env.example` as the public template.

## Local Development

### Prereqs

- Node 18+
- pnpm 9 (`corepack enable` will use the version pinned in `package.json`)
- Docker Desktop
- Plaid sandbox credentials

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
pnpm dev:frontend     # frontend on http://localhost:5173
pnpm dev:webhooks     # webhook receiver on http://localhost:8081, core in watch mode
```

The root scripts are thin wrappers around `pnpm --filter ...` commands. You can
also run package scripts directly from each workspace.

## Useful Commands

Run these from the repo root unless noted.


| Command                | What                                      |
| ---------------------- | ----------------------------------------- |
| `pnpm install`         | Install all workspace dependencies        |
| `pnpm dev:frontend`    | Run the frontend dev server               |
| `pnpm dev:backend`     | Run backend + core watch mode             |
| `pnpm dev:webhooks`    | Run webhook service + core watch mode     |
| `pnpm build`           | Build core, then all workspace packages   |
| `pnpm lint`            | Run lint scripts across workspaces        |
| `pnpm format`          | Run formatting across workspaces          |
| `pnpm type-check`      | Run TypeScript checks across workspaces   |
| `pnpm prisma:generate` | Generate Prisma client via `@opulus/core` |
| `pnpm prisma:migrate`  | Apply local Prisma migrations             |
| `pnpm prisma:studio`   | Open Prisma Studio                        |


## Architecture

### Plaid link and account data

1. The frontend requests a Plaid Link token from the backend.
2. Plaid Link returns a public token after the user selects an institution.
3. The backend exchanges that public token for an access token.
4. A backend service persists the Plaid item and normalized account data through
   core repositories.
5. The frontend reads connected items through typed DTOs from `@opulus/core`.

### Webhook processing

Plaid webhook callbacks are acknowledged quickly, then queued for background
work:

```
Plaid webhook -> opulus-webhooks -> Redis/BullMQ -> handler -> service -> core repositories
```

That keeps provider callbacks fast while still allowing retries, observability,
and a separate worker process for heavier sync work.

### Shared package boundaries

- `@opulus/core` owns Prisma, repositories (data access), gateways (external
  APIs), the services both apps share, config, and the DTOs shared between apps.
- Controllers call services, and services call repositories and gateways. See
  [Conventions](./docs/CONVENTIONS.md) for what each layer may do.
- UI primitives (shadcn/ui) live in `opulus-frontend/src/components/ui`.
- App packages consume `@opulus/core` instead of duplicating contracts.

## Environment

Keep a single `.env` at the monorepo root. The backend and webhooks services
read it via symlinks so there's only one file to edit:

```bash
cp .env.example .env               # fill in local values
ln -s ../.env opulus-backend/.env
ln -s ../.env opulus-webhooks/.env
```

Each service still loads env with plain `import "dotenv/config"`; the symlink
means every process ends up reading the root file. Production (Railway)
containers have no `.env` and env comes from the platform — no symlinks there.


| Var                    | Default / Example                                                    | Notes                                     |
| ---------------------- | -------------------------------------------------------------------- | ----------------------------------------- |
| `DATABASE_URL`         | `postgresql://postgres:password@localhost:5432/opulus?schema=public` | Local Postgres URL                        |
| `REDIS_HOST`           | `localhost`                                                          | Webhook queue Redis host                  |
| `REDIS_PORT`           | `6379`                                                               | Webhook queue Redis port                  |
| `BETTER_AUTH_SECRET`   | *none*                                                               | Generate with `openssl rand -base64 32`   |
| `BETTER_AUTH_BASE_URL` | `http://localhost:8080`                                              | Backend auth base URL                     |
| `ITEM_TOKEN_ENCRYPTION_KEY` | *none*                                                          | Required. `openssl rand -base64 32`; encrypts Plaid access tokens at rest |
| `PLAID_CLIENT_ID`      | *sandbox client id*                                                  | Plaid sandbox credential                  |
| `PLAID_SECRET`         | *sandbox secret*                                                     | Plaid sandbox credential                  |
| `PLAID_ENV`            | `sandbox`                                                            | Keep public/demo work in sandbox          |
| `PLAID_WEBHOOK_URL`    | *blank*                                                              | Public tunnel URL for local webhook tests |
| `CLIENT_URL`           | `http://localhost:5173`                                              | CORS origin for frontend                  |
| `PORT`                 | `8080`                                                               | Backend API port                          |
| `WEBHOOK_PORT`         | `8081`                                                               | Webhook receiver port                     |


## Service Documentation

- [Backend](./opulus-backend/README.md) - Express API, auth, endpoints, Bruno testing
- [Frontend](./opulus-frontend/README.md) - React app, routing, query hooks, UI integration
- [Webhooks](./opulus-webhooks/README.md) - Plaid webhook receiver, queueing, local tunnel setup
- [Core](./opulus-core/README.md) - Repositories, gateways, Prisma, DTOs
- [Docs](./docs/README.md) - Conventions, observability and transaction privacy notes

