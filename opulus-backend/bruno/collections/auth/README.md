# Authentication API

Better Auth authentication endpoints.

**Base Path:** `/api/auth`

## Endpoints

- **Sign Up** - Register a new user account
- **Sign In** - Authenticate with email and password
- **Sign Out** - Sign out the current user
- **Get Session** - Get current session information
- **Update Session** - Update session metadata

## Usage

1. Start with **Sign Up** to create a test user
2. Use **Sign In** - Bruno will automatically store cookies
3. Test **Get Session** to verify authentication
4. Use **Sign Out** to end the session

## Notes

- Sessions last 7 days by default
- `rememberMe: true` persists cookie across browser restarts
- Bruno automatically handles session cookies
