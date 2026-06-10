<#
.SYNOPSIS
  Task 10.24 — Deploy production homepage to Cloudflare Pages (narraza-homepage-production).

.PARAMETER SkipDeploy
  Build only; skip wrangler deploy.

.PARAMETER SkipVerify
  Skip post-deploy HTTP verification.
#>
[CmdletBinding()]
param(
  [string]$HomepageHost = "narraza.web.id",
  [string]$AppHost = "app.narraza.web.id",
  [string]$ApiHost = "api.narraza.web.id",
  [string]$StagingApiHost = "api-staging.narraza.web.id",
  [string]$PagesProject = "narraza-homepage-production",
  [switch]$SkipDeploy,
  [switch]$SkipVerify
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$RepoRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot "lib\staging-smoke-common.ps1")

Write-Host "Task 10.24 production homepage deploy" -ForegroundColor Cyan
Write-Host "Homepage: https://$HomepageHost"
Write-Host "App: https://$AppHost (must remain separate)"
Write-Host "Pages: $PagesProject"

& (Join-Path $PSScriptRoot "build-production-homepage.ps1") -RepoRoot $RepoRoot

if (-not $SkipDeploy) {
  Push-Location $RepoRoot
  try {
    $dist = Join-Path $RepoRoot "apps\homepage\dist"
    npx wrangler pages deploy $dist --project-name $PagesProject --branch main --commit-dirty=true
    if ($LASTEXITCODE -ne 0) { throw "wrangler pages deploy failed" }
    Write-Host "PASS wrangler deploy $PagesProject" -ForegroundColor Green
  } finally {
    Pop-Location
  }

  $attachLib = Join-Path $PSScriptRoot "lib\attach-pages-domain.ps1"
  if (Test-Path $attachLib) {
    . $attachLib
    $accountId = "06738739e65bc88a495de618cabfa5ca"
    try {
      $dom = Add-CloudflarePagesDomain -AccountId $accountId -ProjectName $PagesProject -DomainName $HomepageHost
      Write-Host "PASS Pages custom domain attach $($dom.name) status=$($dom.status)" -ForegroundColor Green
    } catch {
      if ($_.Exception.Message -match "already exists|duplicate") {
        Write-Host "INFO custom domain $HomepageHost already attached" -ForegroundColor Yellow
      } else {
        Write-Host "WARN custom domain attach: $($_.Exception.Message)" -ForegroundColor Yellow
        Write-Host "Operator: Cloudflare Dashboard > Pages > $PagesProject > Custom domains > $HomepageHost" -ForegroundColor Yellow
      }
    }
    Write-Host "DNS gate: apex CNAME $HomepageHost -> $PagesProject.pages.dev (proxied) if verification pending" -ForegroundColor Cyan
  }
}

if ($SkipVerify) { exit 0 }

function Get-HttpStatus([string]$Url) {
  try {
    $r = Invoke-WebRequest -Uri $Url -Method Head -UseBasicParsing -TimeoutSec 30
    return [int]$r.StatusCode
  } catch {
    if ($_.Exception.Response) { return [int]$_.Exception.Response.StatusCode.value__ }
    return 0
  }
}

Write-Host "`nVerification" -ForegroundColor Cyan
$checks = @()

$homeCode = Get-HttpStatus "https://$HomepageHost/"
$checks += @{ Name = "homepage"; Ok = ($homeCode -eq 200); Detail = "HTTP $homeCode" }

$appCode = Get-HttpStatus "https://$AppHost/"
$checks += @{ Name = "app"; Ok = ($appCode -eq 200); Detail = "HTTP $appCode" }

try {
  $prod = Invoke-RestMethod -Uri "https://$ApiHost/api/health" -TimeoutSec 30
  $pe = $prod.data.env
  $prodOk = $pe.appEnv -eq "production" -and $pe.creditTopupEnabled -eq $false -and $pe.paymentProvider -eq "mock"
  $checks += @{ Name = "api_production"; Ok = $prodOk; Detail = "appEnv=$($pe.appEnv)" }
} catch {
  $checks += @{ Name = "api_production"; Ok = $false; Detail = $_.Exception.Message }
}

try {
  $stg = Invoke-RestMethod -Uri "https://$StagingApiHost/api/health" -TimeoutSec 30
  $se = $stg.data.env
  $stgOk = $se.appEnv -eq "staging" -and $se.creditTopupEnabled -eq $false
  $checks += @{ Name = "api_staging"; Ok = $stgOk; Detail = "appEnv=$($se.appEnv)" }
} catch {
  $checks += @{ Name = "api_staging"; Ok = $false; Detail = $_.Exception.Message }
}

$failed = 0
foreach ($c in $checks) {
  if ($c.Ok) {
    Write-Host "PASS $($c.Name) — $($c.Detail)" -ForegroundColor Green
  } else {
    Write-Host "FAIL $($c.Name) — $($c.Detail)" -ForegroundColor Red
    $failed++
  }
}

if ($failed -gt 0) { exit 1 }
Write-Host "`nPASS Task 10.24 verification" -ForegroundColor Green