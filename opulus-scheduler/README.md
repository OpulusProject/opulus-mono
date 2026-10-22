# @opulus/scheduler

Runs Opulus's recurring jobs. Each job is a name, a schedule and a call to a core service; BullMQ (on the same Redis as the webhooks service) keeps the schedule, runs the jobs one at a time, and retries a failed run.

## Jobs

| Job | When (UTC) | What |
| --- | --- | --- |
| `refresh-exchange-rates` | `0 17 * * *` (daily, after the European Central Bank publishes), and once on start | `refreshExchangeRates()` from core: fills `exchange_rate` with about two years of daily rates when it is empty, then adds the days since the latest stored one |
| `refresh-security-prices` | every `SECURITY_PRICES_INTERVAL_MINUTES` (15 by default), and once on start | `refreshSecurityPrices()` from core: quotes every security (held or not) by the provider symbol worked out from its ticker and exchange, and stores the price as today's in `security_price`, so the last quote of a day is its close. A security the provider has no price for is logged and keeps its last price; it is asked about again next time |
| `backfill-security-prices` | every 5 minutes, and once on start | `backfillSecurityPrices()` from core: fetches up to two years of daily closes (a batch of 20 securities per run) for securities whose history has not been fetched; one the provider has no history for is recorded as done |

### Adding a job

1. Put the work in a core service (`opulus-core/src/services/`), so it can be tested and run elsewhere.
2. Add an entry to `src/jobs/index.ts`: a description, a cron `pattern` (UTC), `runOnStart`, and `run` calling the service.

That is all: on start the scheduler registers every job's schedule (`upsertJobScheduler`) and removes schedules whose job is gone, and the jobs API and `run-job` can run it by name. A job file may not import Prisma or a gateway (a lint rule); the service does that.

## How it runs

```
BullMQ job scheduler (cron in UTC, or every N minutes) -> "scheduler" queue (Redis) -> worker -> job -> core service
```

- **Schedules** are stored in Redis, so several instances starting at once still schedule each run once.
- **Retries**: a run that throws is retried twice more (2s, then 4s later), then marked failed. Completed runs are kept 7 days (at most 500), failed ones 30 days.
- **On start**: jobs with `runOnStart` run once, so a fresh deploy fills its tables without waiting a day. `SCHEDULER_RUN_ON_START=false` turns that off.
- **Migrations** are not run by this service; the backend and webhooks services apply them on start. If the scheduler starts first and the table is missing, the run fails and the next one succeeds.

## HTTP

Port `SCHEDULER_PORT` (default 8082).

| Route | What |
| --- | --- |
| `GET /health` | The process is up |
| `GET /ready` | The database and Redis answer, and the worker is running (503 otherwise) |
| `POST /jobs/:name/runs` | Run a job now. 202 with the run |
| `GET /jobs/:name/runs/:id` | A run's state, attempts, result or error |

The `/jobs` routes exist only when `SCHEDULER_ADMIN_TOKEN` is set, and every request needs `Authorization: Bearer <SCHEDULER_ADMIN_TOKEN>` (401 otherwise). An unknown job or run is 404.

```bash
curl -X POST -H "Authorization: Bearer $SCHEDULER_ADMIN_TOKEN" http://localhost:8082/jobs/refresh-exchange-rates/runs
```
```json
{ "data": { "id": "3", "job": "refresh-exchange-rates", "state": "waiting", "attempts": 0, "result": null, "error": null,
            "queuedAt": "2026-10-12T23:38:43.152Z", "startedAt": null, "finishedAt": null } }
```
```bash
curl -H "Authorization: Bearer $SCHEDULER_ADMIN_TOKEN" http://localhost:8082/jobs/refresh-exchange-rates/runs/3
```
```json
{ "data": { "id": "3", "job": "refresh-exchange-rates", "state": "completed", "attempts": 1,
            "result": { "from": "2026-10-12", "to": "2026-10-12", "days": 1, "created": 0 }, "error": null,
            "queuedAt": "2026-10-12T23:38:43.152Z", "startedAt": "2026-10-12T23:38:43.153Z", "finishedAt": "2026-10-12T23:38:43.202Z" } }
```
The response shape is `JobRunResponse` in `@opulus/core` (`types/dto/jobs`).

## Configuration

| Var | Default | Notes |
| --- | --- | --- |
| `DATABASE_URL` | | Same database as the other services |
| `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_TLS` | `localhost`, `6379` | Same Redis as the webhooks service |
| `SCHEDULER_PORT` | `8082` | HTTP port (listens on `::`) |
| `SCHEDULER_ADMIN_TOKEN` | *unset* | Turns on the jobs API; generate with `openssl rand -base64 32` |
| `SCHEDULER_RUN_ON_START` | `true` | `false` to skip the start-up runs |
| `EXCHANGE_RATES_CRON` | `0 17 * * *` | When `refresh-exchange-rates` runs (UTC) |
| `SECURITY_PRICES_INTERVAL_MINUTES` | `15` | How often `refresh-security-prices` runs: a whole number of minutes from 1 to 1440 (anything else is ignored, with a warning, and 15 is used) |
| `YAHOO_FINANCE_BASE_URL` | `https://query1.finance.yahoo.com` | Where prices come from (read by core) |
| `FRANKFURTER_BASE_URL` | `https://api.frankfurter.dev/v1` | Where rates come from (read by core) |

## Local development

```bash
pnpm dev:scheduler                                          # from the repo root: core in watch mode + the scheduler
pnpm --filter @opulus/scheduler run-job refresh-exchange-rates   # run one job now, without the queue
```

Needs Postgres and Redis (`docker compose up -d` at the root) and the root `.env` (symlink it like the other services: `ln -s ../.env opulus-scheduler/.env`).

### Railway (production)

Deploy it as its own service from `opulus-scheduler/Dockerfile`, with the same `DATABASE_URL` and Redis variables as the webhooks service.

**Keep it private: do not give it a public domain.** Only our own services should be able to reach it, and Railway services in the same project and environment can already reach each other over private networking (`<service>.railway.internal:8082`). Nothing calls the jobs API in production anyway: to run a job by hand use `run-job` (below), which needs no HTTP. The server listens on `::` (IPv4 and IPv6) so private networking works in older Railway environments too. The admin token stays as a second layer in case a domain is ever added by mistake; the endpoints are not rate limited, which is fine while the service is private, but would need a limit if it were ever exposed.

Run a job by hand:

```bash
railway run --service <scheduler-service> --environment production -- \
  pnpm --filter @opulus/scheduler run-job refresh-exchange-rates
```

## Tests

- `opulus-tests/services/scheduler`: the jobs API and what each job stores, run through this HTTP API against a stub of Frankfurter (`pnpm --filter @opulus/tests test:services-scheduler`; part of the Service API Tests workflow).
- `opulus-tests/integration/scheduler`: the refresh job against the real Frankfurter API (`test:integration-scheduler`; the Scheduler Integration workflow, nightly and on changes to the scheduler or the rate code).
