#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# Infra (Postgres + Redis) runs via docker-compose.yml.
docker compose up -d

# Ensure zrok is enabled once.
if ! zrok status >/dev/null 2>&1; then
  if [ -z "${ZROK_ENABLE_TOKEN:-}" ]; then
    echo "zrok is not enabled. Set ZROK_ENABLE_TOKEN in .env, then run 'zrok enable \$ZROK_ENABLE_TOKEN'." >&2
    exit 1
  fi
  zrok enable "$ZROK_ENABLE_TOKEN"
fi

exec node scripts/dev.mjs
