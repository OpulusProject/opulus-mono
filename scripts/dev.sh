#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
mkdir -p .dev
rm -f .dev/plaid-webhook-url.env

exec docker compose -f docker-compose.dev.yml up --build
