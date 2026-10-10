# @opulus/core

Core business logic, shared services, and infrastructure for Opulus.

## Overview

Shared package containing repositories (data access), gateways (external APIs), the business logic the backend and webhooks service share, types, and utilities used across all Opulus apps.

## What's Included

### Database

- **Prisma Client** - Type-safe database access
- **Prisma Schema** - Database schema definitions
- **Migrations** - Database migration management

### External APIs

- **Plaid Client** - Plaid API integration
- **Plaid Gateway** - Plaid API wrapper with error handling

### Repositories

Data access, one per model.

- **User Repository** - Users
- **Item Repository** - Plaid items
- **Account Repository** - Accounts
- **Transaction Repository** - Transactions
- **Liability Repository** - Account liabilities, and the normalizers for Plaid's liability shapes
- **Link Session Repository** - Plaid Link sessions

### Services

Business logic that both the backend and the webhooks service need. Logic only one app needs lives in that app.

- **`syncItemTransactions`**, **`syncItemLiabilities`** - Pull an item's data from Plaid and store it

### Other

- **Webhook Queue** - Queue system for webhook processing (Redis + BullMQ)

### Types

- **DTOs** - Data transfer objects for API requests/responses
- **Plaid Types** - Plaid API type definitions

### Utilities

- **Error Handling** - Custom error classes (`AppError`, `ValidationError`, etc.)
- **Plaid Error Handling** - Plaid-specific error conversion
- **Config** - Shared configuration management

## Usage

### Importing

```typescript
// Database
import { prisma } from "@opulus/core";

// Plaid
import { plaidClient, plaidGateway } from "@opulus/core";

// Repositories
import { userRepository, itemRepository, transactionRepository } from "@opulus/core";

// Types
import type { GetItemsResponse, Transaction } from "@opulus/core";

// Errors
import { AppError, ValidationError } from "@opulus/core";

// Config
import { config } from "@opulus/core";

// Queue (for webhooks)
import { webhookQueue, webhookWorker } from "@opulus/core";
```

## Database Management

### Prisma Schema

Located at `prisma/schema.prisma`. Contains all database models:

- User
- Session
- Item
- Account
- Transaction
- LinkSession
- TwoFactor

### Generate Prisma Client

After schema changes:

```bash
# From repo root
pnpm prisma:generate
```

### Run Migrations

```bash
# Create and apply migrations
pnpm prisma:migrate

# Deploy migrations (production)
pnpm prisma:migrate:deploy
```

### Prisma Studio

Open database GUI:

```bash
pnpm prisma:studio
```

## Repositories

### User Repository

```typescript
import { userRepository } from "@opulus/core";

// Get a user by ID
const user = await userRepository.get(userId);
```

### Item Repository

```typescript
import { itemRepository } from "@opulus/core";

// Get an item by Plaid's item ID
const item = await itemRepository.getByPlaidItemId(plaidItemId);

// Get all of a user's items, with their accounts
const items = await itemRepository.getAllByUserId(userId);
```

### Transaction Repository

```typescript
import { transactionRepository } from "@opulus/core";

// Get a user's transactions, filtered and paginated
const result = await transactionRepository.getAllByUserId(
  userId,
  { startDate: new Date("2024-01-01"), endDate: new Date("2024-12-31") },
  { page: 1, limit: 50 }
);
```

## Services

```typescript
import { syncItemLiabilities, syncItemTransactions } from "@opulus/core";

// Catch an item's transactions up from its stored cursor
await syncItemTransactions(plaidItemId);

// Fetch and store an item's liabilities
await syncItemLiabilities(item);
```

## Plaid

### Plaid Gateway

```typescript
import { plaidGateway } from "@opulus/core";

// Create link token
const linkToken = await plaidGateway.createLinkToken(userId);

// Exchange public token
const { access_token } = await plaidGateway.exchangePublicToken(publicToken);

// Sync transactions
const result = await plaidGateway.transactionsSync(accessToken, cursor);
```

## Configuration

Configuration is managed via environment variables:

```typescript
import { config } from "@opulus/core";

// Access config values
const port = config.port;
const databaseUrl = config.databaseUrl;
const plaidClientId = config.plaidClientId;
```

See [main README](../README.md) for required environment variables.

`ITEM_TOKEN_ENCRYPTION_KEY` (32 bytes, base64) is required: `Item.accessToken`
is encrypted by `itemRepository` on write and decrypted on read
(`utils/itemTokenCrypto.ts`), so services see plaintext and the database never
holds it. Call `assertItemTokenEncryptionKey()` at startup to fail fast.

## Error Handling

### Custom Errors

```typescript
import {
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
} from "@opulus/core";

// Throw custom errors
throw new ValidationError("Invalid input", { field: "email" });
throw new NotFoundError("User not found");
throw new UnauthorizedError("Invalid credentials");
```

### Plaid Error Handling

```typescript
import { handlePlaidError } from "@opulus/core";

try {
  await plaidClient.accountsGet({ access_token });
} catch (error) {
  const appError = handlePlaidError(error);
  // Returns AppError with appropriate status code
}
```

## Project Structure

```
opulus-core/
├── prisma/
│   ├── schema.prisma        # Database schema
│   └── migrations/          # Database migrations
├── src/
│   ├── client/
│   │   ├── prisma.ts        # Prisma client
│   │   └── plaid.ts         # Plaid client
│   ├── config/
│   │   └── default.ts       # Configuration
│   ├── repositories/    # Data access, one per model
│   │   ├── userRepository.ts
│   │   ├── itemRepository.ts
│   │   ├── accountRepository.ts
│   │   ├── transactionRepository.ts
│   │   ├── liabilityRepository.ts
│   │   └── linkSessionRepository.ts
│   ├── gateways/        # External APIs
│   │   └── plaidGateway.ts
│   ├── services/        # Business logic shared by the apps
│   │   ├── syncItemLiabilities.ts
│   │   └── syncItemTransactions.ts
│   ├── types/
│   │   └── dto/             # Data transfer objects
│   ├── utils/
│   │   ├── errors.ts        # Error classes
│   │   └── plaidErrors.ts   # Plaid error handling
│   └── index.ts             # Public API exports
└── README.md               # This file
```

## Dependencies

### Production

- `@prisma/client` - Prisma ORM client
- `plaid` - Plaid Node.js SDK
- `bullmq` - Queue processing
- `ioredis` - Redis client

### Development

- `prisma` - Prisma CLI for migrations
- `typescript` - TypeScript compiler

## Type Exports

All types are exported from the main entry point:

```typescript
// DTOs
import type {
  GetItemsResponse,
  GetTransactionsResponse,
  Account,
  Transaction,
} from "@opulus/core";

// Plaid types
import type { PlaidWebhookEvent } from "@opulus/core";
```

## Best Practices

1. **Always use services** - Don't access Prisma directly from other packages
2. **Use DTOs** - Use exported types for API contracts
3. **Handle errors** - Use custom error classes for consistent error handling
4. **Type safety** - All exports are fully typed

## Related Documentation

- [Main README](../README.md) - Repo-wide setup and prerequisites
- [Backend API](../opulus-backend/README.md) - API usage examples
