<#
.SYNOPSIS
  Task 10.13b — Duitku Mode B live sandbox on Narraza AWS staging API.

.PARAMETER Mode
  preflight | apply | smoke | rollback | full

.EXAMPLE
  npm run operator:aws:duitku:gate -- -Mode preflight
  npm run operator:aws:duitku:gate -- -Mode full -TestEmail staging-smoke@vibenovel.test
#>
[CmdletBinding()]
param(
  [ValidateSet("preflight", "apply", "smoke", "rollback", "full")]
  [string]$Mode = "preflight",
  [string]$ApiBaseUrl = "https://api-staging.narraza.web.id",
  [string]$WebBaseUrl = "https://vibenovel-web-staging.pages.dev",
  [string]$Ec2Ip = "13.212.245.32",
  [string]$SshKeyPath = "D:\0Project\VibeNovel\vibenovel-staging-key.pem",
  [string]$SshUser = "ubuntu",
  [string]$Ec2AppDir = "/opt/vibenovel",
  [string]$TestEmail = "staging-smoke@vibenovel.test",
  [string]$TestPassword = "VibeNovel-Staging-Smoke-Test!",
  [string]$OperatorEnvFile = "",
  [switch]$SkipCallbackRegistrationCheck,
  [switch]$SkipRollback,
  [switch]$LiveCreate,
  [switch]$ExpectCallback
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$RepoRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot "lib\staging-smoke-common.ps1")

$DuitkuCallbackUrl = "$($ApiBaseUrl.TrimEnd('/'))/api/payments/duitku/callback"

function Get-OperatorEnvPath {
  if (-not [string]::IsNullOrWhiteSpace($OperatorEnvFile)) {
    return (Resolve-Path $OperatorEnvFile).Path
  }
  $candidates = @(
    (Join-Path $RepoRoot ".env.staging.duitku"),
    (Join-Path $RepoRoot ".env.staging")
  )
  foreach ($p in $candidates) {
    if (Test-Path $p) { return $p }
  }
  return $null
}

function Test-OperatorDuitkuSecrets {
  param([string]$EnvPath)
  if (-not $EnvPath -or -not (Test-Path $EnvPath)) { return $false }
  $map = @{}
  Import-DotEnvFile -Path $EnvPath -KeyMap $map
  $code = [Environment]::GetEnvironmentVariable("DUITKU_MERCHANT_CODE")
  $key = [Environment]::GetEnvironmentVariable("DUITKU_MERCHANT_KEY")
  return (-not [string]::IsNullOrWhiteSpace($code) -and -not [string]::IsNullOrWhiteSpace($key))
}

function Get-ApiHealth {
  try {
    return Invoke-RestMethod -Uri "$ApiBaseUrl/api/health" -TimeoutSec 20
  } catch { return $null }
}

function Write-ModeBEnvTemplate {
  param([string]$Path)
  $lines = @(
    "# Mode B - Duitku sandbox only (gitignored operator file)",
    "CREDIT_TOPUP_ENABLED=true",
    "PAYMENT_PROVIDER=duitku",
    "PAYMENT_PROVIDER_MOCK=false",
    "DUITKU_ENV=sandbox",
    "DUITKU_CALLBACK_URL=$DuitkuCallbackUrl",
    "DUITKU_RETURN_URL=$WebBaseUrl/credits/topup/return",
    "DUITKU_MERCHANT_CODE=",
    "DUITKU_MERCHANT_KEY="
  )
  Set-Content -Path $Path -Value ($lines -join "`n")
}

function Invoke-Ec2ModeBDeploy {
  param([string]$LocalEnvPath)
  if (-not (Test-Path $SshKeyPath)) { throw "SSH key not found: $SshKeyPath" }
  $sshTarget = "${SshUser}@${Ec2Ip}"
  $remoteTmp = "/tmp/vibenovel-mode-b.env"
  & scp -i $SshKeyPath -o StrictHostKeyChecking=accept-new $LocalEnvPath "${sshTarget}:${remoteTmp}"
  if ($LASTEXITCODE -ne 0) { throw "scp env failed" }
  $cmd = @(
    "sudo cp ${remoteTmp} ${Ec2AppDir}/.env.staging",
    "sudo chmod 600 ${Ec2AppDir}/.env.staging",
    "sudo chown vibenovel:vibenovel ${Ec2AppDir}/.env.staging",
    "cd ${Ec2AppDir} && sudo -u vibenovel docker compose -f docker-compose.staging.yml up -d --build",
    "sleep 8",
    "curl -sf http://127.0.0.1:8787/api/health | head -c 400"
  ) -join " && "
  & ssh -i $SshKeyPath $sshTarget $cmd
  if ($LASTEXITCODE -ne 0) { throw "EC2 Mode B deploy failed" }
}

function Invoke-Ec2ModeARollback {
  param([string]$BaseEnvPath)
  if (-not (Test-Path $SshKeyPath)) { throw "SSH key not found: $SshKeyPath" }
  $rollbackPath = Join-Path $env:TEMP "vibenovel-mode-a-rollback.env"
  $baseLines = Get-Content $BaseEnvPath | Where-Object {
    $_ -notmatch '^\s*DUITKU_' -and $_ -notmatch '^\s*CREDIT_TOPUP_ENABLED\s*=' `
      -and $_ -notmatch '^\s*PAYMENT_PROVIDER\s*=' -and $_ -notmatch '^\s*PAYMENT_PROVIDER_MOCK\s*='
  }
  $modeA = @(
    $baseLines
    ""
    "CREDIT_TOPUP_ENABLED=false"
    "PAYMENT_PROVIDER=mock"
    "PAYMENT_PROVIDER_MOCK=true"
    "PAYMENT_PROVIDER_MOCK_MODE=success"
  )
  Set-Content -Path $rollbackPath -Value ($modeA -join "`n")
  try {
    Invoke-Ec2ModeBDeploy -LocalEnvPath $rollbackPath
  } finally {
    Remove-Item $rollbackPath -ErrorAction SilentlyContinue
  }
}

Write-Host "Task 10.13b - Duitku Mode B (Narraza AWS staging)" -ForegroundColor Cyan
Write-Host "API: $ApiBaseUrl"
Write-Host "Callback: $DuitkuCallbackUrl"

$health = Get-ApiHealth
if (-not $health -or -not $health.ok) {
  Write-Host "BLOCKED: API health unreachable" -ForegroundColor Red
  exit 1
}
$envFlags = $health.data.env
Write-Host "PASS preflight health appEnv=$($envFlags.appEnv) topup=$($envFlags.creditTopupEnabled) mock=$($envFlags.paymentProviderMock) provider=$($envFlags.paymentProvider)" -ForegroundColor Green
Write-Host "  hasDuitkuCode=$($envFlags.hasDuitkuMerchantCode) hasDuitkuKey=$($envFlags.hasDuitkuMerchantKey) hasCallback=$($envFlags.hasDuitkuCallbackUrl)"

if ($Mode -eq "preflight") {
  if (-not $SkipCallbackRegistrationCheck) {
    Write-Host "`nOperator: register Duitku sandbox callback URL in merchant portal:" -ForegroundColor Yellow
    Write-Host "  $DuitkuCallbackUrl"
  }
  $opEnv = Get-OperatorEnvPath
  if (-not (Test-OperatorDuitkuSecrets -EnvPath $opEnv)) {
    Write-Host "BLOCKED: DUITKU_MERCHANT_CODE/KEY not in operator env (.env.staging.duitku or .env.staging)" -ForegroundColor Red
    $template = Join-Path $RepoRoot ".env.staging.duitku.example"
    if (-not (Test-Path $template)) {
      Write-ModeBEnvTemplate -Path $template
      Write-Host "Created template: .env.staging.duitku.example (copy to .env.staging.duitku, fill secrets, never commit)" -ForegroundColor Yellow
    }
    exit 1
  }
  Write-Host "PASS operator Duitku secrets present (values not logged)" -ForegroundColor Green
  exit 0
}

$opEnvPath = Get-OperatorEnvPath
if (-not (Test-OperatorDuitkuSecrets -EnvPath $opEnvPath)) {
  Write-Host "BLOCKED: missing Duitku sandbox credentials" -ForegroundColor Red
  exit 1
}

Import-StagingSupabaseEnv -RepoRoot $RepoRoot
$stagingUrl = Get-StagingSupabaseCredential "STAGING_SUPABASE_URL"
$stagingAnon = Get-StagingSupabaseCredential "STAGING_SUPABASE_ANON_KEY"
$stagingSr = Get-StagingSupabaseCredential "STAGING_SUPABASE_SERVICE_ROLE_KEY"

if ($Mode -in @("apply", "full")) {
  Write-Host "`nApplying Mode B to EC2..." -ForegroundColor Cyan
  $deployEnv = Join-Path $env:TEMP "vibenovel-mode-b-deploy.env"
  $basePath = Join-Path $RepoRoot ".env.staging"
  if (-not (Test-Path $basePath)) { throw ".env.staging missing for base Supabase vars" }
  $merged = Get-Content $basePath | Where-Object {
    $_ -notmatch '^\s*#' -and $_ -notmatch 'DUITKU_' -and $_ -notmatch '^\s*(CREDIT_TOPUP_ENABLED|PAYMENT_PROVIDER|PAYMENT_PROVIDER_MOCK|PAYMENT_PROVIDER_MOCK_MODE)='
  }
  $duitkuLines = Get-Content $opEnvPath | Where-Object {
    $_ -match '^\s*#' -eq $false -and $_ -match '^\s*[A-Za-z_][A-Za-z0-9_]*='
  }
  $modeBOverrides = [ordered]@{
    CREDIT_TOPUP_ENABLED = "true"
    PAYMENT_PROVIDER = "duitku"
    PAYMENT_PROVIDER_MOCK = "false"
    PAYMENT_PROVIDER_MOCK_MODE = "success"
    DUITKU_ENV = "sandbox"
    DUITKU_CALLBACK_URL = $DuitkuCallbackUrl
    DUITKU_RETURN_URL = "$WebBaseUrl/credits/topup/return"
  }
  foreach ($line in $duitkuLines) {
    if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
      $modeBOverrides[$Matches[1]] = $Matches[2].Trim()
    }
  }
  $finalLines = New-Object System.Collections.Generic.List[string]
  foreach ($line in $merged) {
    if (-not [string]::IsNullOrWhiteSpace($line)) { $finalLines.Add($line.TrimEnd()) | Out-Null }
  }
  $finalLines.Add("") | Out-Null
  foreach ($key in $modeBOverrides.Keys) {
    $finalLines.Add("$key=$($modeBOverrides[$key])") | Out-Null
  }
  Set-Content -Path $deployEnv -Value ($finalLines -join "`n")
  try {
    Invoke-Ec2ModeBDeploy -LocalEnvPath $deployEnv
  } finally {
    Remove-Item $deployEnv -ErrorAction SilentlyContinue
  }
  $healthB = Get-ApiHealth
  if (-not $healthB -or $healthB.data.env.creditTopupEnabled -ne $true -or $healthB.data.env.paymentProvider -ne "duitku") {
    Write-Host "FAIL Mode B health flags" -ForegroundColor Red
    exit 1
  }
  if (-not $healthB.data.env.hasDuitkuMerchantCode -or -not $healthB.data.env.hasDuitkuMerchantKey) {
    Write-Host "FAIL Mode B missing Duitku merchant credentials on API (hasCode/hasKey false)" -ForegroundColor Red
    exit 1
  }
  Write-Host "PASS Mode B deployed (flags only, hasDuitkuCode/Key=true)" -ForegroundColor Green
}

if ($Mode -in @("smoke", "full")) {
  if (-not $stagingUrl -or -not $stagingAnon -or -not $stagingSr) {
    Write-Host "BLOCKED: STAGING_SUPABASE_* missing for smoke" -ForegroundColor Red
    exit 1
  }
  Write-Host "`nDuitku smoke against AWS staging..." -ForegroundColor Cyan
  $duitkuArgs = @{
    ApiBaseUrl = $ApiBaseUrl
    SupabaseUrl = $stagingUrl
    SupabaseAnonKey = $stagingAnon
    TestEmail = $TestEmail
    TestPassword = $TestPassword
    StagingMode = $true
  }
  if ($LiveCreate) { $duitkuArgs.LiveCreate = $true }
  if ($ExpectCallback) { $duitkuArgs.ExpectCallback = $true }
  & (Join-Path $PSScriptRoot "sprint10-duitku-smoke-api.ps1") @duitkuArgs
  if ($LASTEXITCODE -ne 0) { exit 1 }
  if ($LiveCreate -and -not $ExpectCallback) {
    $handoffPath = Join-Path $RepoRoot ".duitku-last-livecreate.json"
    if (Test-Path $handoffPath) {
      $handoff = Get-Content $handoffPath -Raw | ConvertFrom-Json
      Write-Host "`nLiveCreate handoff: orderId=$($handoff.orderId)" -ForegroundColor Yellow
      Write-Host "Next: complete sandbox payment in Duitku UI, then:" -ForegroundColor Yellow
      Write-Host "  npm run operator:aws:duitku:gate -- -Mode smoke -ExpectCallback -SkipRollback -TestEmail $TestEmail" -ForegroundColor Yellow
      if ($handoff.paymentUrl) {
        Write-Host "Opening paymentUrl in default browser..." -ForegroundColor Cyan
        Start-Process $handoff.paymentUrl
      }
    }
  }
}

if ($Mode -in @("rollback", "full") -and -not $SkipRollback) {
  Write-Host "`nRollback Mode A safe..." -ForegroundColor Cyan
  $basePath = Join-Path $RepoRoot ".env.staging"
  Invoke-Ec2ModeARollback -BaseEnvPath $basePath
  $healthA = Get-ApiHealth
  if (-not $healthA -or $healthA.data.env.creditTopupEnabled -ne $false -or $healthA.data.env.paymentProviderMock -ne $true) {
    Write-Host "FAIL Mode A rollback health" -ForegroundColor Red
    exit 1
  }
  Write-Host "PASS Mode A rollback" -ForegroundColor Green
}

Write-Host "`nCloudflare fallback health..." -ForegroundColor Cyan
$cf = Invoke-RestMethod -Uri "https://vibenovel-api-staging.moxsenna.workers.dev/api/health" -TimeoutSec 20
if (-not $cf.ok) { throw "CF health failed" }
Write-Host "PASS Cloudflare Worker fallback" -ForegroundColor Green

Write-Host "`nTask 10.13b gate step complete" -ForegroundColor Green
exit 0