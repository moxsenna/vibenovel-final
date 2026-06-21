# Node Production Cutover Runbook — Long-Fiction Heavy Flows

Date: 2026-06-21  
Target: `api.narraza.web.id -> Caddy -> Node API :8787`

## Scope

This runbook moves outline/prose heavy flows to the Node runtime. It does not authorize a production deploy, paid AI smoke, DNS change, database migration, or payment enablement by itself.

## Preconditions

- Founder/operator deployment approval is recorded.
- Production Supabase is not the staging project.
- `.env.production` exists only on the server with mode `600`.
- `AI_GENERATION_ENABLED`, provider keys, `WRITER_CONTEXT_BUDGET_PROFILE`, and `SEMANTIC_JUDGE_MODE` are explicitly reviewed.
- Migrations through `00026` are applied to the intended production database.
- `npm run build:api:node`, `npm run typecheck`, and the long-fiction release gate have completed.
- A previous deploy commit or image is available for rollback.

Never print `.env.production`, provider keys, Supabase keys, access tokens, raw prompts, prose, or planning truth.

## Preflight

```bash
docker compose -f docker-compose.production.yml config --quiet
docker compose -f docker-compose.production.yml build api
```

Expected configuration:

- `RUNTIME_TARGET=node`
- health endpoint `http://127.0.0.1:8787/api/health`
- restart policy `unless-stopped`
- Caddy `response_header_timeout 180s`
- same production Supabase bindings used by all API routes

## Cutover

1. Record current commit and current public health response.
2. Lower DNS TTL to 300 at least one TTL before a DNS move.
3. Run `deploy/ec2/deploy-app-production.sh`.
4. Verify local health:

   ```bash
   curl -fsS http://127.0.0.1:8787/api/health
   ```

5. Reload validated Caddy configuration:

   ```bash
   sudo caddy validate --config /etc/caddy/Caddyfile
   sudo systemctl reload caddy
   ```

6. Verify public health and authenticated read-only smoke.
7. Verify a controlled generation attempt records `runtime=node`, context-size metadata, provider routing, validation, and refund behavior.
8. Do not activate the `full` context profile until its separate telemetry and five-chapter activation evidence passes.

## Rollback triggers

Rollback immediately for:

- public health failure lasting more than five minutes;
- elevated 5xx/provider timeout rate;
- generation debit without matching refund on failure;
- missing validation or observability metadata;
- context-length errors after cutover;
- Worker/Node behavior mismatch;
- raw prompt, prose, secret, or planning-truth leakage.

## Rollback

```bash
cd /opt/vibenovel
git checkout "$(cat .last-deploy-commit)"
docker compose -f docker-compose.production.yml up -d --build api
curl -fsS http://127.0.0.1:8787/api/health
```

If the incident is at the proxy/DNS layer, restore the previous Caddy config or previous DNS target. Keep the same production Supabase; do not roll back schema destructively during an application rollback.

## Evidence to retain

- commit/image identifiers before and after cutover;
- sanitized Compose/Caddy validation output;
- local and public health timestamps;
- generation attempt IDs from controlled smoke;
- debit/refund reconciliation;
- context-size p50/p95 and context-length error count;
- GO/NO-GO decision and operator identity.
