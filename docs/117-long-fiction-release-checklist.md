# Long-Fiction Release Checklist

Date: 2026-06-21  
Decision owner: Founder/product owner  
Technical gate owner: Backend/operations owner

| Gate | Owner | Required evidence | Rollback / NO-GO trigger |
|---|---|---|---|
| Typecheck, lint, builds | Engineering | release-gate JSON | any error |
| API/credit contracts | Backend | command output in gate artifact | failed contract or credit mismatch |
| 30-chapter deterministic suite | Continuity owner | test output | safety, state, knowledge, prose-tail, or budget failure |
| Node production runtime | Operations | health `runtime=node`, Compose/Caddy validation | Worker heavy-flow path or timeout mismatch |
| Context profile | AI platform owner | health + p50/p95 observability | invalid profile, context-length errors, missing telemetry |
| Semantic judge | Validation owner | `enforce` health + calibration/smoke evidence | unavailable judge persists prose or misses refund |
| Five-chapter live smoke | Release owner | paid smoke JSON with cleanup | budget exceeded, unsafe packet, missing attempt IDs |
| Paid 30-chapter acceptance | Founder + release owner | report with actual metrics and GO | any hard criterion fails or lacks source evidence |
| Marketing claims | Product | marketing contract test | unsupported scale/reliability promise |
| Production health | Operations | timestamped health response | health failure, wrong runtime/profile/mode |

## GO rule

Run:

```powershell
npm run gate:long-fiction -- -CheckProductionHealth -FiveChapterArtifact <five.json> -ThirtyChapterReport <report.md>
```

GO requires `releaseReady=true`, zero blockers, a clean five-chapter paid smoke, and—when scope is public—an evidence-backed paid 30-chapter `GO` report.

## Current status

Implementation and deterministic tests can be completed locally. Paid smoke, production health, and paid 30-chapter acceptance require explicit owner authorization and external production state. Without those artifacts the correct verdict is **NO-GO**, not “release ready.”
