# Sandbox Setup

Connects a Plaid Sandbox item to your Opulus user without going through the UI. Useful for exercising item-scoped endpoints (refresh transactions, update accounts, delete item) locally or on staging.

## Requests

1. **1 Create Sandbox Public Token** - mints a public token directly from Plaid Sandbox
2. **2 Connect Sandbox Item** - exchanges it through `POST /api/plaid/items` and stores `item_id`

## Setup

Add these to your environment (see `environments/local.bru.example`):

- `plaid_sandbox_client_id` and `plaid_sandbox_secret` (secrets, from the Plaid dashboard's sandbox keys)

The institution is hardcoded to `ins_109508` (First Platypus Bank), matching the integration tests.

## Usage

1. **Sign In** (`auth` collection)
2. Run the two requests above in order
3. Run **Get Items** to verify

Public tokens are single-use, so re-run request 1 each time. Sandbox only: this collection is not meant for the production environment.
