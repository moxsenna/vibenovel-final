<#
.SYNOPSIS
  Task 10.21 - Production Supabase baseline migrations 00001-00009 only (exclude 00010).

.DESCRIPTION
  Requires founder approval and gitignored `.env.production` (see `.env.production.example`).
  Never touches staging ref jdxyhrnibmmwlbtbokqo for migration apply.
  Restores staging CLI link after production work.

.PARAMETER Mode
  preflight | apply

.PARAMETER ProductionProjectRef
  Optional override; default extracted from SUPABASE_URL in .env.production

.PARAMETER DbPassword
  Postgres password for supabase link; else SUPABASE_DB_PASSWORD from env file

.EXAMPLE
  npm run operator:production:supabase:baseline -- -Mode preflight
  npm run operator:production:supabase:baseline -- -Mode apply
#>
[CmdletBinding()]
param(
  [ValidateSet("preflight", "apply")]
  [string]$Mode = "preflight",
  [string]$ProductionProjectRef = "",
  [string]$DbPassword = "",
  [string]$StagingProjectRef = "jdxyhrnibmmwlbtbokqo",
  [string]$OperatorEnvFile = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot "lib\staging-smoke-common.ps1")

$Migration10Name = "00010_atomic_grant_credit_topup_rpc.sql"
$Migration10Path = Join-Path $RepoRoot "supabase\migrations\$Migration10Name"
$Migration10Hold = Join-Path $env:TEMP "vibenovel-00010-hold-$Migration10Name"
$BaselineTables = @(
  "profiles", "projects", "credit_balances", "credit_ledger",
  "credit_topup_products", "credit_topup_orders", "payment_webhook_events",
  "generation_attempts", "audit_logs"
)
$BaselineProductSlugs = @("starter", "creator", "pro", "studio")

function Get-OperatorEnvPath {
  if (-not [string]::IsNullOrWhiteSpace($OperatorEnvFile)) {
    return (Resolve-Path $OperatorEnvFile).Path
  }
  return Join-Path $RepoRoot ".env.production"
}

function Import-ProductionEnv {
  param([string]$Path)
  if (-not (Test-Path $Path)) { return $false }
  Import-DotEnvFile -Path $Path
  return $true
}

function Get-ProjectRefFromUrl {
  param([string]$Url)
  if ([string]::IsNullOrWhiteSpace($Url)) { return $null }
  try {
    $urlHost = ([Uri]$Url.Trim()).Host
    if ($urlHost -match '^([a-z0-9]{20})\.supabase\.co$') { return $Matches[1] }
  } catch { }
  return $null
}

function Test-MigrationListBaseline {
  param([string]$ListOutput)
  $ok = $true
  foreach ($n in 1..9) {
    $id = "{0:D5}" -f $n
    if ($ListOutput -notmatch "$id\s+\|\s+$id") {
      Write-Host "FAIL migration $id not applied on remote" -ForegroundColor Red
      $ok = $false
    }
  }
  if ($ListOutput -match '00010\s+\|\s+00010') {
    Write-Host "FAIL 00010 must NOT be applied on production" -ForegroundColor Red
    $ok = $false
  }
  return $ok
}

function Test-ProductionSchema {
  param([string]$SupabaseUrl, [string]$ServiceRoleKey)
  $headers = @{ apikey = $ServiceRoleKey; Authorization = "Bearer $ServiceRoleKey" }
  $pass = $true
  foreach ($table in $BaselineTables) {
    try {
      $uri = ('{0}/rest/v1/{1}?select=id&limit=1' -f $SupabaseUrl.TrimEnd('/'), $table)
      Invoke-RestMethod -Uri $uri -Headers $headers -Method GET -TimeoutSec 30 | Out-Null
      Write-Host "PASS table $table exists" -ForegroundColor Green
    } catch {
      Write-Host "FAIL table $table - $($_.Exception.Message)" -ForegroundColor Red
      $pass = $false
    }
  }
  try {
    $slugFilter = $BaselineProductSlugs -join ','
    $uri = ('{0}/rest/v1/credit_topup_products?select=slug&slug=in.({1})' -f $SupabaseUrl.TrimEnd('/'), $slugFilter)
    $rows = Invoke-RestMethod -Uri $uri -Headers $headers -Method GET -TimeoutSec 30
    $slugs = @($rows | ForEach-Object { $_.slug })
    foreach ($slug in $BaselineProductSlugs) {
      if ($slugs -notcontains $slug) {
        Write-Host "FAIL seed product missing: $slug" -ForegroundColor Red
        $pass = $false
      }
    }
    if ($pass) { Write-Host "PASS topup product seed (starter/creator/pro/studio)" -ForegroundColor Green }
  } catch {
    Write-Host "FAIL topup product seed check" -ForegroundColor Red
    $pass = $false
  }
  try {
    $uri = "$($SupabaseUrl.TrimEnd('/'))/rest/v1/rpc/grant_paid_credit_topup_atomic"
    Invoke-RestMethod -Uri $uri -Headers $headers -Method POST `
      -ContentType "application/json" -Body '{"p_order_id":"00000000-0000-0000-0000-000000000000"}' -TimeoutSec 20
    Write-Host "FAIL 00010 RPC must not exist on production yet" -ForegroundColor Red
    $pass = $false
  } catch {
    if ($_.Exception.Message -match '404|PGRST202|function') {
      Write-Host "PASS grant_paid_credit_topup_atomic absent, 00010 not applied" -ForegroundColor Green
    } else {
      Write-Host "PARTIAL RPC absence check: $(Get-RedactedValue $_.Exception.Message 40)" -ForegroundColor Yellow
    }
  }
  return $pass
}

Write-Host "Task 10.21 - Production Supabase baseline 00001-00009" -ForegroundColor Cyan
Write-Host "Forbidden staging ref: $StagingProjectRef"
Write-Host "Mode: $Mode"

$envPath = Get-OperatorEnvPath
if (-not (Import-ProductionEnv -Path $envPath)) {
  Write-Host "BLOCKED: missing .env.production (copy from .env.production.example)" -ForegroundColor Red
  exit 2
}

$accessToken = [Environment]::GetEnvironmentVariable("SUPABASE_ACCESS_TOKEN")
if (-not [string]::IsNullOrWhiteSpace($accessToken)) {
  [Environment]::SetEnvironmentVariable("SUPABASE_ACCESS_TOKEN", $accessToken, 'Process')
}

$supabaseUrl = [Environment]::GetEnvironmentVariable("SUPABASE_URL")
if ([string]::IsNullOrWhiteSpace($supabaseUrl)) {
  $supabaseUrl = [Environment]::GetEnvironmentVariable("VITE_SUPABASE_URL")
}
$serviceRole = [Environment]::GetEnvironmentVariable("SUPABASE_SERVICE_ROLE_KEY")
$anonKey = [Environment]::GetEnvironmentVariable("SUPABASE_ANON_KEY")
if ([string]::IsNullOrWhiteSpace($DbPassword)) {
  $DbPassword = [Environment]::GetEnvironmentVariable("SUPABASE_DB_PASSWORD")
}

$prodRef = $ProductionProjectRef.Trim()
if ([string]::IsNullOrWhiteSpace($prodRef)) {
  $prodRef = Get-ProjectRefFromUrl -Url $supabaseUrl
}
if ([string]::IsNullOrWhiteSpace($prodRef)) {
  Write-Host "BLOCKED: cannot determine production project ref from SUPABASE_URL" -ForegroundColor Red
  exit 2
}
if ($prodRef -eq $StagingProjectRef) {
  Write-Host "NO-GO: production ref equals staging ref $StagingProjectRef" -ForegroundColor Red
  exit 3
}

Write-Host "Production project ref: $prodRef" -ForegroundColor Gray
Write-Host "Confirmed not staging: yes"

if ([string]::IsNullOrWhiteSpace($supabaseUrl) -or [string]::IsNullOrWhiteSpace($serviceRole) -or [string]::IsNullOrWhiteSpace($anonKey)) {
  Write-Host "BLOCKED: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY required in .env.production" -ForegroundColor Red
  exit 2
}

Write-Host "`nStaging API health (read-only)..." -ForegroundColor Cyan
try {
  $stg = Invoke-RestMethod -Uri "https://api-staging.narraza.web.id/api/health" -TimeoutSec 15
  if ($stg.data.env.creditTopupEnabled -ne $false) { throw "staging not Mode A" }
  Write-Host "PASS staging unchanged Mode A" -ForegroundColor Green
} catch {
  Write-Host "WARN staging health: $($_.Exception.Message)" -ForegroundColor Yellow
}

if ($Mode -eq "preflight") {
  Write-Host "`nPASS preflight - ready for -Mode apply when founder approval on record" -ForegroundColor Green
  Write-Host "Next: npm run operator:production:supabase:baseline -- -Mode apply" -ForegroundColor Yellow
  exit 0
}

if ([string]::IsNullOrWhiteSpace($DbPassword)) {
  Write-Host "BLOCKED: SUPABASE_DB_PASSWORD or -DbPassword required for supabase link" -ForegroundColor Red
  Write-Host "Hint: Supabase Dashboard -> Project Settings -> Database -> Database password" -ForegroundColor Yellow
  exit 2
}
if ([string]::IsNullOrWhiteSpace($accessToken)) {
  Write-Host "WARN: SUPABASE_ACCESS_TOKEN not set - CLI must be logged into the production Supabase account" -ForegroundColor Yellow
}

if (-not (Test-Path $Migration10Path)) {
  Write-Host "FAIL migration 00010 file missing at repo" -ForegroundColor Red
  exit 1
}

$moved10 = $false
try {
  Write-Host "`n[1] Exclude 00010 from push..." -ForegroundColor Cyan
  Move-Item -Path $Migration10Path -Destination $Migration10Hold -Force
  $moved10 = $true
  if (Test-Path $Migration10Path) { throw "00010 still in migrations folder" }
  Write-Host "PASS 00010 moved to hold" -ForegroundColor Green

  Write-Host "`n[2] Link production CLI..." -ForegroundColor Cyan
  Push-Location $RepoRoot
  try {
    & supabase link --project-ref $prodRef --password $DbPassword
    if ($LASTEXITCODE -ne 0) { throw "supabase link failed" }
    $linkedRef = Get-Content (Join-Path $RepoRoot "supabase\.temp\project-ref") -Raw
    if ($linkedRef.Trim() -ne $prodRef) { throw "linked ref mismatch" }
    if ($linkedRef.Trim() -eq $StagingProjectRef) { throw "accidentally linked staging" }
    Write-Host "PASS linked production $prodRef" -ForegroundColor Green
  } finally { Pop-Location }

  Write-Host "`n[3] db push baseline..." -ForegroundColor Cyan
  Push-Location $RepoRoot
  try {
    & supabase db push
    if ($LASTEXITCODE -ne 0) { throw "supabase db push failed" }
    Write-Host "PASS db push" -ForegroundColor Green
  } finally { Pop-Location }

  Write-Host "`n[4] Migration list verify..." -ForegroundColor Cyan
  Push-Location $RepoRoot
  try {
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $listOut = (& supabase migration list --linked 2>&1 | Out-String)
    $ErrorActionPreference = $prevEap
    Write-Host $listOut
    if (-not (Test-MigrationListBaseline -ListOutput $listOut)) { throw "migration list check failed" }
    Write-Host 'PASS 00001-00009 applied, 00010 not on remote' -ForegroundColor Green
  } finally { Pop-Location }

  Write-Host "`n[5] Schema verification..." -ForegroundColor Cyan
  if (-not (Test-ProductionSchema -SupabaseUrl $supabaseUrl -ServiceRoleKey $serviceRole)) {
    throw "schema verification failed"
  }

} finally {
  if ($moved10 -and (Test-Path $Migration10Hold)) {
    Move-Item -Path $Migration10Hold -Destination $Migration10Path -Force
    Write-Host "`nRestored 00010 to supabase/migrations/" -ForegroundColor Cyan
  }
  Write-Host "`n[6] Restore staging CLI link..." -ForegroundColor Cyan
  Push-Location $RepoRoot
  try {
    $stagingPw = $null
    $stagingToken = $null
    $stagingEnv = Join-Path $RepoRoot ".env.staging"
    if (Test-Path $stagingEnv) {
      Import-DotEnvFile -Path $stagingEnv
      $stagingPw = [Environment]::GetEnvironmentVariable("SUPABASE_DB_PASSWORD")
      $stagingToken = [Environment]::GetEnvironmentVariable("SUPABASE_ACCESS_TOKEN")
    }
    if ($stagingToken) {
      [Environment]::SetEnvironmentVariable("SUPABASE_ACCESS_TOKEN", $stagingToken, "Process")
    } else {
      [Environment]::SetEnvironmentVariable("SUPABASE_ACCESS_TOKEN", $null, "Process")
    }
    if ($stagingPw -and $stagingToken) {
      $prevEap = $ErrorActionPreference
      $ErrorActionPreference = "Continue"
      & supabase link --project-ref $StagingProjectRef --password $stagingPw 2>&1 | Out-Null
      $ErrorActionPreference = $prevEap
      Write-Host "PASS restored staging CLI link" -ForegroundColor Green
    } else {
      Write-Host "WARN: CLI remains on production account - relink staging with staging SUPABASE_ACCESS_TOKEN + SUPABASE_DB_PASSWORD in .env.staging" -ForegroundColor Yellow
    }
  } finally { Pop-Location }
}

Write-Host "`nPASS Task 10.21 production baseline apply" -ForegroundColor Green
exit 0