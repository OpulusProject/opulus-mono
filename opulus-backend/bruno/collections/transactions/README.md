# Transactions Collection

This collection contains requests for managing user transactions.

## Endpoints

- **Get Transactions** - Get all transactions for the authenticated user

## Authentication

All endpoints in this collection require an active session. Make sure to sign in first using the Auth collection before making requests.

## Environment Variables

This collection uses the following environment variables (defined in `bruno.json`):

- `base_url` - Base URL for the API (e.g., `http://localhost:3000`)
- `client_url` - Client URL for CORS (e.g., `http://localhost:5173`)

