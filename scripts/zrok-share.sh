#!/bin/sh
set -eu

if ! zrok status >/dev/null 2>&1; then
  if [ -z "${ZROK_ENABLE_TOKEN:-}" ]; then
    echo "zrok is not enabled. Set ZROK_ENABLE_TOKEN in .env" >&2
    exit 1
  fi
  zrok enable "$ZROK_ENABLE_TOKEN"
fi

rm -f /shared/plaid-webhook-url.env
zrok share public http://webhooks:8081 --headless --backend-mode web > /tmp/zrok.log 2>&1 &
share_pid=$!

url=""
i=0
while [ "$i" -lt 40 ]; do
  url=$(grep -oE 'https://[^[:space:]]+' /tmp/zrok.log | head -1 || true)
  if [ -n "$url" ]; then
    break
  fi
  i=$((i + 1))
  sleep 1
done

if [ -z "$url" ]; then
  echo "zrok did not publish a URL" >&2
  cat /tmp/zrok.log >&2
  exit 1
fi

# Plaid is given this value unchanged.
printf 'PLAID_WEBHOOK_URL=%s/webhook/plaid\n' "$url" > /shared/plaid-webhook-url.env
echo "PLAID_WEBHOOK_URL=${url}/webhook/plaid"

wait "$share_pid"
