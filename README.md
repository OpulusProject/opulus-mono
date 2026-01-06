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

# Or download from https://www.docker.com/
```

**Install zrok** (for webhook tunneling):
```bash
# Using Homebrew (macOS)
brew install zrok/tap/zrok

# Or download from https://zrok.io/
```

After installation, authenticate:
```bash
zrok enable <your-token>
# Get your token from https://zrok.io/
```

## Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd opulus-mono
pnpm install
```

### 2. Set Up Database (Docker)

Start PostgreSQL:

```bash
docker-compose up -d
```

This starts PostgreSQL on `localhost:5432` with:
- Username: `postgres`
- Password: `password`
- Database: `postgres`

### 3. Configure Environment Variables

Create a `.env` file in the root directory:

```bash
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/postgres?schema=public"

# Better Auth
BETTER_AUTH_SECRET="your-secret-key-here"  # Generate with: openssl rand -base64 32
BETTER_AUTH_BASE_URL="http://localhost:8080"

# Plaid (get from https://dashboard.plaid.com/)
PLAID_CLIENT_ID="your-plaid-client-id"
PLAID_SECRET="your-plaid-secret"
PLAID_ENV="sandbox"  # sandbox, development, or production
PLAID_WEBHOOK_URL="https://opuluswebhooks.share.zrok.io"  # Set after zrok setup

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

### 5. Start Development Servers

```bash
# Start backend (includes core watch mode)
pnpm dev:backend

# In another terminal, start frontend (includes gems watch mode)
pnpm dev:frontend
```

The application will be available at:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8080/api
- **Webhooks**: http://localhost:8081 (if running `pnpm dev:webhooks`)

### 6. Set Up Webhook Tunneling (zrok)

After installing and authenticating zrok (see Prerequisites), use the pnpm script to start webhooks with tunneling:

```bash
pnpm dev:webhooks:tunnel
```

**Note:** The webhook URL is automatically included in Plaid link tokens - no Dashboard configuration needed!

## Development

Run individual services:

```bash
pnpm dev:backend    # Backend + Core watch mode
pnpm dev:frontend   # Frontend + Gems watch mode
pnpm dev:webhooks   # Webhook server + Core watch mode
```

## Building

Build all packages:

```bash
pnpm build
```

Build individual packages:

```bash
pnpm build:core    # Core package (must be built first)
pnpm build:gems    # UI component library
```

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

## Notes

- Gems package runs in watch mode during `pnpm dev`
- Frontend watches for changes in gems `dist/` folder
- All packages use pnpm workspaces for dependency management
- pnpm uses a content-addressable store for faster installs and less disk space

