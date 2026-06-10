<#
.SYNOPSIS
  Task 11.2 — Portable cloud-agnostic staging smoke orchestrator.

.DESCRIPTION
  Run from repo root:
    npm run smoke:staging
    npm run smoke:staging -- -ApiBaseUrl "https://api-staging.example.com" -WebBaseUrl "https://web-staging.example.com"
    npm run smoke:staging -- -HealthOnly
    npm run smoke:staging -- -IncludeApiMode -SupabaseUrl "<url>" -SupabaseAnonKey "<key>"

  Defaults are Cloudflare staging URLs only — all overrideable for AWS/VPS later.

  Never logs secret values.
#>
[CmdletBinding()]
param(
  [string]$ApiBaseUrl = "",
  [string]$WebBaseUrl = "",
  [string]$SupabaseUrl = "",
  [string]$SupabaseAnonKey = "",
  [string]$TestEmail = "",
  [string]$TestPassword = "VibeNovel-Staging-Smoke-Test!",
  [string]$TargetName = "",
  [switch]$SkipWeb,
  [switch]$SkipAuth,
  [switch]$HealthOnly,
  [switch]$IncludeTopup,
  [switch]$IncludeApiMode
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "lib\staging-smoke-common.ps1")

$RepoRoot = Split-Path -Parent $PSScriptRoot
$ApiBaseUrl = Resolve-StagingApiBaseUrl -ApiBaseUrl $ApiBaseUrl
$WebBaseUrl = Resolve-StagingWebBaseUrl -WebBaseUrl $WebBaseUrl
if ([string]::IsNullOrWhiteSpace($TargetName)) {
  $TargetName = if ($env:VIBENOVEL_STAGING_TARGET_NAME) { $env:VIBENOVEL_STAGING_TARGET_NAME } else { $script:DefaultTargetName }
}

$sb = Get-StagingSupabaseParamsPresent -SupabaseUrl $SupabaseUrl -SupabaseAnonKey $SupabaseAnonKey
$SupabaseUrl = $sb.Url
$SupabaseAnonKey = $sb.AnonKey
$hasHostedSupabase = $sb.Present

Write-Host ""
Write-Host "VibeNovel Staging Smoke (portable)" -ForegroundColor Cyan
Write-Host "Target:   $TargetName"
Write-Host "API:      $ApiBaseUrl"
Write-Host "Web:      $WebBaseUrl"
Write-Host "Supabase: $(if ($hasHostedSupabase) { Get-RedactedValue $SupabaseUrl 12 } else { '[not configured for staging]' })"
Write-Host ""

$failures = 0
$blockedPhases = New-Object System.Collections.Generic.List[string]

# --- Phase A: API health ---
Write-Host "Phase A: API health (Mode A safe flags)" -ForegroundColor Cyan
$healthResult = Invoke-StagingHealthCheck -ApiBaseUrl $ApiBaseUrl -RequireSupabase:$hasHostedSupabase
if ($healthResult.ContainsKey("Error") -and $healthResult.Error) {
  Write-Host "  FAIL health request: $($healthResult.Error)" -ForegroundColor Red
  $failures++
} elseif (-not $healthResult.Ok) {
  foreach ($c in @($healthResult.Checks)) {
    $color = if ($c.Ok) { "Green" } else { "Red" }
    Write-Host ("  {0} {1}" -f $(if ($c.Ok) { "PASS" } else { "FAIL" }), $c.Name) -ForegroundColor $color
    if (-not $c.Ok) { $failures++ }
  }
} else {
  foreach ($c in $healthResult.Checks) {
    Write-Host ("  PASS {0}" -f $c.Name) -ForegroundColor Green
  }
  $flags = $healthResult.EnvFlags
  if ($null -ne $flags -and -not $flags.hasSupabaseUrl) {
    Write-Host "  INFO Worker Supabase secrets not set (Mode A shell only)" -ForegroundColor Yellow
    $blockedPhases.Add("auth/project API smoke (Worker Supabase missing)")
    $blockedPhases.Add("web API-mode topup/auth (Worker Supabase missing)")
  }
}
Write-Host ""

if ($HealthOnly) {
  if ($failures -gt 0) { exit 1 }
  Write-Host "PASS: health-only staging smoke" -ForegroundColor Green
  exit 0
}

# --- Phase B: Web reachability ---
if (-not $SkipWeb) {
  Write-Host "Phase B: Web HTTP 200" -ForegroundColor Cyan
  $webResults = Test-StagingWebReachable -WebBaseUrl $WebBaseUrl
  foreach ($r in $webResults) {
    if ($r.Ok) {
      Write-Host ("  PASS GET {0} -> {1}" -f $r.Path, $r.Status) -ForegroundColor Green
    } else {
      Write-Host ("  FAIL GET {0}" -f $r.Path) -ForegroundColor Red
      if ($r.Error) { Write-Host "    $($r.Error)" -ForegroundColor Red }
      $failures++
    }
  }
  Write-Host ""
} else {
  Write-Host "Phase B: SKIP (-SkipWeb)" -ForegroundColor Yellow
  Write-Host ""
}

# --- Phase C: CORS ---
Write-Host "Phase C: CORS (Origin = WebBaseUrl)" -ForegroundColor Cyan
$cors = Test-StagingCors -ApiBaseUrl $ApiBaseUrl -WebBaseUrl $WebBaseUrl
if ($cors.Ok) {
  Write-Host ("  PASS Access-Control-Allow-Origin={0}" -f $cors.AllowOrigin) -ForegroundColor Green
} else {
  Write-Host "  FAIL CORS check" -ForegroundColor Red
  if ($cors.Error) { Write-Host "    $($cors.Error)" -ForegroundColor Red }
  $failures++
}
Write-Host ""

# --- Phase D: Auth / project API smoke ---
if (-not $SkipAuth) {
  Write-Host "Phase D: Auth + project API smoke" -ForegroundColor Cyan
  if (-not $hasHostedSupabase) {
    Write-Host "  BLOCKED: STAGING_SUPABASE_URL + STAGING_SUPABASE_ANON_KEY required" -ForegroundColor Yellow
    Write-Host "  Operator: set Worker secrets + pass -SupabaseUrl/-SupabaseAnonKey or env vars" -ForegroundColor Yellow
  } elseif ($null -eq $healthResult.EnvFlags -or -not $healthResult.EnvFlags.hasSupabaseUrl) {
    Write-Host "  BLOCKED: Worker hasSupabaseUrl=false - set wrangler secrets + redeploy" -ForegroundColor Yellow
  } else {
    $signup = Invoke-StagingAuthSignupSmoke -SupabaseUrl $SupabaseUrl -SupabaseAnonKey $SupabaseAnonKey -TestEmail $TestEmail -TestPassword $TestPassword
    if ($signup.Ok) {
      $mode = if ($signup.Mode) { $signup.Mode } else { "signup" }
      Write-Host ("  PASS Supabase auth ({0}, email={1})" -f $mode, $signup.Email) -ForegroundColor Green
    } else {
      Write-Host "  FAIL Supabase signup" -ForegroundColor Red
      Write-Host "    $($signup.Error)" -ForegroundColor Red
      $failures++
    }

    $s2Script = Join-Path $PSScriptRoot "sprint2-smoke-api.ps1"
    if (Test-Path $s2Script) {
      Write-Host "  Running sprint2-smoke-api.ps1 against staging..." -ForegroundColor Gray
      & $s2Script -ApiBaseUrl $ApiBaseUrl -SupabaseUrl $SupabaseUrl -SupabaseAnonKey $SupabaseAnonKey -TestEmail $TestEmail -TestPassword $TestPassword
      if ($LASTEXITCODE -ne 0) {
        Write-Host "  FAIL sprint2-smoke-api.ps1 exit $LASTEXITCODE" -ForegroundColor Red
        $failures++
      } else {
        Write-Host "  PASS sprint2-smoke-api.ps1" -ForegroundColor Green
      }
    }
  }
  Write-Host ""
} else {
  Write-Host "Phase D: SKIP (-SkipAuth)" -ForegroundColor Yellow
  Write-Host ""
}

# --- Phase E: Web topup API-mode smoke ---
if ($IncludeTopup -or $IncludeApiMode) {
  Write-Host "Phase E: Web topup API-mode smoke" -ForegroundColor Cyan
  if (-not $hasHostedSupabase) {
    Write-Host "  BLOCKED: hosted Supabase params required" -ForegroundColor Yellow
  } elseif ($null -eq $healthResult.EnvFlags -or -not $healthResult.EnvFlags.hasSupabaseUrl) {
    Write-Host "  BLOCKED: Worker Supabase not configured" -ForegroundColor Yellow
  } else {
    $topupScript = Join-Path $PSScriptRoot "sprint10-smoke-web.ps1"
    & $topupScript `
      -WebBaseUrl $WebBaseUrl `
      -ApiBaseUrl $ApiBaseUrl `
      -SupabaseUrl $SupabaseUrl `
      -SupabaseAnonKey $SupabaseAnonKey `
      -TestEmail $TestEmail `
      -TestPassword $TestPassword `
      -IncludeApiMode `
      -SkipMockMode `
      -StagingMode
    if ($LASTEXITCODE -ne 0) {
      Write-Host "  FAIL sprint10-smoke-web.ps1 exit $LASTEXITCODE" -ForegroundColor Red
      $failures++
    } else {
      Write-Host "  PASS sprint10-smoke-web.ps1 (API mode, topup disabled safe)" -ForegroundColor Green
    }
  }
  Write-Host ""
}

# --- Summary ---
Write-Host "Staging smoke summary" -ForegroundColor Cyan
Write-Host "  Target: $TargetName"
Write-Host "  Failures: $failures"
if ($blockedPhases.Count -gt 0) {
  Write-Host "  Blocked phases:" -ForegroundColor Yellow
  foreach ($b in $blockedPhases) { Write-Host "    - $b" -ForegroundColor Yellow }
}

if ($failures -gt 0) {
  Write-Host "FAIL: staging smoke" -ForegroundColor Red
  exit 1
}

if (-not $hasHostedSupabase -or $null -eq $healthResult.EnvFlags -or -not $healthResult.EnvFlags.hasSupabaseUrl) {
  Write-Host "PARTIAL GO: shell/health/CORS PASS; full staging auth/API blocked (Supabase pending)" -ForegroundColor Yellow
  exit 0
}

Write-Host "PASS: full staging smoke" -ForegroundColor Green
exit 0