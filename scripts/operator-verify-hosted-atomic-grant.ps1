<#
.SYNOPSIS
  Task 10.17 — Verify migration 00010 + atomic grant RPC on hosted staging Supabase.

.DESCRIPTION
  Staging-only. Never logs secrets. Requires .env.staging with hosted SUPABASE_* values.
  Does not enable payment or change API Mode A flags.

.EXAMPLE
  npm run operator:staging:atomic-grant
#>
[CmdletBinding()]
param(
  [string]$ApiBaseUrl = "https://api-staging.narraza.web.id"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot "lib\staging-smoke-common.ps1")

Import-StagingSupabaseEnv -RepoRoot $RepoRoot

$stagingUrl = Get-StagingSupabaseCredential "STAGING_SUPABASE_URL"
if (-not $stagingUrl) { $stagingUrl = Get-StagingSupabaseCredential "SUPABASE_URL" }

Write-Host "Task 10.17 - Hosted staging atomic grant verification" -ForegroundColor Cyan
Write-Host "API: $ApiBaseUrl"
Write-Host "Supabase: $(if ($stagingUrl) { Get-RedactedValue $stagingUrl 20 } else { '[not set]' })"

if (-not $stagingUrl -or (Test-IsLocalSupabaseUrl $stagingUrl)) {
  Write-Host "BLOCKED: hosted staging SUPABASE_URL required (not localhost)" -ForegroundColor Red
  exit 2
}

try {
  $supabaseHost = ([Uri]$stagingUrl.Trim()).Host
  if ($supabaseHost -notmatch '\.supabase\.co$') {
    Write-Host "BLOCKED: unexpected Supabase host pattern" -ForegroundColor Red
    exit 2
  }
  Write-Host "Target project ref: $($supabaseHost.Split('.')[0])" -ForegroundColor Gray
} catch {
  Write-Host "BLOCKED: invalid SUPABASE_URL" -ForegroundColor Red
  exit 2
}

Write-Host "`n[1] Staging API health (Mode A)..." -ForegroundColor Cyan
$health = Invoke-StagingHealthCheck -ApiBaseUrl $ApiBaseUrl
if ($health.Error) {
  Write-Host "FAIL: $($health.Error)" -ForegroundColor Red
  exit 1
}
$ef = $health.EnvFlags
$modeA = (
  $ef.creditTopupEnabled -eq $false -and
  $ef.paymentProviderMock -eq $true -and
  $ef.paymentProvider -eq "mock" -and
  $ef.aiGenerationEnabled -eq $false
)
if (-not $modeA) {
  Write-Host "FAIL: staging not Mode A safe" -ForegroundColor Red
  exit 1
}
Write-Host "PASS Mode A safe" -ForegroundColor Green

Write-Host "`n[2] Migration list (linked)..." -ForegroundColor Cyan
Push-Location $RepoRoot
try {
  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  $listOut = (& supabase migration list --linked 2>&1 | Out-String)
  $ErrorActionPreference = $prevEap
  if ($listOut -notmatch '00010\s+\|\s+00010') {
    Write-Host "FAIL: 00010 not applied on remote" -ForegroundColor Red
    exit 1
  }
  Write-Host "PASS 00010 on remote" -ForegroundColor Green
} finally { Pop-Location }

Write-Host "`n[3] Hosted RPC probe..." -ForegroundColor Cyan
Push-Location (Join-Path $RepoRoot "apps\api")
try {
  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  $probeOut = & npx tsx scripts/probe-hosted-atomic-grant.mts 2>&1
  $probeExit = $LASTEXITCODE
  $ErrorActionPreference = $prevEap
  $probeOut | ForEach-Object { Write-Host $_ }
  if ($probeExit -ne 0 -and ($probeOut -join "`n") -notmatch "probe-hosted-atomic-grant: PASS") {
    Write-Host "FAIL: probe-hosted-atomic-grant" -ForegroundColor Red
    exit 1
  }
  Write-Host "PASS RPC callable" -ForegroundColor Green
} finally { Pop-Location }

Write-Host "`n[4] Hosted atomic grant test suite..." -ForegroundColor Cyan
Push-Location $RepoRoot
try {
  & npm run test:atomic-grant-hosted 2>&1 | ForEach-Object { Write-Host $_ }
  if ($LASTEXITCODE -ne 0) {
    Write-Host "FAIL: test:atomic-grant-hosted" -ForegroundColor Red
    exit 1
  }
  Write-Host "PASS hosted grant idempotency" -ForegroundColor Green
} finally { Pop-Location }

Write-Host "`n[5] Final Mode A health..." -ForegroundColor Cyan
$health2 = Invoke-StagingHealthCheck -ApiBaseUrl $ApiBaseUrl
$ef2 = $health2.EnvFlags
if (
  $ef2.creditTopupEnabled -ne $false -or
  $ef2.paymentProviderMock -ne $true -or
  $ef2.paymentProvider -ne "mock"
) {
  Write-Host "FAIL: Mode A changed after verification" -ForegroundColor Red
  exit 1
}
Write-Host "PASS Mode A unchanged" -ForegroundColor Green

Write-Host "`nTask 10.17 operator gate: GO" -ForegroundColor Green
exit 0