<#
.SYNOPSIS
  Local smoke orchestrator — Sprint 2/5/6/7 API + Sprint 3–7 web (Task 7.8.4).

.DESCRIPTION
  Default (smoke:all:local):
    1. sprint2-smoke-api.ps1   (Sprint 2 regression)
    2. sprint5-smoke-api.ps1   (Write Room safety)
    3. sprint6-smoke-api.ps1   (Summary/delta/approval safety)
    4. sprint7-smoke-api.ps1   (Publish package safety)
    5. sprint3-smoke-web.ps1   (mock)
    6. sprint4-smoke-web.ps1   (mock outline)
    7. sprint5-smoke-web.ps1   (mock write)
    8. sprint6-smoke-web.ps1   (mock summary)
    9. sprint7-smoke-web.ps1   (mock publish)

  Full (smoke:all:local:full, -IncludeApiMode):
    Same API smokes; web scripts 5–9 run with -IncludeApiMode (mock + API-mode).
    Outline/write API-mode supported and documented in scripts/README.md.
    Requires VITE_USE_MOCKS=false in apps/web/.env.local and restart dev:web.

  Collects failures across all phases; exits 1 if any FAIL. Does not print secrets.

.PARAMETER IncludeApiMode
  Pass -IncludeApiMode to all web smoke wrappers (summary/publish required for full).

.PARAMETER SkipWeb
  Skip web phases (5–9).

.PARAMETER SkipApi
  Skip API phases (1–4).

.PARAMETER WebBaseUrl
  Vite dev server URL forwarded to web smoke scripts.

.PARAMETER ApiBaseUrl
  API Worker URL forwarded to API and web smoke scripts.

  Run from repo root:
    npm run smoke:all:local
    npm run smoke:all:local:full
    powershell -File scripts/smoke-all-local.ps1 -SkipWeb
#>
[CmdletBinding()]
param(
  [switch]$IncludeApiMode,
  [switch]$SkipWeb,
  [switch]$SkipApi,
  [string]$WebBaseUrl = "http://localhost:5173",
  [string]$ApiBaseUrl = "http://127.0.0.1:8787"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Continue"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$Results = New-Object System.Collections.Generic.List[object]
$SuiteStartedAt = Get-Date

function Format-Elapsed {
  param([TimeSpan]$Elapsed)
  if ($Elapsed.TotalMinutes -ge 1) {
    return ("{0:N1}m" -f $Elapsed.TotalMinutes)
  }
  return ("{0:N1}s" -f $Elapsed.TotalSeconds)
}

function Add-SuiteResult {
  param(
    [int]$Phase,
    [string]$Name,
    [ValidateSet("PASS", "FAIL", "SKIP", "NOT RUN")]
    [string]$Result,
    [string]$Detail = "",
    [string]$Elapsed = ""
  )
  $Results.Add([PSCustomObject]@{
    Phase   = $Phase
    Suite   = $Name
    Result  = $Result
    Elapsed = $Elapsed
    Detail  = $Detail
  }) | Out-Null
  $color = switch ($Result) {
    "PASS"    { "Green" }
    "FAIL"    { "Red" }
    default   { "Yellow" }
  }
  $elapsedSuffix = if ($Elapsed) { " ($Elapsed)" } else { "" }
  Write-Host ("[{0}] Phase {1,2}: {2,-40} {3}{4}" -f $Result, $Phase, $Name, $Detail, $elapsedSuffix) -ForegroundColor $color
}

function Build-ScriptArgs {
  param(
    [ValidateSet("api", "web")][string]$Kind
  )
  $args = @("-ApiBaseUrl", $ApiBaseUrl)
  if ($Kind -eq "web") {
    $args += @("-WebBaseUrl", $WebBaseUrl)
    if ($IncludeApiMode) {
      $args += "-IncludeApiMode"
    }
  }
  return $args
}

function Invoke-SmokeScript {
  param(
    [int]$Phase,
    [Parameter(Mandatory)][string]$DisplayName,
    [Parameter(Mandatory)][string]$ScriptName,
    [ValidateSet("api", "web")][string]$Kind = "api"
  )

  $scriptPath = Join-Path $PSScriptRoot $ScriptName
  if (-not (Test-Path $scriptPath)) {
    Add-SuiteResult -Phase $Phase -Name $DisplayName -Result "FAIL" -Detail "script not found: $ScriptName"
    return $false
  }

  $phaseStartedAt = Get-Date
  Write-Host ""
  Write-Host ("--- Phase {0}: {1} ---" -f $Phase, $DisplayName) -ForegroundColor Cyan

  Push-Location $RepoRoot
  try {
    $extraArgs = Build-ScriptArgs -Kind $Kind
    $argList = @("-ExecutionPolicy", "Bypass", "-File", $scriptPath) + $extraArgs
    & powershell @argList
    $exitCode = $LASTEXITCODE
    $elapsed = Format-Elapsed -Elapsed ((Get-Date) - $phaseStartedAt)
    if ($exitCode -eq 0) {
      Add-SuiteResult -Phase $Phase -Name $DisplayName -Result "PASS" -Detail "exit 0" -Elapsed $elapsed
      return $true
    }
    Add-SuiteResult -Phase $Phase -Name $DisplayName -Result "FAIL" -Detail "exit $exitCode" -Elapsed $elapsed
    return $false
  } catch {
    $elapsed = Format-Elapsed -Elapsed ((Get-Date) - $phaseStartedAt)
    Add-SuiteResult -Phase $Phase -Name $DisplayName -Result "FAIL" -Detail $_.Exception.Message -Elapsed $elapsed
    return $false
  } finally {
    Pop-Location
  }
}

$ApiSuites = @(
  @{ Phase = 1; Name = "API Sprint 2 (base regression)"; Script = "sprint2-smoke-api.ps1" }
  @{ Phase = 2; Name = "API Sprint 5 (write room safety)"; Script = "sprint5-smoke-api.ps1" }
  @{ Phase = 3; Name = "API Sprint 6 (summary safety)"; Script = "sprint6-smoke-api.ps1" }
  @{ Phase = 4; Name = "API Sprint 7 (publish safety)"; Script = "sprint7-smoke-api.ps1" }
)

$WebSuites = @(
  @{ Phase = 5; Name = "Web Sprint 3 (intake/foundation)"; Script = "sprint3-smoke-web.ps1" }
  @{ Phase = 6; Name = "Web Sprint 4 (outline)"; Script = "sprint4-smoke-web.ps1" }
  @{ Phase = 7; Name = "Web Sprint 5 (write)"; Script = "sprint5-smoke-web.ps1" }
  @{ Phase = 8; Name = "Web Sprint 6 (summary)"; Script = "sprint6-smoke-web.ps1" }
  @{ Phase = 9; Name = "Web Sprint 7 (publish)"; Script = "sprint7-smoke-web.ps1" }
)

Write-Host ""
Write-Host "VibeNovel Local Smoke Suite (Task 7.8.4)" -ForegroundColor Cyan
Write-Host "Mode:     $(if ($IncludeApiMode) { 'API + web mock + web API-mode' } else { 'API + web mock only' })"
Write-Host "API URL:  $ApiBaseUrl"
Write-Host "Web URL:  $WebBaseUrl"
Write-Host "Repo:     $RepoRoot"
Write-Host "Phases:   $(if ($SkipApi -and $SkipWeb) { 'none (both skipped)' } elseif ($SkipApi) { 'web only (5-9)' } elseif ($SkipWeb) { 'API only (1-4)' } else { '1-9 (full suite)' })"

if ($IncludeApiMode) {
  Write-Host ""
  Write-Host "API-mode prerequisites:" -ForegroundColor Yellow
  Write-Host "  - Docker Desktop + supabase start (and db reset if needed)"
  Write-Host "  - npm run dev:api  -> $ApiBaseUrl"
  Write-Host "  - npm run dev:web  -> $WebBaseUrl with VITE_USE_MOCKS=false"
  Write-Host "  - apps/web/.env.local configured (Supabase URL/anon key, VITE_API_URL)"
  Write-Host "  - Restart dev:web after changing .env.local (Vite bakes env at startup)"
  Write-Host "  - Playwright chromium installed (cd apps/web && npx playwright install chromium)"
} else {
  Write-Host ""
  Write-Host "Mock-mode prerequisites:" -ForegroundColor DarkGray
  Write-Host "  - API: Docker + supabase start, dev:api, apps/api/.dev.vars"
  Write-Host "  - Web: dev:web with VITE_USE_MOCKS=true (default), Playwright chromium"
}

Write-Host ""

$anyFail = $false

if ($SkipApi) {
  foreach ($suite in $ApiSuites) {
    Add-SuiteResult -Phase $suite.Phase -Name $suite.Name -Result "SKIP" -Detail "-SkipApi"
  }
} else {
  foreach ($suite in $ApiSuites) {
    if (-not (Invoke-SmokeScript -Phase $suite.Phase -DisplayName $suite.Name -ScriptName $suite.Script -Kind "api")) {
      $anyFail = $true
    }
  }
}

if ($SkipWeb) {
  foreach ($suite in $WebSuites) {
    Add-SuiteResult -Phase $suite.Phase -Name $suite.Name -Result "SKIP" -Detail "-SkipWeb"
  }
} else {
  foreach ($suite in $WebSuites) {
    if (-not (Invoke-SmokeScript -Phase $suite.Phase -DisplayName $suite.Name -ScriptName $suite.Script -Kind "web")) {
      $anyFail = $true
    }
  }
}

$totalElapsed = Format-Elapsed -Elapsed ((Get-Date) - $SuiteStartedAt)

Write-Host ""
Write-Host "=== Suite Summary ===" -ForegroundColor Cyan
$Results | Format-Table Phase, Suite, Result, Elapsed, Detail -AutoSize

$passCount = @($Results | Where-Object { $_.Result -eq "PASS" }).Count
$failCount = @($Results | Where-Object { $_.Result -eq "FAIL" }).Count
$skipCount = @($Results | Where-Object { $_.Result -eq "SKIP" }).Count
$notRunCount = @($Results | Where-Object { $_.Result -eq "NOT RUN" }).Count

Write-Host ("Totals: {0} PASS, {1} FAIL, {2} SKIP, {3} NOT RUN - elapsed {4}" -f $passCount, $failCount, $skipCount, $notRunCount, $totalElapsed) `
  -ForegroundColor $(if ($failCount -gt 0) { "Red" } else { "Green" })

if ($IncludeApiMode) {
  Write-Host ""
  Write-Host "Full mode: web API-mode runs mock + API Playwright flows where supported." -ForegroundColor DarkGray
  Write-Host "Switching mock/API mode requires VITE_USE_MOCKS change + dev:web restart." -ForegroundColor DarkGray
}

if ($failCount -gt 0) { exit 1 }
exit 0