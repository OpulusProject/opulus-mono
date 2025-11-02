# Authentication API

Better Auth authentication endpoints.

**Base Path:** `/api/auth`

## Endpoints

- **Sign Up** - Register a new user account (`POST /api/auth/sign-up/email`)
- **Sign In** - Authenticate with email and password (`POST /api/auth/sign-in/email`)
- **Sign Out** - Sign out the current user (`POST /api/auth/sign-out`)

## Usage

1. Start with **Sign Up** to create a test user
2. Use **Sign In** - Bruno will automatically store cookies
3. Use **Sign Out** to end the session

## Notes

- Sessions last 7 days by default
- `rememberMe: true` persists cookie across browser restarts
- Bruno automatically handles session cookies
