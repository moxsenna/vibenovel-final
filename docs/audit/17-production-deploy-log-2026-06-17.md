# Production deploy log (2026-06-17)

Operator: automated recovery session (Wrangler OAuth `moxsenna@gmail.com`).

## Deployed

| Target | Action | Result |
|--------|--------|--------|
| **API** `api.narraza.web.id` | `wrangler deploy --env production` | ✅ Version `663ef7f8-3db0-4ab5-9b0b-5fd0d10d7180` |
| **App** `narraza-web-production` (Pages) | `npm run deploy:web:production` | ✅ Preview `https://b463e0e0.narraza-web-production.pages.dev` |

## Build notes

- Web built with `.env.production` (Supabase prod ref `qjmbobvarspwvaalnjct`, `VITE_API_URL=https://api.narraza.web.id`).
- Bundle chunks: vendor-react, vendor-supabase, vendor, index (~292 KB).

## Not run (repo gates)

- `operator:production:api-web:deploy -Mode apply` — **blocked** by preflight (`.env.production` has live Duitku vars; script expects Mode A without live payment in file).
- `operator:production:aws:deploy` — EC2/VPS Node path unchanged.
- Worker **secrets** not rotated this session (existing prod secrets assumed).

## Smoke live (manual)

1. Open https://app.narraza.web.id — login.
2. Intake → konsep → foundation → outline → tulis 1 bab (mode **Terbaik** jika gagal).
3. Jika prose gagal di Worker → rencanakan API Node di VPS.

## API health snapshot

`GET https://api.narraza.web.id/api/health` → `ok: true`, `aiGenerationEnabled: true`, `appEnv: production`.