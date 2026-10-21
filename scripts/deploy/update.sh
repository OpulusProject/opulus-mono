#!/usr/bin/env bash
# Keeps a docker-compose.prod.yml deployment at the tip of its branch: fetches,
# and when the remote has moved, fast-forwards and rebuilds what changed
# (compose only recreates containers whose image or config differs). Does
# nothing when there is nothing new, so it is safe to run every few minutes:
#
#   */5 * * * * /path/to/opulus-mono/scripts/deploy/update.sh >> /var/log/opulus-update.log 2>&1
#
# Set OPULUS_BRANCH to follow a branch other than main, and OPULUS_COMPOSE_ARGS
# to pass more (e.g. "--profile zrok").
set -euo pipefail

cd "$(dirname "$0")/../.."
branch="${OPULUS_BRANCH:-main}"

exec 9>/tmp/opulus-update.lock
flock -n 9 || exit 0  # a previous run is still building

git fetch --quiet origin "$branch"
if [ "$(git rev-parse HEAD)" = "$(git rev-parse "origin/$branch")" ] && [ "${1:-}" != "--force" ]; then
  exit 0
fi

echo "$(date -Is) updating to $(git rev-parse --short "origin/$branch")"
git checkout --quiet "$branch"
git merge --ff-only --quiet "origin/$branch"

# shellcheck disable=SC2086
docker compose -f docker-compose.prod.yml --env-file .env.production ${OPULUS_COMPOSE_ARGS:-} \
  up -d --build --remove-orphans
docker image prune -f >/dev/null
echo "$(date -Is) done"
