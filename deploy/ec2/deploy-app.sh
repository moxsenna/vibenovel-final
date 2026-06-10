#!/usr/bin/env bash
# VibeNovel EC2 app deploy helper (Task 11.5)
# Run as vibenovel on the staging EC2 instance from /opt/vibenovel.
#
# Prerequisites:
#   - bootstrap-ubuntu.sh completed
#   - .env.staging present (chmod 600) — copy from .env.staging.example, fill Supabase only
#   - git access to repo OR rsync from operator machine
#
# Usage:
#   export REPO_URL=https://github.com/<org>/vibenovel-unified-blueprint.git
#   export REPO_BRANCH=main
#   bash deploy/ec2/deploy-app.sh

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/vibenovel}"
REPO_URL="${REPO_URL:-}"
REPO_BRANCH="${REPO_BRANCH:-main}"

cd "$APP_DIR"

if [[ ! -f .env.staging ]]; then
  echo "ERROR: $APP_DIR/.env.staging missing. Create from .env.staging.example (never commit)." >&2
  exit 1
fi
chmod 600 .env.staging

if [[ -n "$REPO_URL" && ! -d .git ]]; then
  git clone --branch "$REPO_BRANCH" --depth 1 "$REPO_URL" .
elif [[ -d .git ]]; then
  git fetch origin "$REPO_BRANCH"
  git checkout "$REPO_BRANCH"
  git pull --ff-only origin "$REPO_BRANCH" || true
else
  echo "WARN: No .git and REPO_URL unset — assuming rsync/scp already placed files in $APP_DIR"
fi

docker compose -f docker-compose.staging.yml up -d --build
docker compose -f docker-compose.staging.yml ps
docker compose -f docker-compose.staging.yml logs --tail=50 api

echo "==> Local health check"
curl -sf http://127.0.0.1:8787/api/health | head -c 500
echo ""
echo "==> Deploy complete. Configure Caddy + public smoke from operator machine."