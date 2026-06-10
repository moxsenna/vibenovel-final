<#
.SYNOPSIS
  Sync local .env.production to production EC2 and restart API (env-only, no full tarball).

.DESCRIPTION
  Copies repo-root .env.production to /opt/vibenovel/.env.production on the production
  API EC2 instance, then runs docker compose restart. Does not deploy app/web tarball.

  Never logs secret values. Health check reports boolean flags only.

.PARAMETER Ec2Ip
  Production EC2 EIP (default 13.251.228.117 per docs/83).

.EXAMPLE
  npm run operator:production:sync-env
#>
[CmdletBinding()]
param(
  [string]$Ec2Ip = "13.251.228.117",
  [string]$SshKeyPath = "D:\0Project\VibeNovel\vibenovel-staging-key.pem",
  [string]$SshUser = "ubuntu",
  [string]$ApiHost = "api.narraza.web.id",
  [string]$StagingEc2Ip = "13.212.245.32"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$RepoRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot "lib\staging-smoke-common.ps1")

$Ec2Ip = $Ec2Ip.Trim()
if ($Ec2Ip -eq $StagingEc2Ip) {
  Write-Host "NO-GO: Ec2Ip equals forbidden staging $StagingEc2Ip" -ForegroundColor Red
  exit 3
}

$envPath = Join-Path $RepoRoot ".env.production"
if (-not (Test-Path $envPath)) {
  Write-Host "BLOCKED: missing .env.production (copy from .env.production.example)" -ForegroundColor Red
  exit 2
}

Import-DotEnvFile -Path $envPath
if ($env:CREDIT_TOPUP_ENABLED -eq "true") {
  Write-Host "BLOCKED: CREDIT_TOPUP_ENABLED must be false for this sync" -ForegroundColor Red
  exit 4
}
if ($env:PAYMENT_PROVIDER -eq "duitku" -and $env:PAYMENT_PROVIDER_MOCK -ne "true") {
  Write-Host "BLOCKED: live Duitku payment not allowed via this script" -ForegroundColor Red
  exit 4
}

if (-not (Test-Path $SshKeyPath)) {
  Write-Host "BLOCKED: SSH key not found: $SshKeyPath" -ForegroundColor Red
  exit 2
}

Write-Host "Production env sync -> EC2 $Ec2Ip" -ForegroundColor Cyan
Write-Host "Target: /opt/vibenovel/.env.production" -ForegroundColor Cyan

$sshTarget = "${SshUser}@${Ec2Ip}"
& scp -i $SshKeyPath -o StrictHostKeyChecking=accept-new $envPath "${sshTarget}:/tmp/.env.production"
if ($LASTEXITCODE -ne 0) { throw "scp .env.production failed" }

$remoteCmd = @'
sudo mkdir -p /opt/vibenovel
sudo mv /tmp/.env.production /opt/vibenovel/.env.production
sudo chown vibenovel:vibenovel /opt/vibenovel/.env.production 2>/dev/null || sudo chown ubuntu:ubuntu /opt/vibenovel/.env.production
sudo chmod 600 /opt/vibenovel/.env.production
cd /opt/vibenovel && sudo docker compose -f docker-compose.production.yml up -d --build
echo "--- local health ---"
curl -sf http://127.0.0.1:8787/api/health | head -c 500
'@

& ssh -i $SshKeyPath $sshTarget $remoteCmd
if ($LASTEXITCODE -ne 0) { throw "remote env sync / restart failed" }

Write-Host "`nHTTPS health $ApiHost/api/health" -ForegroundColor Cyan
$healthUri = "https://$ApiHost/api/health"
try {
  $httpsHealth = Invoke-RestMethod -Uri $healthUri -TimeoutSec 45
} catch {
  $curlOut = curl.exe -sS --resolve "${ApiHost}:443:${Ec2Ip}" $healthUri
  if ($LASTEXITCODE -ne 0) { throw "HTTPS health failed: $($_.Exception.Message)" }
  $httpsHealth = $curlOut | ConvertFrom-Json
}

if (-not $httpsHealth.ok) { throw "health ok=false" }
$e = $httpsHealth.data.env
Write-Host "appEnv=$($e.appEnv)" -ForegroundColor Green
Write-Host "aiGenerationEnabled=$($e.aiGenerationEnabled)" -ForegroundColor Green
Write-Host "hasOpenRouterApiKey=$($e.hasOpenRouterApiKey)" -ForegroundColor Green
Write-Host "creditTopupEnabled=$($e.creditTopupEnabled)" -ForegroundColor Green
Write-Host "paymentProvider=$($e.paymentProvider)" -ForegroundColor Green

if ($e.creditTopupEnabled) { throw "creditTopupEnabled must be false" }

Write-Host "`nPASS production env sync + API restart" -ForegroundColor Green
exit 0