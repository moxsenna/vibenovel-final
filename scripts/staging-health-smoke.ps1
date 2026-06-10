<#
.SYNOPSIS
  Staging health smoke — cloud-agnostic (Task 11.1 / 11.2).

.DESCRIPTION
  Run from repo root:
    npm run smoke:staging:health
    npm run smoke:staging:health -- -ApiBaseUrl "https://api-staging.example.com"
    npm run smoke:staging:health -- -WebBaseUrl "https://web-staging.example.com" -CheckCors

  Verifies GET /api/health safe Mode A flags only. Never logs secrets.
#>
[CmdletBinding()]
param(
  [string]$ApiBaseUrl = "",
  [string]$WebBaseUrl = "",
  [switch]$CheckCors,
  [switch]$RequireSupabase
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "lib\staging-smoke-common.ps1")

$ApiBaseUrl = Resolve-StagingApiBaseUrl -ApiBaseUrl $ApiBaseUrl
$uri = "$($ApiBaseUrl.TrimEnd('/'))/api/health"
Write-Host "Staging health: $uri"

$healthResult = Invoke-StagingHealthCheck -ApiBaseUrl $ApiBaseUrl -RequireSupabase:$RequireSupabase
if ($healthResult.ContainsKey("Error") -and $healthResult.Error) {
  Write-Host "FAIL: $($healthResult.Error)" -ForegroundColor Red
  exit 1
}

$fail = 0
foreach ($c in @($healthResult.Checks)) {
  if ($c.Ok) {
    Write-Host ("PASS {0}" -f $c.Name) -ForegroundColor Green
  } else {
    Write-Host ("FAIL {0}" -f $c.Name) -ForegroundColor Red
    $fail++
  }
}

if ($CheckCors) {
  $WebBaseUrl = Resolve-StagingWebBaseUrl -WebBaseUrl $WebBaseUrl
  $cors = Test-StagingCors -ApiBaseUrl $ApiBaseUrl -WebBaseUrl $WebBaseUrl
  if ($cors.Ok) {
    Write-Host ("PASS CORS Origin={0} Allow={1}" -f $WebBaseUrl, $cors.AllowOrigin) -ForegroundColor Green
  } else {
    Write-Host "FAIL CORS check" -ForegroundColor Red
    $fail++
  }
}

if ($fail -gt 0) { exit 1 }
Write-Host "PASS: staging Mode A health smoke" -ForegroundColor Green
exit 0