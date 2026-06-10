<#
.SYNOPSIS
  Task 11.5 — smoke AWS EC2 API staging + optional Cloudflare regression.

.DESCRIPTION
  Run from repo root after operator deploys Docker API on separate EC2.

.EXAMPLE
  npm run operator:aws:staging:smoke -- -ApiBaseUrl "https://api-staging.example.com" -HealthOnly

.EXAMPLE
  npm run operator:aws:staging:smoke -- `
    -ApiBaseUrl "https://api-staging.example.com" `
    -IncludeApiMode `
    -TestEmail "staging-smoke@vibenovel.test" `
    -CloudflareRegression
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$ApiBaseUrl,
  [string]$WebBaseUrl = "",
  [string]$TestEmail = "",
  [string]$TestPassword = "VibeNovel-Staging-Smoke-Test!",
  [switch]$HealthOnly,
  [switch]$IncludeApiMode,
  [switch]$CloudflareRegression
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot "lib\staging-smoke-common.ps1")

Import-StagingSupabaseEnv -RepoRoot $RepoRoot

$WebBaseUrl = Resolve-StagingWebBaseUrl -WebBaseUrl $WebBaseUrl
$ApiBaseUrl = $ApiBaseUrl.Trim().TrimEnd('/')

Write-Host "AWS EC2 staging smoke" -ForegroundColor Cyan
Write-Host "API: $ApiBaseUrl"
Write-Host "Web: $WebBaseUrl"

$smokeArgs = @{
  ApiBaseUrl   = $ApiBaseUrl
  WebBaseUrl   = $WebBaseUrl
  TargetName   = if ($ApiBaseUrl -match '^https://') { "aws-staging" } else { "aws-staging-http" }
}
if ($HealthOnly) { $smokeArgs.HealthOnly = $true }
if ($IncludeApiMode) { $smokeArgs.IncludeApiMode = $true }
if ($TestEmail) { $smokeArgs.TestEmail = $TestEmail }
if ($TestPassword) { $smokeArgs.TestPassword = $TestPassword }

$stagingUrl = Get-StagingSupabaseCredential 'STAGING_SUPABASE_URL'
$stagingAnon = Get-StagingSupabaseCredential 'STAGING_SUPABASE_ANON_KEY'
if ($stagingUrl) { $smokeArgs.SupabaseUrl = $stagingUrl }
if ($stagingAnon) { $smokeArgs.SupabaseAnonKey = $stagingAnon }

& (Join-Path $PSScriptRoot "smoke-staging.ps1") @smokeArgs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if ($CloudflareRegression) {
  Write-Host "`nCloudflare staging regression (health)..." -ForegroundColor Cyan
  & (Join-Path $PSScriptRoot "staging-health-smoke.ps1")
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host "PASS AWS staging smoke" -ForegroundColor Green
exit 0