# @opulus/webhooks

Webhook receiver service for Opulus. Handles incoming webhook events from external services (e.g., Plaid).

## Overview

This package provides a dedicated Express server for receiving and processing webhook events. It runs independently from the main backend API on a separate port (default: 8081).

## Structure

```
opulus-webhooks/
├── src/
│   ├── handlers/          # Webhook event handlers
│   ├── middleware/        # Verification and error handling
│   ├── services/          # Webhook processing logic
│   ├── types/            # TypeScript type definitions
│   └── server.ts         # Express server entry point
├── package.json
└── tsconfig.json
```

## Usage

### Development

```bash
pnpm dev:webhooks
```

### Production

```bash
pnpm --filter @opulus/webhooks build
pnpm --filter @opulus/webhooks start
```

## Configuration

Set the following environment variables:

- `WEBHOOK_PORT` - Port for webhook server (default: 8081)
- `PLAID_SECRET` - Plaid secret for webhook signature verification
- `DATABASE_URL` - Database connection string (if needed)

## Webhook Endpoint

- **URL**: `POST /webhook`
- **Verification**: Uses HMAC SHA256 signature verification via `plaid-verification` header
- **Response**: Returns 200 with success message on successful processing

## Supported Webhooks

Currently handles Plaid webhook events:

- **TRANSACTIONS**: Transaction updates
- **ITEM**: Item status changes
- **AUTH**: Authentication events

## Dependencies

- `@opulus/core` - Core business logic and utilities
- `express` - HTTP server framework

