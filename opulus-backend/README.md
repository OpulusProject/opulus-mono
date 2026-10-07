# @opulus/backend

Express.js backend API for Opulus financial management platform.

## Overview

RESTful API server built with Express.js, providing endpoints for authentication, Plaid integration, items, and transactions. Uses Better Auth for authentication and Prisma for database access.

## Prerequisites

- See [main README](../README.md) for repo-wide prerequisites
- PostgreSQL database (via Docker Compose or local installation)
- Environment variables configured (see Configuration section)

## API Endpoints

### Authentication (Better Auth)

All authentication routes are handled by Better Auth at `/api/auth/*`:

- `POST /api/auth/sign-up/email` - Register new user
- `POST /api/auth/sign-in/email` - Sign in with email/password
- `POST /api/auth/sign-out` - Sign out current user
- `POST /api/auth/two-factor/enable` - Enable 2FA
- `POST /api/auth/two-factor/verify` - Verify 2FA code
- `GET /api/auth/session` - Get current session (via Better Auth)

### Session

- `GET /api/session` - Get current user session

### Link Tokens

- `POST /api/link-tokens` - Create Plaid Link token (requires authentication)
- `POST /api/link-tokens/update` - Create Plaid Link token in update mode for an existing item (requires authentication)

### Institutions

- `GET /api/institutions` - Search Plaid institutions (requires authentication)

### Accounts

- `GET /api/accounts` - Get the user's accounts across all connections, optionally filtered by `type` (`depository`, `investment`, `credit`, `loan`, `other`; repeat the parameter for several, e.g. `?type=credit&type=loan`) (requires authentication)

### Items

- `GET /api/items` - Get all connected items for current user (requires authentication)
- `POST /api/items` - Exchange a Plaid public token and connect a new item (requires authentication)
- `POST /api/items/:id/update-accounts` - Re-sync an item's accounts with Plaid (requires authentication)
- `DELETE /api/items/:id` - Disconnect an item and delete its accounts and transactions (requires authentication)

### Transactions

- `GET /api/transactions` - Get transactions for current user (requires authentication)
  - Query params: `startDate`, `endDate`, `accountId` (optional)
- `POST /api/transactions/refresh` - Ask Plaid to refresh an item's transactions (requires authentication)

### Health Checks

- `GET /health` - Simple health check (no database connection)
- `GET /ready` - Readiness check (includes database connection)

## Authentication

The API uses Better Auth for authentication with session-based cookies.

### Protected Routes

Most routes require authentication. Include session cookie in requests:

```bash
# After signing in, cookies are automatically included
curl -X GET http://localhost:8080/api/items \
  -H "Cookie: better-auth.session_token=..."
```

### Session Management

- Sessions last 7 days by default
- Sessions refresh if user is active within last 24 hours
- Session cookies are HTTP-only and secure

## API Testing with Bruno

### Setup

1. **Install Bruno**:

   ```bash
   # macOS
   brew install --cask bruno

   # Or download from https://www.usebruno.com/
   ```

2. **Open Collection**:
   - Open Bruno
   - Select "Open Collection"
   - Navigate to `opulus-backend/bruno` folder

3. **Create Local Environment**:

   ```bash
   cp opulus-backend/bruno/environments/local.bru.example \
      opulus-backend/bruno/environments/local.bru
   ```

   Edit `local.bru` with your test credentials.

4. **Select Environment**:
   - Use environment dropdown (top-right in Bruno)
   - Select "local" for local development

### Testing Flow

1. **Sign Up** - Create a test user (`POST /api/auth/sign-up/email`)
2. **Sign In** - Authenticate (`POST /api/auth/sign-in/email`)
   - Bruno automatically stores session cookies
3. **Test Protected Routes** - All subsequent requests include session cookie
4. **Sign Out** - End session (`POST /api/auth/sign-out`)

See [bruno/README.md](./bruno/README.md) for detailed Bruno documentation.

## Development

### Run Development Server

```bash
# From repo root
pnpm dev:backend
```

This runs:

- Express server with hot reload
- Core package in watch mode (auto-rebuilds)

### Project Structure

```
opulus-backend/
├── src/
│   ├── auth.ts              # Better Auth configuration
│   ├── controllers/         # HTTP only: read the request, call a service, send the response
│   │   ├── accounts/
│   │   ├── institutions/
│   │   ├── items/
│   │   ├── linkTokens/
│   │   ├── session/
│   │   └── transactions/
│   ├── services/            # Business logic, one operation per file
│   │   ├── institutions/
│   │   ├── items/
│   │   ├── linkTokens/
│   │   └── transactions/
│   ├── middleware/          # Express middleware (the error handler is shared, in core)
│   │   ├── session/         # requireSession and getSession
│   │   └── validation.ts    # validate and validateQuery
│   ├── routes/              # API routes
│   │   ├── index.ts
│   │   ├── accounts.ts
│   │   ├── institutions.ts
│   │   ├── items.ts
│   │   ├── linkTokens.ts
│   │   └── transactions.ts
│   ├── types/
│   │   └── express.d.ts     # Request additions (validated body and query)
│   └── server.ts           # Express app entry point
├── bruno/                  # Bruno API collections
├── Dockerfile              # For Railway deployment
└── README.md              # This file
```

## Error Handling

The API uses a global error handler that:

- Returns appropriate HTTP status codes
- Provides error messages in development
- Hides sensitive errors in production
- Logs errors for debugging

## CORS Configuration

CORS is configured to allow requests from:

- `CLIENT_URL` environment variable (default: `http://localhost:5173`)
- Credentials are enabled for cookie-based authentication

## Related Documentation

- [Main README](../README.md) - Repo-wide setup and prerequisites
- [Bruno Collections](./bruno/README.md) - API testing documentation
- [Core Package](../opulus-core/README.md) - Repositories, gateways and types
- [Conventions](../docs/CONVENTIONS.md) - What each layer may do
