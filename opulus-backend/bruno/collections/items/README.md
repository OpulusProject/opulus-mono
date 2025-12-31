# Items API

Plaid items management endpoints.

## Endpoints

- **Get Items** - Get all items for the authenticated user with metadata (`GET /api/items`)

## Usage

1. First, authenticate using the **Sign In** endpoint in the `auth` collection
2. Bruno will automatically store the session cookie
3. Call **Get Items** to retrieve all Plaid items for your account
4. Each item includes metadata about linked bank accounts (count and total balance)

## Notes

- Items are returned ordered by creation date (newest first)
- Each item includes metadata:
  - `accountCount`: Number of bank accounts linked to the item
  - `totalAvailableBalance`: Sum of available balances across all accounts
- Items without accounts will have `accountCount: 0` and `totalAvailableBalance: 0`
- This endpoint requires an active session (use Sign In first)

