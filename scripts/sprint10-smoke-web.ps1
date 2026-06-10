<#
.SYNOPSIS
  Sprint 10 web E2E smoke — credit topup UI (Task 10.4).

.DESCRIPTION
  Run from repo root:
    npm run smoke:web:topup
    npm run smoke:web:sprint10
    npm run smoke:web:topup -- -IncludeApiMode

  Mock mode: VITE_USE_MOCKS=true (default)
  API mode: VITE_USE_MOCKS=false, dev:api, dev:web restarted
#>
[CmdletBinding()]
param(
  [string]$WebBaseUrl = "http://localhost:5173",
  [string]$ApiBaseUrl = "http://127.0.0.1:8787",
  [string]$SupabaseUrl = "",
  [string]$SupabaseAnonKey = "",
  [switch]$IncludeApiMode,
  [switch]$SkipMockMode,
  [switch]$StagingMode,
  [string]$TestEmail = "",
  [string]$TestPassword = "VibeNovel-Local-Smoke-Test!"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Continue"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$WebDir = Join-Path $RepoRoot "apps\web"
$CommonLib = Join-Path $PSScriptRoot "lib\staging-smoke-common.ps1"
if (Test-Path $CommonLib) { . $CommonLib }

if ([string]::IsNullOrWhiteSpace($SupabaseUrl)) {
  $SupabaseUrl = if ($StagingMode) {
    Resolve-StagingSupabaseUrl
  } else {
    "http://127.0.0.1:54321"
  }
}
$Results = New-Object System.Collections.Generic.List[object]
$StepNumber = 0

function Add-StepResult {
  param([string]$Name, [ValidateSet("PASS", "FAIL", "SKIP", "NOT RUN")][string]$Result, [string]$Detail = "")
  $script:StepNumber++
  $Results.Add([PSCustomObject]@{ Step = $script:StepNumber; Test = $Name; Result = $Result; Detail = $Detail }) | Out-Null
  $color = if ($Result -eq "PASS") { "Green" } elseif ($Result -eq "FAIL") { "Red" } else { "Yellow" }
  Write-Host ("[{0}] {1,-52} {2}" -f $Result, $Name, $Detail) -ForegroundColor $color
}

function Test-WebServerReachable {
  param([string]$Url)
  try {
    Invoke-RestMethod -Uri $Url -Method GET -TimeoutSec 8 | Out-Null
    return $true
  } catch { return $false }
}

function Resolve-SupabaseAnonKey {
  if (Test-Path $CommonLib) {
    return Resolve-StagingSupabaseAnonKey -SupabaseAnonKey $SupabaseAnonKey -SupabaseUrl $SupabaseUrl -RepoRoot $RepoRoot
  }
  if (-not [string]::IsNullOrWhiteSpace($SupabaseAnonKey)) { return $SupabaseAnonKey.Trim() }
  if (-not [string]::IsNullOrWhiteSpace($env:STAGING_SUPABASE_ANON_KEY)) { return $env:STAGING_SUPABASE_ANON_KEY.Trim() }
  Push-Location $RepoRoot
  try {
    foreach ($line in (& supabase status -o env 2>$null)) {
      if ($line -match '^ANON_KEY="(.+)"\s*$') { return $Matches[1] }
    }
  } finally { Pop-Location }
  return $null
}

function Invoke-PlaywrightSprint10 {
  param([string]$Name, [string]$GrepPattern = "", [hashtable]$ExtraEnv = @{})

  $env:PLAYWRIGHT_BASE_URL = $WebBaseUrl
  foreach ($key in $ExtraEnv.Keys) { Set-Item -Path "env:$key" -Value $ExtraEnv[$key] }

  Push-Location $WebDir
  try {
    $args = @("playwright", "test", "e2e/sprint10-topup-flow.spec.ts", "--reporter=line")
    if ($GrepPattern) { $args += @("--grep", $GrepPattern) }
    & npx @args 2>&1 | ForEach-Object { Write-Host $_ }
    $ok = ($LASTEXITCODE -eq 0)
    Add-StepResult $Name $(if ($ok) { "PASS" } else { "FAIL" }) "playwright exit $LASTEXITCODE"
    return $ok
  } catch {
    Add-StepResult $Name "FAIL" $_.Exception.Message
    return $false
  } finally {
    Pop-Location
    Remove-Item Env:PLAYWRIGHT_BASE_URL -ErrorAction SilentlyContinue
    foreach ($key in $ExtraEnv.Keys) { Remove-Item "env:$key" -ErrorAction SilentlyContinue }
  }
}

function Get-ApiHealthFlags {
  try {
    $health = Invoke-RestMethod -Uri "$ApiBaseUrl/api/health" -Method GET -TimeoutSec 8
    return @{
      TopupEnabled = [bool]$health.data.env.creditTopupEnabled
      PaymentMock = [bool]$health.data.env.paymentProviderMock
    }
  } catch {
    return @{ TopupEnabled = $false; PaymentMock = $false }
  }
}

Write-Host "`nVibeNovel Sprint 10 Web Smoke (Topup UI)" -ForegroundColor Cyan

if (-not (Test-WebServerReachable $WebBaseUrl)) {
  Add-StepResult "web server reachable" "FAIL" "start dev:web first"
  exit 1
}
Add-StepResult "web server reachable" "PASS" $WebBaseUrl

$failures = 0

if (-not $SkipMockMode) {
  if (-not (Invoke-PlaywrightSprint10 "mock mode topup UI" "topup mock mode")) { $failures++ }
} else {
  Add-StepResult "mock mode topup UI" "SKIP" "-SkipMockMode"
}

if ($IncludeApiMode) {
  $apiHealthUrl = "$ApiBaseUrl/api/health"
  if (-not (Test-WebServerReachable $apiHealthUrl)) {
    Add-StepResult "api server reachable" "FAIL" "start dev:api for API mode"
    $failures++
  } else {
    Add-StepResult "api server reachable" "PASS" $apiHealthUrl
    $flags = Get-ApiHealthFlags
    $anonKey = Resolve-SupabaseAnonKey
    if ($StagingMode -and [string]::IsNullOrWhiteSpace($anonKey)) {
      Add-StepResult "staging supabase params" "FAIL" "set STAGING_SUPABASE_URL + STAGING_SUPABASE_ANON_KEY or -SupabaseUrl/-SupabaseAnonKey"
      $failures++
    }
    if ([string]::IsNullOrWhiteSpace($TestEmail)) {
      $TestEmail = "s10web-$(Get-Random -Maximum 99999999)@example.com"
    }
    if ($anonKey) {
      try {
        Invoke-RestMethod -Uri "$SupabaseUrl/auth/v1/signup" -Method POST `
          -Headers @{ apikey = $anonKey; Authorization = "Bearer $anonKey" } `
          -ContentType "application/json" `
          -Body (@{ email = $TestEmail; password = $TestPassword } | ConvertTo-Json) | Out-Null
        Add-StepResult "api mode signup" "PASS" "email=$TestEmail"
      } catch {
        Add-StepResult "api mode signup" "FAIL" "signup failed"
        $failures++
      }
    }

    $apiEnv = @{
      SMOKE_WEB_API_MODE = "true"
      SMOKE_TEST_EMAIL = $TestEmail
      SMOKE_TEST_PASSWORD = $TestPassword
      SMOKE_API_URL = $ApiBaseUrl
    }

    if ($flags.TopupEnabled) {
      $apiEnv.SMOKE_TOPUP_ENABLED = "true"
      if (-not (Invoke-PlaywrightSprint10 "api mode topup checkout redirect" "checkout redirects" $apiEnv)) { $failures++ }
      if (-not (Invoke-PlaywrightSprint10 "api mode webhook grant refresh" "mock webhook grant" $apiEnv)) { $failures++ }
    } else {
      $apiEnv.SMOKE_TOPUP_DISABLED = "true"
      if (-not (Invoke-PlaywrightSprint10 "api mode topup disabled" "topup disabled" $apiEnv)) { $failures++ }
      Add-StepResult "api mode checkout grant" "NOT RUN" "CREDIT_TOPUP_ENABLED=false on API"
    }
  }
} else {
  Add-StepResult "api mode topup tests" "NOT RUN" "pass -IncludeApiMode"
}

Write-Host ""
$pass = @($Results | Where-Object { $_.Result -eq "PASS" }).Count
$fail = @($Results | Where-Object { $_.Result -eq "FAIL" }).Count
Write-Host ("Summary: PASS={0} FAIL={1}" -f $pass, $fail) -ForegroundColor $(if ($fail -eq 0) { "Green" } else { "Red" })
if ($failures -gt 0) { exit 1 }
exit 0