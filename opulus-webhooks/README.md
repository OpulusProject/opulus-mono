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
- **Handlers**: Process ITEM, LINK, TRANSACTIONS webhooks

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
- **Job Retention**:
  - Completed: 24 hours, max 1000 jobs
  - Failed: 7 days (Dead Letter Queue)

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

Failed jobs go to Dead Letter Queue (DLQ):

- Kept for 7 days
- Can be manually reprocessed
- Check logs for failure reasons

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
│   │   │   ├── link/         # LINK webhook handlers
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
longer than that, run a cursor-based catch-up against every item. This talks
to Plaid and Postgres directly — it does not need the HTTP server or Redis.

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
