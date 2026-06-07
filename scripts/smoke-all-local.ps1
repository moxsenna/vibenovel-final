<#
.SYNOPSIS
  Run local smoke suite: API base + Sprint 5 API + web mock E2E (Task 5.8).

.DESCRIPTION
  Default (no -IncludeApiMode):
    - sprint2-smoke-api.ps1   (Sprint 2 regression, 17 steps)
    - sprint5-smoke-api.ps1   (Write Room safety, 49 steps)
    - sprint3-smoke-web.ps1    (mock only)
    - sprint4-smoke-web.ps1    (mock only)
    - sprint5-smoke-web.ps1     (mock only)

  With -IncludeApiMode (smoke:all:local:full):
    Same API smokes, then web scripts with -IncludeApiMode (requires VITE_USE_MOCKS=false + restart dev:web).

  Prerequisites:
    - supabase start && supabase db reset
    - npm run dev:api  (http://127.0.0.1:8787)
    - npm run dev:web  (http://localhost:5173) for web steps
    - Playwright chromium installed (first run: cd apps/web && npx playwright install chromium)

  Security: does not print JWT or service role keys.

  Run from repo root:
    npm run smoke:all:local
    npm run smoke:all:local:full
#>
[CmdletBinding()]
param(
  [switch]$IncludeApiMode
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Continue"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$Results = New-Object System.Collections.Generic.List[object]

function Add-SuiteResult {
  param(
    [string]$Name,
    [ValidateSet("PASS", "FAIL", "SKIP")]
    [string]$Result,
    [string]$Detail = ""
  )
  $Results.Add([PSCustomObject]@{ Suite = $Name; Result = $Result; Detail = $Detail }) | Out-Null
  $color = if ($Result -eq "PASS") { "Green" } elseif ($Result -eq "FAIL") { "Red" } else { "Yellow" }
  Write-Host ("[{0}] {1,-36} {2}" -f $Result, $Name, $Detail) -ForegroundColor $color
}

function Invoke-SmokeScript {
  param(
    [Parameter(Mandatory)][string]$ScriptName,
    [string[]]$ExtraArgs = @()
  )

  $scriptPath = Join-Path $PSScriptRoot $ScriptName
  if (-not (Test-Path $scriptPath)) {
    Add-SuiteResult $ScriptName "FAIL" "script not found"
    return $false
  }

  Push-Location $RepoRoot
  try {
    $argList = @("-ExecutionPolicy", "Bypass", "-File", $scriptPath) + $ExtraArgs
    & powershell @argList
    $exitCode = $LASTEXITCODE
    if ($exitCode -eq 0) {
      Add-SuiteResult $ScriptName "PASS" "exit 0"
      return $true
    }
    Add-SuiteResult $ScriptName "FAIL" "exit $exitCode"
    return $false
  } catch {
    Add-SuiteResult $ScriptName "FAIL" $_.Exception.Message
    return $false
  } finally {
    Pop-Location
  }
}

Write-Host ""
Write-Host "VibeNovel Local Smoke Suite (Task 5.8)" -ForegroundColor Cyan
Write-Host "Mode: $(if ($IncludeApiMode) { 'API + web mock + web API-mode' } else { 'API + web mock only' })"
Write-Host "Repo: $RepoRoot"
Write-Host ""

$anyFail = $false

if (-not (Invoke-SmokeScript "sprint2-smoke-api.ps1")) { $anyFail = $true }
if (-not (Invoke-SmokeScript "sprint5-smoke-api.ps1")) { $anyFail = $true }

$webArgs = if ($IncludeApiMode) { @("-IncludeApiMode") } else { @() }

if (-not (Invoke-SmokeScript "sprint3-smoke-web.ps1" -ExtraArgs $webArgs)) { $anyFail = $true }
if (-not (Invoke-SmokeScript "sprint4-smoke-web.ps1" -ExtraArgs $webArgs)) { $anyFail = $true }
if (-not (Invoke-SmokeScript "sprint5-smoke-web.ps1" -ExtraArgs $webArgs)) { $anyFail = $true }

Write-Host ""
$Results | Format-Table Suite, Result, Detail -AutoSize

$failCount = @($Results | Where-Object { $_.Result -eq "FAIL" }).Count
$passCount = @($Results | Where-Object { $_.Result -eq "PASS" }).Count
Write-Host "Summary: $passCount PASS, $failCount FAIL" -ForegroundColor $(if ($failCount -gt 0) { "Red" } else { "Green" })

if ($IncludeApiMode) {
  Write-Host ""
  Write-Host "Full mode note: web API-mode requires VITE_USE_MOCKS=false and dev:web restart." -ForegroundColor DarkGray
}

if ($failCount -gt 0) { exit 1 }
exit 0