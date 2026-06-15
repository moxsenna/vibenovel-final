<#
.SYNOPSIS
  Upload production Cloudflare Worker secrets and deploy the production API Worker.

.DESCRIPTION
  Reads gitignored .env.production, validates required production secrets, uploads them
  with wrangler secret put --env production, then deploys apps/api to Cloudflare Workers.
  Never prints secret values.

.EXAMPLE
  npm run operator:production:worker-secrets -- -RequireLiveDuitku
#>
[CmdletBinding()]
param(
  [switch]$RequireLiveDuitku,
  [bool]$RequireOpenRouter = $true,
  [switch]$SkipDeploy,
  [string]$ApiBaseUrl = "https://api.narraza.web.id",
  [string]$WorkersDevBaseUrl = "https://vibenovel-api.moxsenna.workers.dev",
  [string]$OldEc2Ip = "13.251.228.117"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot "lib\staging-smoke-common.ps1")

$envPath = Join-Path $RepoRoot ".env.production"
if (-not (Test-Path $envPath)) {
  Write-Host "BLOCKED: missing .env.production" -ForegroundColor Red
  exit 2
}

Import-DotEnvFile -Path $envPath

function Get-RequiredEnv {
  param([string]$Name)
  $value = [Environment]::GetEnvironmentVariable($Name)
  if ([string]::IsNullOrWhiteSpace($value)) { return $null }
  return $value.Trim()
}

function Add-Missing {
  param([string[]]$Names)
  $missing = @()
  foreach ($name in $Names) {
    if (-not (Get-RequiredEnv $name)) { $missing += $name }
  }
  return $missing
}

$missing = @()
$missing += Add-Missing @("SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY")

if ($RequireOpenRouter) {
  $missing += Add-Missing @("OPENROUTER_API_KEY")
}

if ($RequireLiveDuitku) {
  $missing += Add-Missing @("DUITKU_MERCHANT_CODE", "DUITKU_MERCHANT_KEY")
  $duitkuEnv = Get-RequiredEnv "DUITKU_ENV"
  if ($duitkuEnv -and $duitkuEnv.ToLowerInvariant() -ne "production") {
    Write-Host "BLOCKED: DUITKU_ENV in .env.production is '$duitkuEnv', expected production" -ForegroundColor Red
    exit 3
  }
}

$prodRefAudit = Test-ProductionSupabaseProjectRefAudit
if (-not $prodRefAudit.Ok) {
  Write-Host "BLOCKED: production Supabase audit failed: $($prodRefAudit.Message)" -ForegroundColor Red
  exit 3
}

if ($missing.Count -gt 0) {
  Write-Host "BLOCKED: missing production Worker secret(s): $($missing -join ', ')" -ForegroundColor Red
  Write-Host "Fill .env.production, then rerun this script. Secret values were not printed." -ForegroundColor Yellow
  exit 2
}

if (-not $SkipDeploy) {
  try {
    $apiHost = ([Uri]$ApiBaseUrl).Host
    $dnsHits = Resolve-DnsName $apiHost -ErrorAction Stop |
      Where-Object { $_.Type -in @("A", "CNAME") }
    $oldHits = $dnsHits | Where-Object { $_.IPAddress -eq $OldEc2Ip -or $_.NameHost }
    if ($oldHits) {
      Write-Host "BLOCKED: $apiHost still has old external DNS record(s); remove them before Worker custom-domain deploy." -ForegroundColor Red
      Write-Host "Current DNS includes old EC2 IP or CNAME. Custom Domain attach will fail until this is removed." -ForegroundColor Yellow
      exit 4
    }
  } catch {
    # NXDOMAIN is acceptable here: Wrangler custom-domain deploy can create the record.
  }
}

Write-Host "Production Worker secret preflight" -ForegroundColor Cyan
Write-Host "Supabase ref: $($prodRefAudit.ApiRef)"
Write-Host "OpenRouter key: $(if (Get-RequiredEnv 'OPENROUTER_API_KEY') { '[set]' } else { '[not set]' })"
Write-Host "Duitku merchant code: $(if (Get-RequiredEnv 'DUITKU_MERCHANT_CODE') { '[set]' } else { '[not set]' })"
Write-Host "Duitku merchant key: $(if (Get-RequiredEnv 'DUITKU_MERCHANT_KEY') { '[set]' } else { '[not set]' })"

function Invoke-ApiDeploy {
  Push-Location $RepoRoot
  try {
    npm run deploy:api:production:raw
    if ($LASTEXITCODE -ne 0) { throw "deploy:api:production:raw failed" }
  } finally {
    Pop-Location
  }
}

function Set-WorkerSecret {
  param([string]$Name)
  $value = Get-RequiredEnv $Name
  if (-not $value) { return }
  Push-Location (Join-Path $RepoRoot "apps\api")
  try {
    $value | npx wrangler secret put $Name --env production | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "wrangler secret put $Name failed" }
    Write-Host "PASS secret $Name" -ForegroundColor Green
  } finally {
    Pop-Location
  }
}

$secretNames = @(
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENROUTER_API_KEY",
  "DUITKU_MERCHANT_CODE",
  "DUITKU_MERCHANT_KEY"
)

if (-not $SkipDeploy) {
  Write-Host "`nBootstrap/deploy production Worker..." -ForegroundColor Cyan
  Invoke-ApiDeploy
}

Write-Host "`nUpload production Worker secrets..." -ForegroundColor Cyan
foreach ($name in $secretNames) {
  Set-WorkerSecret -Name $name
}

if (-not $SkipDeploy) {
  Write-Host "`nRedeploy production Worker after secret upload..." -ForegroundColor Cyan
  Invoke-ApiDeploy
}

function Invoke-Health {
  param([string]$BaseUrl)
  try {
    return Invoke-RestMethod -Uri "$($BaseUrl.TrimEnd('/'))/api/health" -TimeoutSec 30
  } catch {
    Write-Host ("WARN health failed for {0}: {1}" -f $BaseUrl, $_.Exception.Message) -ForegroundColor Yellow
    return $null
  }
}

if (-not $SkipDeploy) {
  Write-Host "`nProduction health smoke..." -ForegroundColor Cyan
  $health = Invoke-Health -BaseUrl $ApiBaseUrl
  if (-not $health) {
    $health = Invoke-Health -BaseUrl $WorkersDevBaseUrl
  }
  if (-not $health -or -not $health.ok) {
    Write-Host "FAIL production health smoke" -ForegroundColor Red
    exit 1
  }

  $e = $health.data.env
  Write-Host "appEnv=$($e.appEnv)" -ForegroundColor Green
  Write-Host "aiGenerationEnabled=$($e.aiGenerationEnabled)" -ForegroundColor Green
  Write-Host "hasOpenRouterApiKey=$($e.hasOpenRouterApiKey)" -ForegroundColor Green
  Write-Host "creditTopupEnabled=$($e.creditTopupEnabled)" -ForegroundColor Green
  Write-Host "paymentProvider=$($e.paymentProvider)" -ForegroundColor Green
  Write-Host "paymentProviderMock=$($e.paymentProviderMock)" -ForegroundColor Green

  if ($RequireOpenRouter -and -not [bool]$e.hasOpenRouterApiKey) { throw "OpenRouter secret missing in health" }
  if ($RequireLiveDuitku) {
    if (-not [bool]$e.creditTopupEnabled) { throw "creditTopupEnabled false" }
    if ($e.paymentProvider -ne "duitku") { throw "paymentProvider not duitku" }
    if ([bool]$e.paymentProviderMock) { throw "paymentProviderMock true" }
    if ($null -ne $e.PSObject.Properties["hasDuitkuMerchantCode"] -and -not [bool]$e.hasDuitkuMerchantCode) {
      throw "Duitku merchant code missing in health"
    }
    if ($null -ne $e.PSObject.Properties["hasDuitkuMerchantKey"] -and -not [bool]$e.hasDuitkuMerchantKey) {
      throw "Duitku merchant key missing in health"
    }
  }
}

Write-Host "`nPASS production Worker secrets/deploy" -ForegroundColor Green
exit 0
