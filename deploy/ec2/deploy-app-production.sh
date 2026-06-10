#!/usr/bin/env bash
# Narraza production EC2 app deploy helper (Task 10.23 Mode A)
# Run as vibenovel on the production EC2 instance from /opt/vibenovel.
#
# Prerequisites:
#   - bootstrap-ubuntu.sh completed
#   - .env.production present (chmod 600) — Mode A flags; never commit
#   - NOT staging instance 13.212.245.32
#
# Usage:
#   export REPO_URL=https://github.com/<org>/vibenovel-unified-blueprint.git
#   export REPO_BRANCH=main
#   bash deploy/ec2/deploy-app-production.sh

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/vibenovel}"
REPO_URL="${REPO_URL:-}"
REPO_BRANCH="${REPO_BRANCH:-main}"

cd "$APP_DIR"

if [[ ! -f .env.production ]]; then
  echo "ERROR: $APP_DIR/.env.production missing. Create from .env.production.example (never commit)." >&2
  exit 1
fi
chmod 600 .env.production

if grep -q 'CREDIT_TOPUP_ENABLED=true' .env.production 2>/dev/null; then
  echo "ERROR: CREDIT_TOPUP_ENABLED must be false for Mode A deploy." >&2
  exit 1
fi

if [[ -n "$REPO_URL" && ! -d .git ]]; then
  git clone --branch "$REPO_BRANCH" --depth 1 "$REPO_URL" .
elif [[ -d .git ]]; then
  git fetch origin "$REPO_BRANCH"
  git checkout "$REPO_BRANCH"
  git pull --ff-only origin "$REPO_BRANCH" || true
else
  echo "WARN: No .git and REPO_URL unset — assuming rsync/scp already placed files in $APP_DIR"
fi

docker compose -f docker-compose.production.yml up -d --build
docker compose -f docker-compose.production.yml ps
docker compose -f docker-compose.production.yml logs --tail=50 api

echo "==> Local health check"
curl -sf http://127.0.0.1:8787/api/health | head -c 500
echo ""
echo "==> Deploy complete. Configure Caddy for api.narraza.web.id + public smoke."