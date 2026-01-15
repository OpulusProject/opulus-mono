# @opulus/core

Core business logic, shared services, and infrastructure for Opulus.

## Overview

Shared package containing database access, external API clients, business logic services, types, and utilities used across all Opulus services.

## What's Included

### Database

- **Prisma Client** - Type-safe database access
- **Prisma Schema** - Database schema definitions
- **Migrations** - Database migration management

### External APIs

- **Plaid Client** - Plaid API integration
- **Plaid Service** - Plaid API wrapper with error handling

### Services

- **User Service** - User management
- **Item Service** - Plaid item management
- **Bank Account Service** - Bank account operations
- **Transaction Service** - Transaction operations
- **Link Session Service** - Plaid Link session management
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
import { plaidClient, plaidService } from "@opulus/core";

// Services
import { userService, itemService, transactionService } from "@opulus/core";

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
- BankAccount
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

## Services

### User Service

```typescript
import { userService } from "@opulus/core";

// Get user by ID
const user = await userService.getById(userId);

// Get user by email
const user = await userService.getByEmail(email);
```

### Item Service

```typescript
import { itemService } from "@opulus/core";

// Get item by Plaid item ID
const item = await itemService.getByPlaidItemId(plaidItemId);

// Get all items for user
const items = await itemService.getByUserId(userId);
```

### Transaction Service

```typescript
import { transactionService } from "@opulus/core";

// Get transactions for user
const transactions = await transactionService.getByUserId(userId, {
  startDate: new Date("2024-01-01"),
  endDate: new Date("2024-12-31"),
});
```

### Plaid Service

```typescript
import { plaidService } from "@opulus/core";

// Create link token
const linkToken = await plaidService.createLinkToken(userId);

// Exchange public token
const { access_token } = await plaidService.exchangePublicToken(publicToken);

// Sync transactions
const result = await plaidService.transactionsSync(accessToken, cursor);
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

See [main README](../../README.md) for required environment variables.

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
│   ├── services/
│   │   ├── userService.ts
│   │   ├── itemService.ts
│   │   ├── transactionService.ts
│   │   ├── plaidService.ts
│   │   ├── linkSessionService.ts
│   │   ├── bankAccountService.ts
│   │   └── queue/
│   │       └── webhookQueue.ts
│   ├── types/
│   │   ├── dto/             # Data transfer objects
│   │   └── plaid/           # Plaid types
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
  BankAccount,
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

- [Main README](../../README.md) - Repo-wide setup and prerequisites
- [Backend API](../opulus-backend/README.md) - API usage examples
