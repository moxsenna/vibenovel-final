<#
.SYNOPSIS
  Task 10.29 - Founder production browser E2E (Playwright + regression).

  Never prints secrets. Requires gitignored .env.production for Supabase admin session.
#>
[CmdletBinding()]
param(
  [string]$AppBaseUrl = "https://app.narraza.web.id",
  [string]$ApiBaseUrl = "https://api.narraza.web.id",
  [string]$StagingApiUrl = "https://api-staging.narraza.web.id",
  [string]$FounderEmail = "moxsenna@gmail.com",
  [string]$ProjectId = "c5a9f0fb-7f45-4c9f-b37f-4a2981adeba9"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot "lib\staging-smoke-common.ps1")
Import-DotEnvFile -Path (Join-Path $RepoRoot ".env.production")

$sbUrl = $env:SUPABASE_URL.Trim().TrimEnd("/")
$anon = $env:SUPABASE_ANON_KEY
$srk = $env:SUPABASE_SERVICE_ROLE_KEY
if ([string]::IsNullOrWhiteSpace($sbUrl) -or [string]::IsNullOrWhiteSpace($anon) -or [string]::IsNullOrWhiteSpace($srk)) {
  throw "Production Supabase env missing"
}

if ($sbUrl -match 'jdxyhrnibmmwlbtbokqo') { throw "staging supabase forbidden" }
$ref = ([Uri]$sbUrl).Host.Split('.')[0]

Write-Host "`nTask 10.29 - Founder browser E2E" -ForegroundColor Cyan

# Health
$prodHealth = Invoke-RestMethod -Uri "$ApiBaseUrl/api/health"
Write-Host ("Prod health: ai={0} topup={1}" -f $prodHealth.data.env.aiGenerationEnabled, $prodHealth.data.env.creditTopupEnabled)
if (-not $prodHealth.data.env.aiGenerationEnabled) { throw "Production AI not enabled" }

try {
  $stagingHealth = Invoke-RestMethod -Uri "$StagingApiUrl/api/health"
  Write-Host ("Staging health: ok={0}" -f $stagingHealth.ok)
} catch {
  $stagingHealth = Invoke-RestMethod -Uri "https://vibenovel-api-staging.moxsenna.workers.dev/api/health"
  Write-Host ("Staging health (fallback): ok={0}" -f $stagingHealth.ok)
}

foreach ($url in @("https://narraza.web.id", $AppBaseUrl, "$AppBaseUrl/login")) {
  $r = Invoke-WebRequest -Uri $url -UseBasicParsing -Method Head
  Write-Host ("HTTP {0}: {1}" -f $r.StatusCode, $url)
}

# Founder session (admin magiclink - no password printed)
$adminH = @{ apikey = $srk; Authorization = "Bearer $srk"; "Content-Type" = "application/json" }
$linkRes = Invoke-RestMethod -Uri "$sbUrl/auth/v1/admin/generate_link" -Method POST -Headers $adminH `
  -Body (@{ type = "magiclink"; email = $FounderEmail } | ConvertTo-Json)
$verifyRes = Invoke-RestMethod -Uri "$sbUrl/auth/v1/verify" -Method POST `
  -Headers @{ apikey = $anon; Authorization = "Bearer $anon"; "Content-Type" = "application/json" } `
  -Body (@{ type = "magiclink"; token_hash = $linkRes.hashed_token } | ConvertTo-Json)
if (-not $verifyRes.access_token) { throw "Founder session failed" }
Write-Host "Founder session: ok"

$bal = Invoke-RestMethod -Uri "$sbUrl/rest/v1/credit_balances?user_id=eq.$($verifyRes.user.id)&select=balance" -Headers $adminH
Write-Host ("Credit balance before E2E: {0}" -f $bal[0].balance)

# Bundle audit (if dist exists)
$distDir = Join-Path $RepoRoot "apps\web\dist"
if (Test-Path $distDir) {
  $hits = Select-String -Path (Join-Path $distDir "assets\*.js") -Pattern "jdxyhrnibmmwlbtbokqo|api-staging\.narraza|vibenovel-api-staging" -SimpleMatch -ErrorAction SilentlyContinue
  Write-Host ("Bundle staging refs: {0}" -f $(if ($hits) { $hits.Count } else { 0 }))
}

# Playwright
$env:SMOKE_WEB_BASE_URL = $AppBaseUrl
$env:SMOKE_PROJECT_ID = $ProjectId
$env:SMOKE_ACCESS_TOKEN = $verifyRes.access_token
$env:SMOKE_REFRESH_TOKEN = $verifyRes.refresh_token
$env:SMOKE_SUPABASE_REF = $ref
$env:SMOKE_USER_JSON = ($verifyRes.user | ConvertTo-Json -Compress -Depth 6)

Push-Location (Join-Path $RepoRoot "apps\web")
try {
  npx playwright test e2e/sprint10-founder-production-e2e.spec.ts --reporter=list
  if ($LASTEXITCODE -ne 0) { throw "Playwright E2E failed with exit $LASTEXITCODE" }
} finally {
  Pop-Location
  Remove-Item Env:SMOKE_WEB_BASE_URL, Env:SMOKE_PROJECT_ID, Env:SMOKE_ACCESS_TOKEN, Env:SMOKE_REFRESH_TOKEN, Env:SMOKE_SUPABASE_REF, Env:SMOKE_USER_JSON -ErrorAction SilentlyContinue
}

$balAfter = Invoke-RestMethod -Uri "$sbUrl/rest/v1/credit_balances?user_id=eq.$($verifyRes.user.id)&select=balance" -Headers $adminH
Write-Host ("Credit balance after E2E: {0}" -f $balAfter[0].balance)

Write-Host "`nTask 10.29 browser E2E: GO" -ForegroundColor Green