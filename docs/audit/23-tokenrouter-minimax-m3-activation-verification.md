# TokenRouter MiniMax-M3 Activation Verification

- Date: 21 June 2026
- Gate: Optional Gate A (TokenRouter activation)
- Probe: `apps/api/scripts/tokenrouter-minimax-probe.mts`
- Command: `npm run verify:tokenrouter-minimax -w @vibenovel/api -- --live`

## Result: NO-GO (BLOCKED)

- Endpoint: `https://api.tokenrouter.com/v1/chat/completions`
- Provider model ID: `MiniMax-M3`
- Auth: bearer key from `.env.production` (present, `sk-…`, len 51; value not recorded)
- Outcome: **HTTP 401** (provider rejected the request) → `AI_PROVIDER_ERROR`
- Structured JSON probe: not reached
- Raw prompt, output, reasoning, secret: not stored

A 401 is an authentication failure (endpoint reachable, key rejected). Per the
gate rule, this **blocks activation**. No production route was moved to
TokenRouter; the deployment remains `verificationStatus: "documented"` and
non-routed in `ai-routing-policy.ts`.

## Likely causes to verify in the TokenRouter dashboard

1. The API key is invalid / placeholder / expired for TokenRouter.
2. The API base URL is not TokenRouter's real host (registry value was
   operator-supplied and unverified).
3. The auth scheme differs from `Authorization: Bearer <key>`.

Also confirm the **exact promotion end time and timezone** ("until 22 June 2026"
is date-only). The registry currently stores `promotionEndsOn: "2026-06-22"`.

## Auto-revert safeguard (shipped)

`isDeploymentPromotionExpired` + the model router now treat any expired
temporary-promotion deployment as non-callable at runtime: the router logs a
warning and falls through to the explicit OpenRouter fallback, so an expired
promo can never silently route to a no-longer-free or unavailable deployment.
A date-only `promotionEndsOn` is interpreted as end-of-day UTC; replace it with
a full ISO timestamp once the dashboard expiry time/timezone is confirmed.

## Next steps

- Fix the TokenRouter credential / base URL / auth scheme, then re-run the probe.
- On PASS: record current (post-promotion) pricing, promote the deployment to
  `verified`, then activate exactly one low-risk engine in a separate
  routing-policy commit.
