# @opulus/frontend

React frontend application for Opulus financial management platform.

## Overview

Modern React application built with Vite, TanStack Router, and TanStack Query. UI is built with shadcn/ui components (in `src/components/ui`) and communicates with the backend API.

## Prerequisites

- See [main README](../README.md) for repo-wide prerequisites
- Backend API running (for API calls)
- Environment variables configured (see Configuration section)

## Development

### Run Development Server

```bash
# From repo root
pnpm dev:frontend
```

This runs:
- Vite dev server with HMR

The app will be available at: **http://localhost:5173**

### Project Structure

```
opulus-frontend/
├── src/
│   ├── common/              # Shared components
│   │   ├── AppLayout/       # Main layout component
│   │   ├── AppSidebar/      # Sidebar navigation
│   │   └── LaunchLink/     # Plaid Link wrapper
│   ├── hooks/               # React hooks
│   │   ├── auth/           # Authentication hooks
│   │   ├── items/          # Items hooks
│   │   ├── plaid/          # Plaid hooks
│   │   └── transactions/   # Transactions hooks
│   ├── lib/                 # Utilities
│   │   ├── api/            # API client
│   │   └── auth/           # Auth utilities
│   ├── pages/               # Page components
│   │   ├── Dashboard/      # Dashboard page
│   │   ├── Accounts/       # Accounts page
│   │   ├── Login/          # Login page
│   │   └── TwoFactor/     # 2FA page
│   ├── routes/              # TanStack Router routes
│   ├── types/              # TypeScript types
│   ├── utils/              # Utility functions
│   ├── App.tsx             # Root component
│   └── main.tsx            # Entry point
├── Dockerfile              # For Railway deployment
└── README.md              # This file
```

## Routing

Uses TanStack Router for file-based routing:

- `/` - Dashboard (protected)
- `/login` - Login page
- `/accounts` - Accounts management (protected)
- `/two-factor` - 2FA setup (protected)
- `*` - 404 page

### Protected Routes

Routes are protected using authentication checks. Unauthenticated users are redirected to `/login`.

## State Management

### TanStack Query

Used for server state management:
- Automatic caching
- Background refetching
- Optimistic updates
- Error handling

### Better Auth

Client-side authentication:
- Session management
- Cookie-based authentication
- Automatic token refresh

## API Integration

### API Client

Located in `src/lib/api/client.ts`:
- Axios-based HTTP client
- Automatic error handling
- Request/response interceptors
- TypeScript types from `@opulus/core`

### Hooks

Custom hooks for API calls:
- `useSession()` - Get current session
- `useLogin()` - Sign in
- `useLogout()` - Sign out
- `useItems()` - Get connected items
- `useTransactions()` - Get transactions
- `useLinkToken()` - Create Plaid Link token

## Styling

- **Tailwind CSS v4** - Utility-first CSS framework (theme in `src/index.css`)
- **Radix UI** - Accessible component primitives
- **CSS Variables** - Theming support

## Component Library

UI primitives are shadcn/ui components colocated in `src/components/ui`:
- Import components: `import { Button, Card } from '@/components/ui'`
- Add new components with the shadcn CLI (see `components.json`)

## Development Workflow

1. **Make changes** to frontend code
2. **Vite HMR** automatically updates browser
3. **No manual rebuilds** needed

## Troubleshooting

### Build Errors

- **Type errors**: Run `pnpm type-check` to see TypeScript errors
- **Import errors**: Ensure `@opulus/core` is built
- **Missing types**: Run `pnpm prisma:generate` in core package

### Runtime Errors

- **API connection**: Verify backend is running on correct port
- **CORS errors**: Check `CLIENT_URL` in backend matches frontend URL
- **Auth errors**: Check `VITE_BETTER_AUTH_BASE_URL` matches backend URL

## Related Documentation

- [Main README](../README.md) - Repo-wide setup and prerequisites
- [Backend API](../opulus-backend/README.md) - API documentation


