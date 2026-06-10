<#
.SYNOPSIS
  Task 11.6 — AWS HTTPS domain + web rebuild + full staging smoke.

.PARAMETER Domain
  Apex domain, e.g. vibenovel.com → api-staging.vibenovel.com

.PARAMETER ApiSubdomain
  Default: api-staging

.EXAMPLE
  npm run operator:aws:https:gate -- -Domain vibenovel.com -TestEmail staging-smoke@vibenovel.test
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$Domain,
  [string]$ApiSubdomain = "api-staging",
  [string]$Ec2Ip = "13.212.245.32",
  [string]$SshKeyPath = "D:\0Project\VibeNovel\vibenovel-staging-key.pem",
  [string]$SshUser = "ubuntu",
  [string]$TestEmail = "staging-smoke@vibenovel.test",
  [string]$TestPassword = "VibeNovel-Staging-Smoke-Test!",
  [switch]$SkipDnsCheck,
  [switch]$SkipCaddyDeploy,
  [switch]$SkipWebDeploy,
  [switch]$SkipSmoke,
  [switch]$HealthOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$RepoRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot "lib\staging-smoke-common.ps1")

$Domain = $Domain.Trim().TrimEnd('.').ToLowerInvariant()
$ApiHost = "$ApiSubdomain.$Domain"
$ApiBaseUrl = "https://$ApiHost"
$WebBaseUrl = Resolve-StagingWebBaseUrl

function Test-Ec2ApiPreflight {
  param(
    [string]$Ec2Ip,
    [string]$ApiBaseUrl,
    [string]$SshKeyPath,
    [string]$SshUser
  )
  try {
    $httpHealth = Invoke-RestMethod -Uri "http://$Ec2Ip/api/health" -TimeoutSec 15
    if ($httpHealth.ok) {
      Write-Host "PASS preflight http://$Ec2Ip/api/health" -ForegroundColor Green
      return $true
    }
  } catch { }

  try {
    $httpsHealth = Invoke-RestMethod -Uri "$ApiBaseUrl/api/health" -TimeoutSec 30
    if ($httpsHealth.ok) {
      Write-Host "PASS preflight $ApiBaseUrl/api/health" -ForegroundColor Green
      return $true
    }
  } catch { }

  if (Test-Path $SshKeyPath) {
    $sshTarget = "${SshUser}@${Ec2Ip}"
    $localHealth = & ssh -i $SshKeyPath -o StrictHostKeyChecking=accept-new $sshTarget `
      "curl -sf http://127.0.0.1:8787/api/health"
    if ($LASTEXITCODE -eq 0 -and $localHealth -match '"ok"\s*:\s*true') {
      Write-Host "PASS preflight docker 127.0.0.1:8787/api/health (SSH)" -ForegroundColor Green
      return $true
    }
  }

  return $false
}

Write-Host "Task 11.6 AWS HTTPS + web gate" -ForegroundColor Cyan
Write-Host "API host: $ApiHost"
Write-Host "EC2 IP:   $Ec2Ip"

# --- DNS ---
if (-not $SkipDnsCheck) {
  Write-Host "`nDNS check: $ApiHost" -ForegroundColor Cyan
  try {
    $resolved = @(Resolve-DnsName $ApiHost -Type A -ErrorAction Stop)
    $ips = $resolved | ForEach-Object { $_.IPAddress } | Select-Object -Unique
    if ($ips -notcontains $Ec2Ip) {
      Write-Host "BLOCKED: $ApiHost resolves to [$($ips -join ', ')] not $Ec2Ip" -ForegroundColor Red
      Write-Host "Create A record: $ApiSubdomain -> $Ec2Ip (DNS-only recommended first)" -ForegroundColor Yellow
      exit 1
    }
    Write-Host "PASS DNS $ApiHost -> $Ec2Ip" -ForegroundColor Green
  } catch {
    Write-Host "BLOCKED: $ApiHost has no A record yet" -ForegroundColor Red
    Write-Host "Create A record in DNS, wait propagation, retry." -ForegroundColor Yellow
    exit 1
  }
}

if (-not (Test-Path $SshKeyPath)) {
  Write-Host "BLOCKED: SSH key not found: $SshKeyPath" -ForegroundColor Red
  exit 1
}

if (-not (Test-Ec2ApiPreflight -Ec2Ip $Ec2Ip -ApiBaseUrl $ApiBaseUrl -SshKeyPath $SshKeyPath -SshUser $SshUser)) {
  Write-Host "FAIL preflight API health - fix EC2 Docker/Caddy before continuing" -ForegroundColor Red
  exit 1
}

# --- Caddy HTTPS on EC2 ---
if (-not $SkipCaddyDeploy) {
  Write-Host "`nDeploy Caddy HTTPS config..." -ForegroundColor Cyan
  $caddyContent = ($ApiHost + " {`n	reverse_proxy 127.0.0.1:8787`n}")
  $localCaddy = Join-Path $env:TEMP ("Caddyfile." + ($ApiHost -replace '[^\w.-]', '_'))
  Set-Content -Path $localCaddy -Value $caddyContent -NoNewline
  $sshTarget = "${SshUser}@${Ec2Ip}"
  & scp -i $SshKeyPath -o StrictHostKeyChecking=accept-new $localCaddy "${sshTarget}:/tmp/Caddyfile.staging"
  if ($LASTEXITCODE -ne 0) { throw "scp Caddyfile failed" }
  $sshCmd = 'sudo cp /tmp/Caddyfile.staging /etc/caddy/Caddyfile && sudo caddy validate --config /etc/caddy/Caddyfile && sudo systemctl reload caddy'
  & ssh -i $SshKeyPath $sshTarget $sshCmd
  if ($LASTEXITCODE -ne 0) {
    Write-Host "FAIL Caddy reload - check: sudo journalctl -u caddy -n 100" -ForegroundColor Red
    exit 1
  }
  Remove-Item $localCaddy -ErrorAction SilentlyContinue
  Write-Host "PASS Caddy HTTPS config for $ApiHost" -ForegroundColor Green
  # Let's Encrypt issuance can take 10-20s after first reload
  Start-Sleep -Seconds 20
}

# --- HTTPS health ---
Write-Host "`nHTTPS health: $ApiBaseUrl/api/health" -ForegroundColor Cyan
try {
  $httpsHealth = Invoke-RestMethod -Uri "$ApiBaseUrl/api/health" -TimeoutSec 30
  if (-not $httpsHealth.ok) { throw "ok=false" }
  $env = $httpsHealth.data.env
  if ($env.creditTopupEnabled -or -not $env.paymentProviderMock -or $env.aiGenerationEnabled) {
    throw "Mode A flags unsafe"
  }
  Write-Host "PASS HTTPS health (appEnv=$($env.appEnv))" -ForegroundColor Green
} catch {
  Write-Host "FAIL HTTPS health: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Check DNS, SG 443, UFW, Caddy logs, Docker local health." -ForegroundColor Yellow
  exit 1
}

if ($HealthOnly) {
  Write-Host "PASS health-only gate" -ForegroundColor Green
  exit 0
}

Import-StagingSupabaseEnv -RepoRoot $RepoRoot
$stagingUrl = Get-StagingSupabaseCredential 'STAGING_SUPABASE_URL'
$stagingAnon = Get-StagingSupabaseCredential 'STAGING_SUPABASE_ANON_KEY'

# --- AWS HTTPS smoke ---
if (-not $SkipSmoke) {
  Write-Host "`nAWS HTTPS smoke..." -ForegroundColor Cyan
  & (Join-Path $PSScriptRoot "smoke-staging.ps1") `
    -TargetName "aws-staging-https" `
    -ApiBaseUrl $ApiBaseUrl `
    -WebBaseUrl $WebBaseUrl `
    -IncludeApiMode `
    -TestEmail $TestEmail `
    -TestPassword $TestPassword
  if ($LASTEXITCODE -ne 0) { exit 1 }
}

# --- Web rebuild to AWS API ---
if (-not $SkipWebDeploy) {
  if (-not $stagingUrl -or -not $stagingAnon) {
    Write-Host "BLOCKED: need STAGING_SUPABASE_* or .env.staging for web build" -ForegroundColor Red
    exit 1
  }
  Write-Host "`nWeb rebuild + deploy (VITE_API_URL=$ApiBaseUrl)..." -ForegroundColor Cyan
  $env:VITE_API_URL = $ApiBaseUrl
  $env:VITE_SUPABASE_URL = $stagingUrl
  $env:VITE_SUPABASE_ANON_KEY = $stagingAnon
  $env:VITE_USE_MOCKS = "false"
  Push-Location $RepoRoot
  try {
    npm run build:web
    if ($LASTEXITCODE -ne 0) { throw "build:web failed" }
    npx wrangler pages deploy apps/web/dist --project-name vibenovel-web-staging --branch main --commit-dirty=true
    if ($LASTEXITCODE -ne 0) { throw "pages deploy failed" }
    Write-Host "PASS web staging deploy -> AWS API" -ForegroundColor Green
  } finally {
    Pop-Location
    Remove-Item Env:VITE_SUPABASE_URL -ErrorAction SilentlyContinue
    Remove-Item Env:VITE_SUPABASE_ANON_KEY -ErrorAction SilentlyContinue
    Remove-Item Env:VITE_API_URL -ErrorAction SilentlyContinue
    Remove-Item Env:VITE_USE_MOCKS -ErrorAction SilentlyContinue
  }

  Write-Host "`nWeb-to-AWS smoke..." -ForegroundColor Cyan
  & (Join-Path $PSScriptRoot "smoke-staging.ps1") `
    -TargetName "web-to-aws-staging" `
    -ApiBaseUrl $ApiBaseUrl `
    -WebBaseUrl $WebBaseUrl `
    -IncludeApiMode `
    -TestEmail $TestEmail `
    -TestPassword $TestPassword
  if ($LASTEXITCODE -ne 0) { exit 1 }
}

# --- Cloudflare API regression ---
Write-Host "`nCloudflare API regression..." -ForegroundColor Cyan
$cfApi = Resolve-StagingApiBaseUrl
& (Join-Path $PSScriptRoot "smoke-staging.ps1") `
  -TargetName "cloudflare-staging-regression" `
  -ApiBaseUrl $cfApi `
  -WebBaseUrl $WebBaseUrl `
  -IncludeApiMode `
  -TestEmail $TestEmail `
  -TestPassword $TestPassword
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host "`nTask 11.6 gate complete - GO FULL AWS web-to-AWS staging" -ForegroundColor Green
exit 0