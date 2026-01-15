# Opulus Monorepo

Monorepo for Opulus financial management platform.

## Structure

- `opulus-backend/` - Express.js backend API
- `opulus-frontend/` - React frontend application
- `opulus-gems/` - Shared UI component library
- `opulus-core/` - Shared core logic and types
- `opulus-webhooks/` - Webhook receiver service

## Prerequisites

- **Node.js** >= 18.0.0
- **pnpm** >= 8.0.0
- **Docker** (for PostgreSQL database)
- **PostgreSQL** 15+ (via Docker or local installation)

### Installing Prerequisites

**Install Node.js:**
```bash
# Using Homebrew (macOS)
brew install node

# Or download from https://nodejs.org/
```

**Install pnpm:**
```bash
# Using Homebrew (macOS)
brew install pnpm

# Or using npm
npm install -g pnpm

# Or using corepack (Node.js 16+)
corepack enable
corepack prepare pnpm@latest --activate
```

**Install Docker:**
```bash
# Using Homebrew (macOS)
brew install --cask docker
brew install docker-compose

# Or download from https://www.docker.com/
```

## Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd opulus-mono

# Install dependencies (recommended: pnpm)
pnpm install
```

### 2. Set Up Services (Docker)

Start PostgreSQL and Redis:

```bash
docker-compose up -d
```

This starts:
- **PostgreSQL** on `localhost:5432`:
  - Username: `postgres`
  - Password: `password`
  - Database: `opulus`
- **Redis** on `localhost:6379`:
  - Used for webhook queue processing
  - No password required for local dev

### 3. Configure Environment Variables

Create a `.env` file in the root directory:

```bash
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/opulus?schema=public"

# Redis (for webhook queue)
REDIS_HOST=localhost
REDIS_PORT=6379
# REDIS_PASSWORD=  # Optional, not needed for local dev

# Better Auth
BETTER_AUTH_SECRET="your-secret-key-here"  # Generate with: openssl rand -base64 32
BETTER_AUTH_BASE_URL="http://localhost:8080"

# Plaid (get from https://dashboard.plaid.com/)
PLAID_CLIENT_ID="your-plaid-client-id"
PLAID_SECRET="your-plaid-secret"
PLAID_ENV="sandbox"  # sandbox or production
PLAID_WEBHOOK_URL=""  # Set after zrok tunnel setup (see webhooks README)

# Application
CLIENT_URL="http://localhost:5173"
PORT=8080
WEBHOOK_PORT=8081
```

### 4. Set Up Database Schema

```bash
# Generate Prisma client
pnpm prisma:generate

# Run migrations
pnpm prisma:migrate
```
## Development

### Running Services

```bash
pnpm dev:backend    # Backend API + Core watch mode
pnpm dev:frontend   # Frontend app + Gems watch mode
pnpm dev:webhooks   # Webhook service + Core watch mode + Queue worker
```

**Note:** Each service has its own README with detailed setup instructions (see Service Documentation below).


## Workspace Packages

- `@opulus/core` - Core logic, services, and types
- `@opulus/gems` - UI component library
- `@opulus/frontend` - Frontend application
- `@opulus/backend` - Backend API
- `@opulus/webhooks` - Webhook receiver service

## Database Management

```bash
# Generate Prisma client (after schema changes)
pnpm prisma:generate

# Create and run migrations
pnpm prisma:migrate

# Open Prisma Studio (database GUI)
pnpm prisma:studio

# Deploy migrations (production)
pnpm prisma:migrate:deploy
```

## Workspace Scripts

All workspaces support these scripts:

- `dev` - Start development server
- `build` - Build for production
- `lint` - Run linter
- `format` - Format code
- `type-check` - TypeScript type checking

Run scripts across all workspaces:

```bash
pnpm lint    # Runs lint in all workspaces
pnpm format  # Runs format in all workspaces
pnpm type-check  # Runs type-check in all workspaces
```

## Development Workflow

1. Make changes to `opulus-gems` - changes auto-rebuild
2. Frontend automatically picks up rebuilt gems
3. No need to manually rebuild or restart servers

## Service Documentation

Each service has its own comprehensive README with detailed setup instructions:

- **[Backend](./opulus-backend/README.md)** - Express API, endpoints, Bruno testing, deployment
- **[Frontend](./opulus-frontend/README.md)** - React app, routing, build, deployment
- **[Webhooks](./opulus-webhooks/README.md)** - Webhook receiver, zrok tunneling, queue system, testing
- **[Core](./opulus-core/README.md)** - Shared services, database, types, utilities
- **[Gems](./opulus-gems/README.md)** - UI component library, Storybook, usage

## Development Notes

- **Watch Mode**: Gems and Core packages run in watch mode during `pnpm dev:*`
- **Hot Reload**: Frontend watches for changes in gems `dist/` folder automatically
- **Dockerfiles**: For hosting only (Railway) - use Node.js directly for local development
- **Workspaces**: All packages use pnpm workspaces for dependency management
- **Performance**: pnpm uses a content-addressable store for faster installs and less disk space

## Additional Resources

- [Webhook Testing](./opulus-webhooks/TESTING.md) - Webhook testing guide
- [Bruno Collections](./opulus-backend/bruno/README.md) - API testing documentation

