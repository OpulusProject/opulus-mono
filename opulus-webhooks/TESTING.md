# Testing Webhooks Locally

## Using Zrok Tunnel

### Reserved Share (Recommended for Development)

A **reserved share** provides a stable URL that doesn't change between sessions. This is perfect for development because you can set it once in Plaid Dashboard and `.env` files.

**Current reserved share:** `https://opuluswebhooks.share.zrok.io`

#### Setting Up a Reserved Share

1. **Create a reserved share** (one-time setup):

   ```bash
   zrok reserve public http://localhost:8081 --backend-mode web --unique-name opuluswebhooks --json-output
   ```

   **Note:** The unique name must be:
   - Lowercase alphanumeric only (no hyphens or special characters)
   - Between 4-32 characters
   - Unique across zrok

2. **Copy the frontend endpoint** from the JSON output (e.g., `https://opuluswebhooks.share.zrok.io`)

3. **Update your `.env` file:**

   ```bash
   PLAID_WEBHOOK_URL=https://opuluswebhooks.share.zrok.io
   ```

   **Note:** This URL is automatically used when creating link tokens. Plaid will send webhooks to this URL automatically - no Dashboard configuration needed!

4. **Activate the reserved share** when your webhook server is running:

   ```bash
   # Terminal 1: Start the webhook server
   pnpm dev:webhooks

   # Terminal 2: Activate the existing reserved share
   zrok reserve public http://localhost:8081 --backend-mode web --unique-name opuluswebhooks
   ```

   **Note:** If you get a 409 conflict error, the share already exists - just run the activation command above when your server is running.

**Benefits:**

- ✅ Stable URL - no need to update Plaid Dashboard each time
- ✅ Persists even when zrok isn't running
- ✅ Free tier includes 2 reserved shares
- ✅ Perfect for development/testing

### Quick Start (Temporary Share)

**One command to start everything:**

```bash
pnpm dev:webhooks:local
```

This will:

- ✅ Build/watch `@opulus/core`
- ✅ Start webhook server on port 8081
- ✅ Expose via zrok tunnel automatically

### Manual Setup

1. **Start your webhook server:**

   ```bash
   pnpm dev:webhooks
   ```

2. **In another terminal, expose it via zrok:**

   ```bash
   cd opulus-webhooks
   pnpm tunnel
   ```

   Or manually:

   ```bash
   zrok share public http://localhost:8081 --backend-mode web
   ```

3. **Copy the public URL** that zrok provides (e.g., `https://your-share.zrok.io`)

4. **Update your `.env` file:**

   ```bash
   PLAID_WEBHOOK_URL=https://your-share.zrok.io
   ```

   **Note:** This URL is automatically included in link tokens. Plaid will send webhooks to this URL automatically - no Dashboard configuration needed!

### Sending a webhook without the Link UI

Instead of linking a bank through Plaid Link each time, have Plaid's sandbox send
a real signed webhook to your tunnel:

1. **Start the receiver and the tunnel** (two terminals), and put the tunnel's
   URL in `.env` as `PLAID_WEBHOOK_URL` as above:

   ```bash
   pnpm dev:webhooks
   pnpm dev:webhooks:tunnel
   ```

2. **Fire a webhook.** This creates a throwaway sandbox item and asks Plaid to
   send a `TRANSACTIONS` webhook for it to `PLAID_WEBHOOK_URL` (the default code
   is `SYNC_UPDATES_AVAILABLE`):

   ```bash
   pnpm --filter @opulus/webhooks fire-webhook
   pnpm --filter @opulus/webhooks fire-webhook -- --code DEFAULT_UPDATE
   pnpm --filter @opulus/webhooks fire-webhook -- --code SYNC_UPDATES_AVAILABLE --institution ins_109508
   ```

3. **Watch the receiver's logs.** You should see "Webhook received" and "Webhook
   enqueued" (so Plaid's signature was verified and the job queued), then the
   worker picking it up. The throwaway item is never saved to our database, so
   the worker's handler then fails to find it and retries; that is expected. It
   checks delivery, verification and queueing, not what a handler does to data.
   For that, use the end-to-end tests below, which link real sandbox items.

### Troubleshooting

- **zrok not authenticated:** Run `zrok enable` first (if needed)
- **Port already in use:** Change `WEBHOOK_PORT` in `.env`
- **Webhook not received:**
  - Check zrok tunnel is active (`zrok overview` to see active shares)
  - Verify webhook server is running on port 8081
  - Ensure reserved share is activated (`zrok reserve` command)
- **Signature verification fails:** Ensure `PLAID_SECRET` is set correctly
- **Reserved share name invalid:** Must be lowercase alphanumeric, 4-32 chars, no special characters
- **Reserved share already exists:** Use `zrok release <name>` first, or use a different name

## Alternative: ngrok

If you prefer ngrok:

```bash
ngrok http 8081
```

Then use the ngrok URL: `https://your-id.ngrok.io/webhook/plaid`

## End-to-end tests with Plaid's sandbox

The service suite can only check that the receiver rejects bad requests, because
Plaid signs the genuine ones. `opulus-tests/integration/webhooks` instead has
Plaid's sandbox deliver real webhooks (`/sandbox/item/fire_webhook`,
`/sandbox/item/reset_login`) and waits for their effect on the item.

To run it locally you need the backend and the receiver running against the same
test database, Redis, and a public URL for the receiver:

```bash
pnpm dev:webhooks:tunnel   # prints the public URL for the receiver
```

```bash
WEBHOOK_PUBLIC_URL=<public url> TEST_BASE_URL=http://localhost:8080 \
TEST_DATABASE_URL=<test db> PLAID_SANDBOX_CLIENT_ID=... PLAID_SANDBOX_SECRET=... \
pnpm --filter @opulus/tests test:integration-webhooks
```

Use a separate Redis for the receiver under test if you also have a dev receiver
running, so the two don't take each other's jobs. In CI the
`Webhook E2E` workflow does all of this with a temporary tunnel.
