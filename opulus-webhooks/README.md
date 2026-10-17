# @opulus/webhooks

Webhook receiver service for Opulus. Handles incoming webhook events from external services (e.g., Plaid) with reliable async processing using Redis + BullMQ.

## Overview

This package provides a dedicated Express server for receiving and processing webhook events. It runs independently from the main backend API on a separate port (default: 8081) and includes:

- **HTTP Handler**: Receives webhooks, acknowledges immediately, enqueues for processing
- **Queue Worker**: Processes events asynchronously with automatic retries
- **Redis Queue**: Reliable job processing with BullMQ

## Architecture

```
Plaid Webhook → Express Handler → Redis Queue → BullMQ Worker → Process Event
```

- **Handler**: Acknowledges immediately (~5ms), enqueues job
- **Queue**: Stores jobs temporarily with retry support
- **Worker**: Processes jobs concurrently (5 at a time) with automatic retries
- **Handlers**: Process HOLDINGS, ITEM, LIABILITIES, TRANSACTIONS webhooks

## Prerequisites

- Redis running (via Docker Compose or local installation)
- zrok installed and configured (see Local Development section)
- See [main README](../README.md) for full prerequisites

## Queue System

### How It Works

1. **Webhook arrives** → Express handler receives it
2. **Acknowledge immediately** → Returns 200 OK to Plaid (~5ms)
3. **Enqueue job** → Stores event in Redis queue
4. **Worker processes** → Background worker picks up job and processes it
5. **Retry on failure** → Automatic retries (3 attempts, exponential backoff)

### Configuration

- **Concurrency**: 5 jobs processed simultaneously
- **Retries**: 3 attempts with exponential backoff (2s → 4s → 8s)
- **Rate Limit**: 10 jobs per second
- **Request rate limit**: 120 requests per minute per IP address on `/webhook/plaid` (`WEBHOOK_RATE_LIMIT_PER_IP`), counted in Redis and **before** the signature is checked, because checking it fetches Plaid's key; over it the receiver answers `429`
- **Job Retention**:
  - Completed: 24 hours, max 1000 jobs
  - Failed: 7 days in Redis; every job is also recorded in Postgres, and one that failed for good stays replayable (see Webhook events)

### Monitoring

Queue events are logged in development:

- Job started/completed
- Job failed (with retry count)
- Job stalled

## Local Development with zrok

zrok provides secure tunneling for local webhook development. You'll need to register for a free account first.

### Setup zrok

1. **Register for zrok**: Follow the [zrok setup documentation](https://docs.zrok.io/) to create an account and install zrok CLI.

2. **Enable zrok**:
   ```bash
   zrok enable
   ```

### Temporary Share

A **temporary share** is perfect for local development and testing. The URL changes each session, but it's simpler to set up.

1. **Start webhook service**:

   ```bash
   # Terminal 1
   pnpm dev:webhooks
   ```

2. **Start zrok tunnel**:

   ```bash
   # Terminal 2
   zrok share public http://localhost:8081 --backend-mode web
   ```

3. **Copy the URL** from zrok output (e.g., `https://abc123.share.zrok.io`)

4. **Update `.env`**:

   ```bash
   PLAID_WEBHOOK_URL=https://abc123.share.zrok.io/webhook/plaid
   ```

5. **Update Plaid Dashboard** with the new webhook URL

**Note:** The URL changes each time you run `zrok share`. You'll need to update Plaid Dashboard when restarting the tunnel.

## Testing Webhooks

### Test Transaction Webhook

1. **Start services**:

   ```bash
   # Terminal 1: Start Redis
   docker-compose up -d redis

   # Terminal 2: Start webhook service
   pnpm dev:webhooks
   ```

2. **Connect bank account** via Plaid Link (sandbox mode)

3. **Watch logs** - You should see:
   ```
   [WEBHOOK] Enqueued TRANSACTIONS:SYNC_UPDATES_AVAILABLE for processing
   [WEBHOOK QUEUE] Processing TRANSACTIONS:SYNC_UPDATES_AVAILABLE (attempt 1/3)
   [WEBHOOK QUEUE] Successfully processed TRANSACTIONS:SYNC_UPDATES_AVAILABLE
   ```

### Balances and the balance history

Every transactions sync also stores the balances Plaid lists with the
transactions, in the same database transaction (they are at least as recent as
the transactions). The balance history is not stored: the backend works a past
day's balance out from an account's live balance and its posted transactions
after that day, so a transaction that is added, changed or removed shows in the
history the next time it is read.

## Troubleshooting

### Queue Not Processing

1. **Check Redis connection**:

   ```bash
   redis-cli ping
   # Should return: PONG
   ```

2. **Check worker logs**:
   - Look for "Webhook queue worker initialized"
   - Check for connection errors

3. **Verify handlers are set**:
   - Handlers are set in `src/server.ts`
   - Worker requires handlers before processing

### Jobs Stuck

1. **Check Redis**:

   ```bash
   redis-cli
   > KEYS bull:webhooks:*
   ```

2. **Check worker status**:
   - Look for "stalled" job warnings
   - Worker auto-retries stalled jobs

### Failed Jobs

### Webhook events

Every webhook the worker handles is recorded in the `webhook_event` table: the
whole event, its status, the attempts made, why the last one failed, and when it
was received and finished. Statuses: `processing`, `processed`, `retrying` (an
attempt failed and the job will run again) and `dead` (its retries are used up,
or it failed with an `UnrecoverableError`, so it will not run again). A dead job
is also logged at ERROR. Redis only keeps failed jobs for 7 days; the table keeps
them until someone deals with them. Recording is best effort: a database
failure is logged, never thrown, so it cannot fail a webhook.

To put a dead event back on the queue:

```bash
pnpm --filter @opulus/webhooks replay <webhookEventId>
```

An event can be replayed once (its `replayedAt` is set). The new job is recorded
as an event of its own, so if it fails again it is dead again, under a new id.
Find ids with
`SELECT id, "webhookType", "webhookCode", error, "receivedAt" FROM webhook_event WHERE status = 'dead' AND "replayedAt" IS NULL ORDER BY "receivedAt" DESC;`.
What happened to one item:
`SELECT "receivedAt", "webhookType", "webhookCode", status, attempts FROM webhook_event WHERE "plaidItemId" = '<plaid item id>' ORDER BY "receivedAt" DESC;`.

### zrok Issues

- **Not authenticated**: Run `zrok enable` first
- **Port already in use**: Change `WEBHOOK_PORT` in `.env`
- **Reserved share name invalid**: Must be lowercase alphanumeric, 4-32 chars
- **Reserved share already exists**: Use `zrok release <name>` first

## Structure

```
opulus-webhooks/
├── src/
│   ├── plaid/
│   │   ├── handlers/          # Webhook event handlers
│   │   │   ├── item/         # ITEM webhook handlers
│   │   │   ├── holdings/     # HOLDINGS webhook handlers
│   │   │   ├── liabilities/  # LIABILITIES webhook handlers
│   │   │   └── transactions/ # TRANSACTIONS webhook handlers
│   │   ├── handlePlaidWebhook.ts  # Main webhook handler
│   │   └── ...
│   ├── middleware/            # Verification and error handling
│   ├── types/                 # TypeScript type definitions
│   └── server.ts              # Express server entry point
├── Dockerfile                 # For Railway deployment
├── README.md                  # This file
└── TESTING.md                 # Detailed testing guide
```

## Dependencies

- `@opulus/core` - Core business logic and utilities (Prisma, Plaid client)
- `express` - HTTP server framework
- `bullmq` - Queue processing for async webhook handling
- `ioredis` - Redis client for queue backend

## Transaction reconcile

Plaid does not redeliver webhooks after ~24 hours. If the receiver was down
longer than that, run a cursor-based catch-up against every item: it syncs the
transactions, pulls the current holdings of any investment accounts, and its
recurring payments and income. This
talks to Plaid and Postgres directly — it does not need the HTTP server or Redis.

```bash
# All items
pnpm --filter @opulus/webhooks reconcile

# One item
pnpm --filter @opulus/webhooks reconcile -- --item <plaidItemId>
```

Needs `DATABASE_URL` and the same Plaid credentials the webhooks service uses.

### Railway (production)

Preferred: run from a local checkout of this repo so you get the source + `tsx`.
`railway run` injects the **webhooks service** env (prod DB + Plaid) into that
local process. Confirm the service name with `railway status`.

```bash
# link the CLI to the project once
railway link

# production catch-up (uses the webhooks service env)
railway run --service <webhooks-service> --environment production -- \
  pnpm --filter @opulus/webhooks reconcile
```

One item:

```bash
railway run --service <webhooks-service> --environment production -- \
  pnpm --filter @opulus/webhooks reconcile -- --item <plaidItemId>
```

If you would rather exec inside the running container (image has `dist/` only):

```bash
railway ssh --service <webhooks-service> --environment production
# from /app
node opulus-webhooks/dist/reconcile.js
# or
node opulus-webhooks/dist/reconcile.js --item <plaidItemId>
```

The CLI continues past a single-item failure and exits `1` if any item failed.

## Related Documentation

- [Main README](../README.md) - Repo-wide setup and prerequisites
- [Testing Guide](./TESTING.md) - Detailed webhook testing instructions
