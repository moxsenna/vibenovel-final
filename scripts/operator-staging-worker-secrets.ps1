<#
.SYNOPSIS
  Task 11.2b operator step 3 — set Worker Supabase secrets + deploy API staging.

.DESCRIPTION
  Loads credentials from (first wins per target):
    STAGING_SUPABASE_* process env
    .env.staging (SUPABASE_*)
    apps/web/.env.local (VITE_SUPABASE_*)

  Never logs secret values.

.EXAMPLE
  npm run operator:staging:worker-secrets
#>
[CmdletBinding()]
param(
  [switch]$SkipDeploy
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot "lib\staging-smoke-common.ps1")

Import-StagingSupabaseEnv -RepoRoot $RepoRoot

$url = Get-StagingSupabaseCredential 'STAGING_SUPABASE_URL'
$anon = Get-StagingSupabaseCredential 'STAGING_SUPABASE_ANON_KEY'
$service = Get-StagingSupabaseCredential 'STAGING_SUPABASE_SERVICE_ROLE_KEY'

Write-Host "Operator staging Worker secrets (step 3)" -ForegroundColor Cyan
Write-Host "Supabase URL: $(if ($url) { Get-RedactedValue $url 12 } else { '[not set]' })"
Write-Host "Anon key: $(if ($anon) { '[set]' } else { '[not set]' })"
Write-Host "Service role: $(if ($service) { '[set]' } else { '[not set]' })"

if (-not $url -or -not $anon) {
  Write-Host "BLOCKED: need STAGING_SUPABASE_URL + STAGING_SUPABASE_ANON_KEY" -ForegroundColor Red
  Write-Host "Set in .env.staging or apps/web/.env.local (VITE_SUPABASE_*)" -ForegroundColor Yellow
  exit 1
}

if (-not $service) {
  Write-Host "BLOCKED: SUPABASE_SERVICE_ROLE_KEY required for API Worker" -ForegroundColor Red
  Write-Host "Add to .env.staging as SUPABASE_SERVICE_ROLE_KEY (from Supabase dashboard > API)" -ForegroundColor Yellow
  exit 1
}

function Set-WorkerSecret {
  param([string]$Name, [string]$Value)
  Push-Location (Join-Path $RepoRoot "apps\api")
  try {
    $Value | npx wrangler secret put $Name --env staging | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "wrangler secret put $Name failed" }
    Write-Host "PASS secret $Name" -ForegroundColor Green
  } finally {
    Pop-Location
  }
}

Set-WorkerSecret -Name 'SUPABASE_URL' -Value $url
Set-WorkerSecret -Name 'SUPABASE_ANON_KEY' -Value $anon
Set-WorkerSecret -Name 'SUPABASE_SERVICE_ROLE_KEY' -Value $service

if (-not $SkipDeploy) {
  Write-Host "`nDeploy API staging..." -ForegroundColor Cyan
  Push-Location $RepoRoot
  try {
    npm run deploy:api:staging
    if ($LASTEXITCODE -ne 0) { throw "deploy:api:staging failed" }
    Write-Host "PASS deploy:api:staging" -ForegroundColor Green
  } finally {
    Pop-Location
  }

  $apiUrl = Resolve-StagingApiBaseUrl
  $health = Invoke-StagingHealthCheck -ApiBaseUrl $apiUrl -RequireSupabase
  if (-not $health.EnvFlags.hasSupabaseUrl -or -not $health.EnvFlags.hasSupabaseAnonKey -or -not $health.EnvFlags.hasSupabaseServiceRoleKey) {
    Write-Host "FAIL: health still missing Supabase flags after deploy" -ForegroundColor Red
    exit 1
  }
  Write-Host "PASS Worker health Supabase flags" -ForegroundColor Green
}

Write-Host "`nStep 3 complete." -ForegroundColor Green
exit 0