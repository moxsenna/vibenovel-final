[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$gates = @(
  @{ Name = "Credit v2 contracts"; Command = { npm run test:credit-v2 } },
  @{ Name = "API contracts"; Command = { npm run test:api:contracts } },
  @{ Name = "Typecheck"; Command = { npm run typecheck } },
  @{ Name = "Lint"; Command = { npm run lint } },
  @{ Name = "Web build"; Command = { npm run build:web } },
  @{ Name = "API build"; Command = { npm run build:api } },
  @{ Name = "No production stubs"; Command = { npm run smoke:no-prod-stubs } },
  @{ Name = "Database-backed smoke"; Command = {
      powershell -ExecutionPolicy Bypass -File scripts/credit-system-v2-smoke-api.ps1
    }
  }
)

Push-Location $RepoRoot
try {
  foreach ($gate in $gates) {
    Write-Host ("`n[RUN ] {0}" -f $gate.Name) -ForegroundColor Cyan
    & $gate.Command
    if ($LASTEXITCODE -ne 0) {
      Write-Host ("[FAIL] {0} (exit={1})" -f $gate.Name, $LASTEXITCODE) -ForegroundColor Red
      exit $LASTEXITCODE
    }
    Write-Host ("[PASS] {0}" -f $gate.Name) -ForegroundColor Green
  }
  Write-Host "`nCredit System v2 launch gate: PASS" -ForegroundColor Green
} finally {
  Pop-Location
}
