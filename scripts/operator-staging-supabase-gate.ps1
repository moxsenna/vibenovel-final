<#
.SYNOPSIS
  Task 11.2b operator gate — web rebuild + full staging smoke (steps 4–5).

.DESCRIPTION
  Run AFTER operator completes manually:
    1. Create hosted Supabase staging project (not production)
    2. supabase login / link / db push (00001–00009)
    3. wrangler secret put × 3 + npm run deploy:api:staging

  Requires env vars (never commit):
    STAGING_SUPABASE_URL
    STAGING_SUPABASE_ANON_KEY
  Optional for Worker/API checks only (not printed):
    STAGING_SUPABASE_SERVICE_ROLE_KEY

  Or copy .env.staging.example → .env.staging and fill SUPABASE_URL + SUPABASE_ANON_KEY.

  Never logs secret values.

.EXAMPLE
  # After steps 1–3 complete and health shows hasSupabaseUrl=true:
  $env:STAGING_SUPABASE_URL = "https://<project>.supabase.co"
  $env:STAGING_SUPABASE_ANON_KEY = "<anon-key>"
  powershell -File scripts/operator-staging-supabase-gate.ps1
#>
[CmdletBinding()]
param(
  [string]$ApiBaseUrl = "",
  [string]$WebBaseUrl = "",
  [string]$TestEmail = "",
  [string]$TestPassword = "VibeNovel-Staging-Smoke-Test!",
  [switch]$SkipWebDeploy,
  [switch]$SkipSmoke,
  [switch]$HealthOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot "lib\staging-smoke-common.ps1")

Import-StagingSupabaseEnv -RepoRoot $RepoRoot

$stagingUrl = Get-StagingSupabaseCredential 'STAGING_SUPABASE_URL'
$stagingAnon = Get-StagingSupabaseCredential 'STAGING_SUPABASE_ANON_KEY'
$ApiBaseUrl = Resolve-StagingApiBaseUrl -ApiBaseUrl $ApiBaseUrl
$WebBaseUrl = Resolve-StagingWebBaseUrl -WebBaseUrl $WebBaseUrl

Write-Host "Operator staging gate (steps 4-5)" -ForegroundColor Cyan
Write-Host "API: $ApiBaseUrl"
Write-Host "Web: $WebBaseUrl"
Write-Host "Supabase URL: $(if ($stagingUrl) { Get-RedactedValue $stagingUrl 12 } else { '[not set]' })"

# --- Preflight: API health must show Supabase on Worker ---
Write-Host "`nPreflight: Worker staging health..." -ForegroundColor Cyan
$health = Invoke-StagingHealthCheck -ApiBaseUrl $ApiBaseUrl -RequireSupabase
if ($health.ContainsKey('Error') -and $health.Error) {
  Write-Host "FAIL: cannot reach API health - $($health.Error)" -ForegroundColor Red
  Write-Host "Complete steps 1-3 (wrangler secrets + deploy) first." -ForegroundColor Yellow
  exit 1
}
if (-not $health.EnvFlags.hasSupabaseUrl) {
  Write-Host "BLOCKED: hasSupabaseUrl=false on Worker staging." -ForegroundColor Red
  Write-Host "Run wrangler secret put SUPABASE_* --env staging and deploy:api:staging." -ForegroundColor Yellow
  exit 1
}
if (-not $health.EnvFlags.hasSupabaseAnonKey -or -not $health.EnvFlags.hasSupabaseServiceRoleKey) {
  Write-Host "BLOCKED: Worker missing Supabase anon/service role flags." -ForegroundColor Red
  exit 1
}
Write-Host "PASS Worker Supabase flags on /api/health" -ForegroundColor Green

if (-not $stagingUrl -or -not $stagingAnon) {
  Write-Host "BLOCKED: set STAGING_SUPABASE_URL + STAGING_SUPABASE_ANON_KEY (or .env.staging)" -ForegroundColor Red
  exit 1
}

if ($HealthOnly) {
  Write-Host "PASS health-only preflight" -ForegroundColor Green
  exit 0
}

# --- Step 4: Web rebuild + deploy ---
if (-not $SkipWebDeploy) {
  Write-Host "`nStep 4: build + deploy web staging..." -ForegroundColor Cyan
  $env:VITE_API_URL = $ApiBaseUrl
  $env:VITE_SUPABASE_URL = $stagingUrl
  $env:VITE_SUPABASE_ANON_KEY = $stagingAnon
  $env:VITE_USE_MOCKS = "false"
  Push-Location $RepoRoot
  try {
    npm run build:web
    if ($LASTEXITCODE -ne 0) { throw "build:web failed" }
    npm run deploy:web:staging
    if ($LASTEXITCODE -ne 0) { throw "deploy:web:staging failed" }
    Write-Host "PASS web staging deploy" -ForegroundColor Green
  } finally {
    Pop-Location
    Remove-Item Env:VITE_SUPABASE_URL -ErrorAction SilentlyContinue
    Remove-Item Env:VITE_SUPABASE_ANON_KEY -ErrorAction SilentlyContinue
    Remove-Item Env:VITE_API_URL -ErrorAction SilentlyContinue
    Remove-Item Env:VITE_USE_MOCKS -ErrorAction SilentlyContinue
  }
} else {
  Write-Host "SKIP web deploy (-SkipWebDeploy)" -ForegroundColor Yellow
}

# --- Step 5: Full staging smoke ---
if (-not $SkipSmoke) {
  Write-Host "`nStep 5: smoke:staging -IncludeApiMode..." -ForegroundColor Cyan
  $smokeScript = Join-Path $PSScriptRoot "smoke-staging.ps1"
  & $smokeScript `
    -ApiBaseUrl $ApiBaseUrl `
    -WebBaseUrl $WebBaseUrl `
    -SupabaseUrl $stagingUrl `
    -SupabaseAnonKey $stagingAnon `
    -TestEmail $TestEmail `
    -TestPassword $TestPassword `
    -IncludeApiMode `
    -TargetName "cloudflare-staging-full"
  if ($LASTEXITCODE -ne 0) {
    Write-Host "FAIL smoke:staging" -ForegroundColor Red
    exit 1
  }
  Write-Host "PASS full staging smoke" -ForegroundColor Green
}

Write-Host "`nOperator gate steps 4-5 complete." -ForegroundColor Green
exit 0