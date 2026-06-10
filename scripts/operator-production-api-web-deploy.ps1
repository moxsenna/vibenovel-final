<#
.SYNOPSIS
  Task 10.23 / 10.23a — Production API/app Mode A deploy preflight.

.DESCRIPTION
  Domain model:
    narraza.web.id      = homepage / landing (not dashboard)
    app.narraza.web.id  = app / dashboard
    api.narraza.web.id  = API

  Preflight only unless -ApprovalText matches required founder string and -Mode apply.
  Never uses staging EC2 13.212.245.32 or staging Supabase jdxyhrnibmmwlbtbokqo.

.PARAMETER Mode
  preflight | apply

.PARAMETER ApprovalText
  Must be exactly: APPROVE TASK 10.23 PRODUCTION API WEB MODE A DEPLOY ONLY

.EXAMPLE
  npm run operator:production:api-web:deploy -- -Mode preflight
#>
[CmdletBinding()]
param(
  [ValidateSet("preflight", "apply")]
  [string]$Mode = "preflight",
  [string]$ApprovalText = "",
  [string]$StagingProjectRef = "jdxyhrnibmmwlbtbokqo",
  [string]$StagingEc2Ip = "13.212.245.32",
  [string]$ProductionApiHost = "api.narraza.web.id",
  [string]$ProductionAppHost = "app.narraza.web.id",
  [string]$ProductionHomepageHost = "narraza.web.id"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RequiredApproval = "APPROVE TASK 10.23 PRODUCTION API WEB MODE A DEPLOY ONLY"
$RepoRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot "lib\staging-smoke-common.ps1")

function Get-ProjectRefFromUrl {
  param([string]$Url)
  if ([string]::IsNullOrWhiteSpace($Url)) { return $null }
  try {
    $urlHost = ([Uri]$Url.Trim()).Host
    if ($urlHost -match '^([a-z0-9]{20})\.supabase\.co$') { return $Matches[1] }
  } catch { }
  return $null
}

function Test-ModeAEnvFile {
  param([string]$Path)
  if (-not (Test-Path $Path)) { return $false, "missing" }
  $map = @{}
  Import-DotEnvFile -Path $Path -KeyMap $map
  $ref = Get-ProjectRefFromUrl -Url $env:SUPABASE_URL
  if ([string]::IsNullOrWhiteSpace($ref)) {
    $ref = Get-ProjectRefFromUrl -Url $env:VITE_SUPABASE_URL
  }
  if ($ref -eq $StagingProjectRef) { return $false, "staging supabase ref" }
  if ($env:CREDIT_TOPUP_ENABLED -eq "true") { return $false, "CREDIT_TOPUP_ENABLED=true" }
  if ($env:PAYMENT_PROVIDER -eq "duitku") { return $false, "PAYMENT_PROVIDER=duitku" }
  if ($env:PAYMENT_PROVIDER_MOCK -eq "false") { return $false, "PAYMENT_PROVIDER_MOCK=false" }
  if ($env:AI_GENERATION_ENABLED -eq "true") { return $false, "AI_GENERATION_ENABLED=true" }
  $origins = $env:ALLOWED_ORIGINS
  if ($origins -notmatch 'app\.narraza\.web\.id') { return $false, "ALLOWED_ORIGINS missing app.narraza.web.id" }
  if ($origins -notmatch 'narraza\.web\.id') { return $false, "ALLOWED_ORIGINS missing narraza.web.id" }
  if ($env:DUITKU_MERCHANT_CODE -or $env:DUITKU_MERCHANT_KEY) { return $false, "Duitku vars set" }
  return $true, "ok ref=$ref"
}

Write-Host "Task 10.23/10.23a - Production API/app Mode A" -ForegroundColor Cyan
Write-Host "Homepage: https://$ProductionHomepageHost (landing — not dashboard)"
Write-Host "App:      https://$ProductionAppHost"
Write-Host "API:      https://$ProductionApiHost"
Write-Host "Forbidden staging EC2: $StagingEc2Ip"
Write-Host "Forbidden staging Supabase: $StagingProjectRef"
Write-Host "Mode: $Mode"

$envPath = Join-Path $RepoRoot ".env.production"
$envOk, $envMsg = Test-ModeAEnvFile -Path $envPath
if (-not $envOk) {
  Write-Host "BLOCKED: .env.production - $envMsg" -ForegroundColor Red
  exit 2
}
Write-Host "PASS .env.production Mode A ($envMsg)" -ForegroundColor Green

Write-Host "`nStaging regression (read-only)..." -ForegroundColor Cyan
try {
  $stg = Invoke-RestMethod -Uri "https://api-staging.narraza.web.id/api/health" -TimeoutSec 15
  if ($stg.data.env.creditTopupEnabled -ne $false) { throw "staging payment on" }
  Write-Host "PASS staging Mode A" -ForegroundColor Green
} catch {
  Write-Host "WARN staging health: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host "`nProduction API DNS ($ProductionApiHost)..." -ForegroundColor Cyan
try {
  $resolved = [System.Net.Dns]::GetHostAddresses($ProductionApiHost)
  $ip = ($resolved | Select-Object -First 1).IPAddressToString
  if ($ip -eq $StagingEc2Ip) {
    Write-Host "NO-GO: $ProductionApiHost resolves to staging EC2 $StagingEc2Ip" -ForegroundColor Red
    exit 3
  }
  Write-Host "PASS $ProductionApiHost -> $ip (not staging EC2)" -ForegroundColor Green
} catch {
  Write-Host "BLOCKED: $ProductionApiHost not resolvable - configure A record to production EIP" -ForegroundColor Red
}

Write-Host "`nProduction app DNS ($ProductionAppHost)..." -ForegroundColor Cyan
try {
  $resolved = [System.Net.Dns]::GetHostAddresses($ProductionAppHost)
  $ip = ($resolved | Select-Object -First 1).IPAddressToString
  Write-Host "PASS $ProductionAppHost -> $ip" -ForegroundColor Green
} catch {
  Write-Host "PENDING: $ProductionAppHost not resolvable - attach Pages custom domain" -ForegroundColor Yellow
}

Write-Host "`nProduction API health..." -ForegroundColor Cyan
try {
  $prod = Invoke-RestMethod -Uri "https://$ProductionApiHost/api/health" -TimeoutSec 15
  if ($prod.data.env.creditTopupEnabled -ne $false) { throw "production payment on" }
  Write-Host "PASS production API health Mode A" -ForegroundColor Green
} catch {
  Write-Host "PARTIAL: production API not healthy yet - $($_.Exception.Message)" -ForegroundColor Yellow
}

if ($Mode -eq "preflight") {
  Write-Host "`nPreflight complete. Infra unblock: npm run operator:production:infra:unblock" -ForegroundColor Yellow
  Write-Host "Deploy API+app after EC2/DNS ready: npm run operator:production:aws:deploy -- -Ec2Ip <EIP> -ApprovalText `"$RequiredApproval`"" -ForegroundColor Yellow
  exit 0
}

if ($ApprovalText.Trim() -ne $RequiredApproval) {
  Write-Host "BLOCKED: approval text required: $RequiredApproval" -ForegroundColor Red
  exit 2
}

Write-Host "BLOCKED: use operator:production:aws:deploy after infra unblock (docs/82)" -ForegroundColor Red
exit 2