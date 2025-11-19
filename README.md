# Opulus Monorepo

Monorepo for Opulus financial management platform.

## Structure

- `opulus-backend/` - Express.js backend API
- `opulus-frontend/` - React frontend application
- `opulus-gems/` - Shared UI component library

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0

Install pnpm globally (if not already installed):

```bash
npm install -g pnpm
# or
corepack enable
corepack prepare pnpm@latest --activate
```

### Installation

Install all dependencies:

```bash
pnpm install
```

This will install dependencies for all workspaces.

### Development

Run all development servers:

```bash
pnpm dev
```

This will:
- Start `opulus-gems` in watch mode (auto-rebuilds on changes)
- Start `opulus-frontend` dev server

Run individual workspaces:

```bash
pnpm dev:backend    # Backend only
pnpm dev:frontend   # Frontend only
pnpm dev:gems       # Gems watch mode only
```

### Building

Build all packages:

```bash
pnpm build
```

Build individual packages:

```bash
pnpm build:gems
```

### Workspace Packages

Package names (for pnpm workspaces):

- `@opulus/gems` - UI component library (`opulus-gems`)
- `@opulus/frontend` - Frontend application (`opulus-frontend`)
- `@opulus/backend` - Backend API (`opulus-backend`)

### Importing from Gems

We use `@gems` as an import alias (configured in Vite/TypeScript):

```typescript
import { Button, Card, Input } from "@gems";
import "@gems/styles";
```

The alias `@gems` maps to `@opulus/gems` package.

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

