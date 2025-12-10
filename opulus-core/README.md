# @opulus/core

Core business logic and shared infrastructure for Opulus.

## What's Included

- **Database**: Prisma client and schema
- **External APIs**: Plaid client
- **Services**: Business logic services (plaid, linkSession, user)
- **Utils**: Error handling, Plaid error handling
- **Config**: Shared configuration

## Usage

```typescript
import { prisma, plaidClient, createLinkToken, getUser, UnauthorizedError } from '@opulus/core';
```

## Prisma

Prisma schema and migrations are managed here. To run migrations:

```bash
pnpm prisma:migrate
```

## Development

Build the package:

```bash
pnpm build
```

Watch mode:

```bash
pnpm dev
```


