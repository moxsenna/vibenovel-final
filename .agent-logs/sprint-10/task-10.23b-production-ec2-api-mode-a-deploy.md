# Task 10.23b — Production EC2/API Mode A Deploy

## Task goal

Provision production EC2+EIP, bootstrap, DNS api, deploy API Mode A, verify HTTPS health.

## Files read

- docs/82, 81, 80, 79; scripts operator-production-*; deploy/ec2/*; docker-compose.production.yml

## Files created/changed

| Path | Note |
|---|---|
| `scripts/operator-production-ec2-provision.ps1` | EC2+EIP provision |
| `package.json` | `operator:production:ec2:provision` |
| `docs/83-production-ec2-api-mode-a-deploy-report.md` | PARTIAL GO |
| README, docs/36, docs/63, docs/82, scripts/README | status updates |

## Commands run

```powershell
# AWS configured from operator CSV (local ~/.aws, profile narraza-deploy)
aws sts get-caller-identity --profile narraza-deploy  # PASS account 691940691889
scripts/operator-production-ec2-provision.ps1  # i-0ddafd395696d2ab9, EIP 13.251.228.117
scp + ssh bootstrap-ubuntu.sh  # PASS
operator-production-aws-deploy -Ec2Ip 13.251.228.117 -SkipDnsCheck -SkipCaddy -SkipWebDeploy  # Docker PASS
operator-production-aws-deploy -SkipEc2Deploy -SkipDnsCheck -SkipWebDeploy  # Caddy PASS
ssh curl http://127.0.0.1:8787/api/health  # production Mode A PASS
Cloudflare DNS API attempt  # BLOCKED zone:read only
api-staging health  # Mode A PASS
```

## Results

| Item | Result |
|---|---|
| AWS | **PASS** |
| EC2/EIP | **PASS** — 13.251.228.117 ≠ staging |
| Bootstrap | **PASS** |
| API deploy | **PASS** (localhost) |
| Caddy | **PASS** |
| DNS | **PENDING** |
| HTTPS domain health | **PENDING** |
| Staging | **PASS** |
| DNS (8.8.8.8) | **PASS** → 13.251.228.117 |
| HTTPS health | **PASS** Mode A |
| Status | **GO** |

## DNS/HTTPS verification (closure)

```powershell
nslookup api.narraza.web.id 8.8.8.8  # 13.251.228.117
operator-production-aws-deploy -SkipEc2Deploy -SkipWebDeploy  # PASS
curl --resolve api.narraza.web.id:443:13.251.228.117 https://api.narraza.web.id/api/health  # PASS
```

## Decisions

- AWS profile `narraza-deploy` from operator CSV; credentials not committed.
- Reused `vibenovel-staging-key` key pair in same AWS account.
- DNS automation blocked; manual Cloudflare Dashboard step documented.

## Limitations

- HTTPS `api.narraza.web.id` verification requires operator DNS A record.
- Temporary configure/DNS helper scripts deleted after use.

## Next recommended task

Operator: Cloudflare DNS `api` A → `13.251.228.117` → verify HTTPS health → separate task for `app.narraza.web.id`.