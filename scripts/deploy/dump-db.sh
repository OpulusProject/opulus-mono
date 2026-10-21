#!/usr/bin/env bash
# Dumps the database of a docker-compose.prod.yml deployment to a file, for
# developing against a copy instead of the live data:
#
#   scripts/deploy/dump-db.sh                 # writes opulus-<timestamp>.dump here
#   scripts/deploy/dump-db.sh /path/out.dump
#
# Restore it into a local Postgres (owners and grants are left out, so any role
# can own the copy):
#
#   createdb opulus_prod_copy
#   pg_restore --no-owner --no-acl -d opulus_prod_copy opulus-<timestamp>.dump
#
# Plaid access tokens stay encrypted in the dump; they are useless without the
# server's ITEM_TOKEN_ENCRYPTION_KEY, which is not in it.
set -euo pipefail

out="${1:-opulus-$(date +%Y%m%d-%H%M%S).dump}"
compose_dir="$(cd "$(dirname "$0")/../.." && pwd)"

docker compose -f "$compose_dir/docker-compose.prod.yml" --env-file "$compose_dir/.env.production" \
  exec -T db pg_dump -U opulus -d opulus --format=custom --no-owner --no-acl > "$out"

echo "$out ($(du -h "$out" | cut -f1))"
