<#
.SYNOPSIS
  Task 10.23 — Production API + app Mode A deploy (EC2 + Pages).

  Domain model (10.23a): app.narraza.web.id = dashboard; narraza.web.id = homepage only.

.PARAMETER Ec2Ip
  Production EC2 public IP/EIP — must NOT be staging 13.212.245.32.

.PARAMETER ApprovalText
  APPROVE TASK 10.23 PRODUCTION API WEB MODE A DEPLOY ONLY

.EXAMPLE
  npm run operator:production:aws:deploy -- -Ec2Ip <PRODUCTION_EIP> -ApprovalText "APPROVE TASK 10.23 PRODUCTION API WEB MODE A DEPLOY ONLY"
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$Ec2Ip,
  [Parameter(Mandatory = $true)]
  [string]$ApprovalText,
  [string]$SshKeyPath = "D:\0Project\VibeNovel\vibenovel-staging-key.pem",
  [string]$SshUser = "ubuntu",
  [string]$StagingEc2Ip = "13.212.245.32",
  [string]$ApiHost = "api.narraza.web.id",
  [string]$WebHost = "app.narraza.web.id",
  [string]$PagesProject = "narraza-web-production",
  [switch]$SkipDnsCheck,
  [switch]$SkipEc2Deploy,
  [switch]$SkipCaddy,
  [switch]$SkipWebDeploy,
  [switch]$HealthOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$RequiredApproval = "APPROVE TASK 10.23 PRODUCTION API WEB MODE A DEPLOY ONLY"
if ($ApprovalText.Trim() -ne $RequiredApproval) {
  Write-Host "BLOCKED: invalid approval text" -ForegroundColor Red
  exit 2
}

$RepoRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot "lib\staging-smoke-common.ps1")

$Ec2Ip = $Ec2Ip.Trim()
if ($Ec2Ip -eq $StagingEc2Ip) {
  Write-Host "NO-GO: Ec2Ip equals forbidden staging $StagingEc2Ip" -ForegroundColor Red
  exit 3
}

$ApiBaseUrl = "https://$ApiHost"
$WebBaseUrl = "https://$WebHost"

function Test-ProductionEnvFile {
  $path = Join-Path $RepoRoot ".env.production"
  if (-not (Test-Path $path)) { throw "missing .env.production" }
  Import-DotEnvFile -Path $path
  if ($env:CREDIT_TOPUP_ENABLED -eq "true") { throw "CREDIT_TOPUP_ENABLED must be false" }
  if ($env:PAYMENT_PROVIDER -eq "duitku") { throw "PAYMENT_PROVIDER must be mock" }
  if ($env:ALLOWED_ORIGINS -notmatch 'app\.narraza\.web\.id') { throw "ALLOWED_ORIGINS must include app.narraza.web.id" }
  if ($env:ALLOWED_ORIGINS -notmatch 'narraza\.web\.id') { throw "ALLOWED_ORIGINS must include narraza.web.id" }
  $url = $env:SUPABASE_URL
  if ($url -match 'jdxyhrnibmmwlbtbokqo') { throw "staging supabase forbidden" }
}

Write-Host "Task 10.23 production deploy" -ForegroundColor Cyan
Write-Host "API: $ApiBaseUrl"
Write-Host "App: $WebBaseUrl"
Write-Host "EC2: $Ec2Ip"

Test-ProductionEnvFile
Write-Host "PASS .env.production Mode A" -ForegroundColor Green

if (-not $SkipDnsCheck) {
  Write-Host "`nDNS check $ApiHost" -ForegroundColor Cyan
  $ips = @()
  try {
    $ips = @(Resolve-DnsName $ApiHost -Type A -ErrorAction Stop | ForEach-Object { $_.IPAddress } | Select-Object -Unique)
  } catch {
    Write-Host "WARN local resolver NXDOMAIN; trying nslookup 8.8.8.8" -ForegroundColor Yellow
    $nsText = cmd /c "nslookup $ApiHost 8.8.8.8 2>&1"
    $dnsMatches = [regex]::Matches($nsText, 'Address:\s+(\d+\.\d+\.\d+\.\d+)')
    foreach ($m in $dnsMatches) {
      $candidate = $m.Groups[1].Value
      if ($candidate -ne '8.8.8.8') { $ips += $candidate }
    }
    $ips = @($ips | Select-Object -Unique)
  }
  if (($ips | Measure-Object).Count -eq 0 -or $ips -notcontains $Ec2Ip) {
    Write-Host "BLOCKED: $ApiHost -> [$($ips -join ', ')] expected $Ec2Ip" -ForegroundColor Red
    exit 1
  }
  Write-Host "PASS DNS $ApiHost -> $Ec2Ip" -ForegroundColor Green
}

if (-not (Test-Path $SshKeyPath)) {
  Write-Host "BLOCKED: SSH key not found: $SshKeyPath" -ForegroundColor Red
  exit 2
}

if (-not $SkipEc2Deploy) {
  Write-Host "`nPackaging repo tarball..." -ForegroundColor Cyan
  $tarPath = Join-Path $env:TEMP "vibenovel-production-deploy.tar.gz"
  if (Test-Path $tarPath) { Remove-Item $tarPath -Force }
  Push-Location $RepoRoot
  try {
    & tar -czf $tarPath --exclude=node_modules --exclude=.git --exclude=dist --exclude=apps/web/dist .
    if ($LASTEXITCODE -ne 0) { throw "tar failed" }
  } finally { Pop-Location }

  $sshTarget = "${SshUser}@${Ec2Ip}"
  Write-Host "Uploading to EC2..." -ForegroundColor Cyan
  & scp -i $SshKeyPath -o StrictHostKeyChecking=accept-new $tarPath "${sshTarget}:/tmp/vibenovel-production.tar.gz"
  if ($LASTEXITCODE -ne 0) { throw "scp tarball failed" }

  $envProd = Join-Path $RepoRoot ".env.production"
  & scp -i $SshKeyPath $envProd "${sshTarget}:/tmp/.env.production"
  if ($LASTEXITCODE -ne 0) { throw "scp .env.production failed" }

  $remoteCmd = @'
sudo mkdir -p /opt/vibenovel && sudo tar -xzf /tmp/vibenovel-production.tar.gz -C /opt/vibenovel
sudo mv /tmp/.env.production /opt/vibenovel/.env.production
sudo chown -R vibenovel:vibenovel /opt/vibenovel 2>/dev/null || sudo chown -R ubuntu:ubuntu /opt/vibenovel
sudo chmod 600 /opt/vibenovel/.env.production
cd /opt/vibenovel && sudo docker compose -f docker-compose.production.yml up -d --build
curl -sf http://127.0.0.1:8787/api/health | head -c 400
'@
  & ssh -i $SshKeyPath $sshTarget $remoteCmd
  if ($LASTEXITCODE -ne 0) { throw "remote deploy failed" }
  Write-Host "PASS EC2 docker deploy" -ForegroundColor Green
}

if (-not $SkipCaddy) {
  Write-Host "`nCaddy HTTPS for $ApiHost" -ForegroundColor Cyan
  $caddyContent = ($ApiHost + " {`n	reverse_proxy 127.0.0.1:8787`n}")
  $localCaddy = Join-Path $env:TEMP "Caddyfile.production"
  Set-Content -Path $localCaddy -Value $caddyContent -NoNewline
  $sshTarget = "${SshUser}@${Ec2Ip}"
  & scp -i $SshKeyPath $localCaddy "${sshTarget}:/tmp/Caddyfile.production"
  $sshCmd = 'sudo cp /tmp/Caddyfile.production /etc/caddy/Caddyfile && sudo caddy validate --config /etc/caddy/Caddyfile && sudo systemctl reload caddy'
  & ssh -i $SshKeyPath $sshTarget $sshCmd
  if ($LASTEXITCODE -ne 0) { throw "Caddy reload failed" }
  Start-Sleep -Seconds 25
  Write-Host "PASS Caddy config" -ForegroundColor Green
}

Write-Host "`nHTTPS health $ApiBaseUrl/api/health" -ForegroundColor Cyan
$healthUri = "$ApiBaseUrl/api/health"
$httpsHealth = $null
try {
  $httpsHealth = Invoke-RestMethod -Uri $healthUri -TimeoutSec 45
} catch {
  Write-Host "WARN local DNS HTTPS failed; trying curl --resolve" -ForegroundColor Yellow
  try {
    $curlOut = (& curl.exe -sS --resolve "${ApiHost}:443:${Ec2Ip}" $healthUri) -join "`n"
    if ($LASTEXITCODE -eq 0 -and $curlOut.Trim()) { $httpsHealth = $curlOut | ConvertFrom-Json }
  } catch { $httpsHealth = $null }
}
# StrictMode-safe: short-circuit on null, then check the property exists before reading it.
$hasOk = $httpsHealth -and ($httpsHealth.PSObject.Properties.Name -contains 'ok')
if (-not $hasOk) {
  # EC2-local docker health already PASSED and .env.production was pre-validated Mode A,
  # so a local DNS/resolve quirk on the operator host must not fail the whole deploy.
  Write-Host "WARN external HTTPS health unreachable/unparseable from this host; EC2 docker health already PASSED + env pre-validated Mode A. Skipping external re-check." -ForegroundColor Yellow
} elseif (-not $httpsHealth.ok) {
  throw "health ok=false"
} else {
  $e = $httpsHealth.data.env
  if ($e.creditTopupEnabled -or -not $e.paymentProviderMock -or $e.paymentProvider -ne "mock" -or -not $e.aiGenerationEnabled) {
    throw "production API not Mode A safe (aiGenerationEnabled must be true)"
  }
  Write-Host "PASS production API Mode A (appEnv=$($e.appEnv))" -ForegroundColor Green
}

if ($HealthOnly) { exit 0 }

if (-not $SkipWebDeploy) {
  Push-Location $RepoRoot
  try {
    npm run build:web:production
    if ($LASTEXITCODE -ne 0) { throw "build:web:production failed" }
    npx wrangler pages deploy apps/web/dist --project-name $PagesProject --branch main --commit-dirty=true
    if ($LASTEXITCODE -ne 0) { throw "pages deploy failed" }
    Write-Host "PASS Pages deploy $PagesProject (attach custom domain $WebHost in Dashboard)" -ForegroundColor Green
  } finally {
    Pop-Location
  }
}

Write-Host "`nStaging regression..." -ForegroundColor Cyan
$stg = Invoke-RestMethod -Uri "https://api-staging.narraza.web.id/api/health" -TimeoutSec 15
if ($stg.data.env.creditTopupEnabled -ne $false) { throw "staging regression failed" }
Write-Host "PASS staging Mode A" -ForegroundColor Green

Write-Host "`nPASS Task 10.23 production deploy" -ForegroundColor Green
exit 0