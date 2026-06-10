<#
.SYNOPSIS
  Task 10.23a — Production infra unblock preflight (AWS/EC2/DNS/Pages).

.DESCRIPTION
  Domain model:
    narraza.web.id      = homepage / landing (not dashboard)
    app.narraza.web.id  = app / dashboard (Pages)
    api.narraza.web.id  = API (EC2 + Caddy)

  Does NOT provision EC2 or edit DNS without valid AWS credentials.
  Does NOT enable payment or apply migration 00010.

.EXAMPLE
  npm run operator:production:infra:unblock
#>
[CmdletBinding()]
param(
  [string]$StagingEc2Ip = "13.212.245.32",
  [string]$StagingProjectRef = "jdxyhrnibmmwlbtbokqo",
  [string]$HomepageHost = "narraza.web.id",
  [string]$AppHost = "app.narraza.web.id",
  [string]$ApiHost = "api.narraza.web.id",
  [string]$PagesProject = "narraza-web-production",
  [string]$PagesPreviewUrl = "https://03f5654d.narraza-web-production.pages.dev",
  [string]$AwsCliPath = "C:\Program Files\Amazon\AWSCLIV2\aws.exe"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$RepoRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot "lib\staging-smoke-common.ps1")

$Results = [ordered]@{}
$Blockers = [System.Collections.Generic.List[string]]::new()

function Set-Result {
  param([string]$Key, [string]$Value)
  $Results[$Key] = $Value
}

function Add-Blocker {
  param([string]$Message)
  $Blockers.Add($Message) | Out-Null
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

function Test-DnsA {
  param([string]$HostName)
  try {
    $resolved = @(Resolve-DnsName $HostName -Type A -ErrorAction Stop)
    $ips = $resolved | ForEach-Object { $_.IPAddress } | Select-Object -Unique
    return $true, ($ips -join ', ')
  } catch {
    return $false, "NXDOMAIN or no A record"
  }
}

Write-Host "Task 10.23a - Production infra unblock preflight" -ForegroundColor Cyan
Write-Host "Homepage: https://$HomepageHost"
Write-Host "App:      https://$AppHost"
Write-Host "API:      https://$ApiHost"
Write-Host "Forbidden staging EC2: $StagingEc2Ip"
Write-Host "Forbidden staging Supabase: $StagingProjectRef"

# AWS credentials
Write-Host "`n[1/7] AWS credentials..." -ForegroundColor Cyan
$awsOk = $false
if (Test-Path $AwsCliPath) {
  try {
    $identity = & $AwsCliPath sts get-caller-identity --output json 2>&1 | Out-String
    if ($LASTEXITCODE -eq 0) {
      $parsed = $identity | ConvertFrom-Json
      $acct = $parsed.Account
      $arn = $parsed.Arn
      if ($arn -match ':(\d{12}):') { $acct = $Matches[1] }
      $sanitizedArn = if ($arn -match 'arn:aws:(\w+)::(\d{12}):(.+)') {
        "arn:aws:$($Matches[1])::$($Matches[2]):[redacted]"
      } else { "[redacted-arn]" }
      Set-Result "aws_credentials" "PASS"
      Set-Result "aws_account" $acct
      Set-Result "aws_arn" $sanitizedArn
      $awsOk = $true
      Write-Host "PASS AWS credentials (account $acct)" -ForegroundColor Green
    } else {
      throw $identity
    }
  } catch {
    Set-Result "aws_credentials" "BLOCKED - NoCredentials"
    Add-Blocker "AWS credentials missing - operator: aws configure or aws login (do not paste keys in chat)"
    Write-Host "BLOCKED: AWS NoCredentials" -ForegroundColor Red
  }
} else {
  Set-Result "aws_credentials" "BLOCKED - AWS CLI not found"
  Add-Blocker "AWS CLI not installed at $AwsCliPath"
  Write-Host "BLOCKED: AWS CLI not found" -ForegroundColor Red
}

# .env.production Mode A
Write-Host "`n[2/7] .env.production Mode A..." -ForegroundColor Cyan
$envPath = Join-Path $RepoRoot ".env.production"
if (-not (Test-Path $envPath)) {
  Set-Result "env_production" "BLOCKED - missing"
  Add-Blocker ".env.production missing on operator machine"
  Write-Host "BLOCKED: missing .env.production" -ForegroundColor Red
} else {
  Import-DotEnvFile -Path $envPath
  $ref = Get-ProjectRefFromUrl -Url $env:SUPABASE_URL
  $envIssues = @()
  if ($ref -eq $StagingProjectRef) { $envIssues += "staging supabase ref" }
  if ($env:CREDIT_TOPUP_ENABLED -eq "true") { $envIssues += "CREDIT_TOPUP_ENABLED=true" }
  if ($env:PAYMENT_PROVIDER -eq "duitku") { $envIssues += "PAYMENT_PROVIDER=duitku" }
  if ($env:PAYMENT_PROVIDER_MOCK -eq "false") { $envIssues += "PAYMENT_PROVIDER_MOCK=false" }
  if ($env:AI_GENERATION_ENABLED -eq "true") { $envIssues += "AI_GENERATION_ENABLED=true" }
  if ($env:ALLOWED_ORIGINS -notmatch 'app\.narraza\.web\.id') { $envIssues += "ALLOWED_ORIGINS missing app.narraza.web.id" }
  if ($env:ALLOWED_ORIGINS -notmatch 'narraza\.web\.id') { $envIssues += "ALLOWED_ORIGINS missing narraza.web.id" }
  if ($env:DUITKU_MERCHANT_CODE -or $env:DUITKU_MERCHANT_KEY) { $envIssues += "Duitku vars set" }
  if ($envIssues.Count -gt 0) {
    Set-Result "env_production" "BLOCKED - $($envIssues -join '; ')"
    Add-Blocker ".env.production: $($envIssues -join '; ')"
    Write-Host "BLOCKED: $($envIssues -join '; ')" -ForegroundColor Red
  } else {
    Set-Result "env_production" "PASS ref=$ref"
    Write-Host "PASS .env.production Mode A (ref=$ref)" -ForegroundColor Green
  }
  $gitIgnore = git -C $RepoRoot check-ignore -v .env.production 2>$null
  if ($LASTEXITCODE -eq 0) {
    Set-Result "env_gitignored" "PASS"
    Write-Host "PASS .env.production gitignored" -ForegroundColor Green
  } else {
    Set-Result "env_gitignored" "FAIL"
    Add-Blocker ".env.production not gitignored"
    Write-Host "FAIL .env.production not gitignored" -ForegroundColor Red
  }
}

# DNS
Write-Host "`n[3/7] DNS..." -ForegroundColor Cyan
foreach ($pair in @(
    @{ Name = "api"; Host = $ApiHost },
    @{ Name = "app"; Host = $AppHost },
    @{ Name = "homepage"; Host = $HomepageHost }
  )) {
  $ok, $detail = Test-DnsA -HostName $pair.Host
  if ($ok) {
    if ($pair.Name -eq "api" -and $detail -eq $StagingEc2Ip) {
      Set-Result "dns_$($pair.Name)" "NO-GO - points to staging EC2 $StagingEc2Ip"
      Add-Blocker "$($pair.Host) resolves to forbidden staging EC2"
      Write-Host "NO-GO: $($pair.Host) -> $detail (staging EC2)" -ForegroundColor Red
    } else {
      Set-Result "dns_$($pair.Name)" "PASS -> $detail"
      Write-Host "PASS $($pair.Host) -> $detail" -ForegroundColor Green
    }
  } else {
    Set-Result "dns_$($pair.Name)" "PENDING - $detail"
    if ($pair.Name -eq "api") {
      Add-Blocker "DNS A record required: $ApiHost -> production EIP (not $StagingEc2Ip)"
    } elseif ($pair.Name -eq "app") {
      Add-Blocker "DNS/custom domain pending: $AppHost -> Cloudflare Pages ($PagesProject)"
    } else {
      Set-Result "dns_homepage_plan" "Option A - placeholder/redirect until landing built"
    }
    Write-Host "PENDING $($pair.Host) - $detail" -ForegroundColor Yellow
  }
}

# EC2 / EIP (only if AWS creds)
Write-Host "`n[4/7] EC2/EIP..." -ForegroundColor Cyan
if (-not $awsOk) {
  Set-Result "ec2_eip" "BLOCKED - AWS credentials required"
  Add-Blocker "Cannot provision production EC2+EIP without AWS credentials"
  Write-Host "BLOCKED: EC2 provision requires AWS credentials" -ForegroundColor Red
} else {
  Set-Result "ec2_eip" "PENDING - operator must provision narraza-production-api"
  Add-Blocker "Production EC2+EIP not yet provisioned (run after AWS creds validated)"
  Write-Host "PENDING: provision EC2 + EIP manually or via AWS CLI" -ForegroundColor Yellow
}

# Pages
Write-Host "`n[5/7] Cloudflare Pages..." -ForegroundColor Cyan
Set-Result "pages_project" $PagesProject
Set-Result "pages_preview" $PagesPreviewUrl
Set-Result "pages_app_domain" "PENDING - attach $AppHost in Cloudflare Dashboard"
Set-Result "pages_homepage" "Option A - $HomepageHost placeholder/redirect (not dashboard)"
Add-Blocker "Attach app custom domain: Cloudflare Dashboard > Pages > $PagesProject > Custom domains > $AppHost"
Write-Host "PENDING: attach $AppHost to $PagesProject (Dashboard - wrangler OAuth zone read only)" -ForegroundColor Yellow
try {
  $preview = Invoke-WebRequest -Uri $PagesPreviewUrl -UseBasicParsing -TimeoutSec 20
  if ($preview.StatusCode -eq 200) {
    Set-Result "pages_preview_http" "PASS 200"
    Write-Host "PASS Pages preview HTTP 200" -ForegroundColor Green
  }
} catch {
  Set-Result "pages_preview_http" "WARN $($_.Exception.Message)"
  Write-Host "WARN Pages preview: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Production API health
Write-Host "`n[6/7] Production API health..." -ForegroundColor Cyan
try {
  $prod = Invoke-RestMethod -Uri "https://$ApiHost/api/health" -TimeoutSec 15
  if ($prod.data.env.creditTopupEnabled -ne $false) { throw "payment on" }
  Set-Result "api_health" "PASS Mode A"
  Write-Host "PASS production API health" -ForegroundColor Green
} catch {
  Set-Result "api_health" "PENDING - $($_.Exception.Message)"
  Write-Host "PENDING: production API not live" -ForegroundColor Yellow
}

# Staging regression
Write-Host "`n[7/7] Staging regression..." -ForegroundColor Cyan
try {
  $stg = Invoke-RestMethod -Uri "https://api-staging.narraza.web.id/api/health" -TimeoutSec 15
  if ($stg.data.env.creditTopupEnabled -ne $false) { throw "staging payment on" }
  Set-Result "staging_regression" "PASS Mode A"
  Write-Host "PASS staging Mode A" -ForegroundColor Green
} catch {
  Set-Result "staging_regression" "FAIL $($_.Exception.Message)"
  Write-Host "FAIL staging regression: $($_.Exception.Message)" -ForegroundColor Red
}

# Verdict
Write-Host "`n--- Task 10.23a summary ---" -ForegroundColor Cyan
foreach ($k in $Results.Keys) {
  Write-Host ("{0}: {1}" -f $k, $Results[$k])
}
if ($Blockers.Count -gt 0) {
  Write-Host "`nRemaining blockers:" -ForegroundColor Yellow
  $i = 1
  foreach ($b in $Blockers) {
    Write-Host ("  {0}. {1}" -f $i, $b)
    $i++
  }
}

if (-not $awsOk) {
  Write-Host "`nStatus: PARTIAL GO (AWS BLOCKED)" -ForegroundColor Yellow
  Write-Host "Next: aws configure -> provision EC2+EIP -> DNS api -> operator:production:aws:deploy" -ForegroundColor Yellow
  exit 1
}

$apiDns = $Results["dns_api"]
if ($apiDns -notmatch '^PASS') {
  Write-Host "`nStatus: PARTIAL GO (DNS/EC2 pending)" -ForegroundColor Yellow
  exit 1
}

Write-Host "`nStatus: PARTIAL GO - infra preflight env OK; EC2/DNS/Pages custom domain pending" -ForegroundColor Yellow
exit 0