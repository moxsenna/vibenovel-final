<#
.SYNOPSIS
  Sprint 3 web E2E smoke test for local VibeNovel development.

.DESCRIPTION
  Runs Playwright browser checks for intake → concepts → foundation pages.
  Mock mode (default) requires web dev server with VITE_USE_MOCKS=true.
  API mode (-IncludeApiMode) additionally requires local Supabase, API Worker,
  and web dev server with VITE_USE_MOCKS=false + Supabase env configured.

  Run from repo root:
    npm run smoke:web
    npm run smoke:web -- -IncludeApiMode

  Prerequisites (mock mode):
    - npm install (includes @playwright/test in apps/web)
    - npx playwright install chromium  (first run only)
    - npm run dev:web  → http://localhost:5173 with VITE_USE_MOCKS=true

  Prerequisites (API mode, optional):
    - supabase start && supabase db reset
    - npm run dev:api  → http://127.0.0.1:8787
    - apps/web/.env.local with VITE_USE_MOCKS=false, VITE_API_URL, VITE_SUPABASE_*
    - Restart dev:web after changing .env.local

.PARAMETER WebBaseUrl
  Vite dev server URL (default: http://localhost:5173).

.PARAMETER ApiBaseUrl
  API Worker URL for API-mode preflight (default: http://127.0.0.1:8787).

.PARAMETER SupabaseUrl
  Local Supabase Auth URL (default: http://127.0.0.1:54321).

.PARAMETER IncludeApiMode
  Also run API-mode Playwright flow (requires full stack + VITE_USE_MOCKS=false).

.PARAMETER SkipMockMode
  Skip mock-mode Playwright tests (API mode only).

.PARAMETER TestPassword
  Local-only password for ephemeral API-mode signup (never committed).
#>
[CmdletBinding()]
param(
  [string]$WebBaseUrl = "http://localhost:5173",
  [string]$ApiBaseUrl = "http://127.0.0.1:8787",
  [string]$SupabaseUrl = "http://127.0.0.1:54321",
  [string]$SupabaseAnonKey = "",
  [switch]$IncludeApiMode,
  [switch]$SkipMockMode,
  [string]$TestEmail = "",
  [string]$TestPassword = "VibeNovel-Local-Smoke-Test!"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Continue"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$WebDir = Join-Path $RepoRoot "apps\web"
$Results = New-Object System.Collections.Generic.List[object]
$StepNumber = 0

function Write-SmokeHeader {
  Write-Host ""
  Write-Host "VibeNovel Sprint 3 Web Smoke Test" -ForegroundColor Cyan
  Write-Host "Web:      $WebBaseUrl"
  Write-Host "API:      $ApiBaseUrl"
  Write-Host "Mode:     $(if ($IncludeApiMode) { 'mock + API' } elseif ($SkipMockMode) { 'API only' } else { 'mock only' })"
  Write-Host "Repo:     $RepoRoot"
  Write-Host ""
}

function Add-StepResult {
  param(
    [string]$Name,
    [ValidateSet("PASS", "FAIL", "SKIP", "NOT RUN")]
    [string]$Result,
    [string]$Detail = ""
  )
  $script:StepNumber++
  $Results.Add([PSCustomObject]@{
      Step   = $script:StepNumber
      Test   = $Name
      Result = $Result
      Detail = $Detail
    }) | Out-Null

  $color = switch ($Result) {
    "PASS" { "Green" }
    "FAIL" { "Red" }
    "SKIP" { "Yellow" }
    "NOT RUN" { "DarkYellow" }
  }
  Write-Host ("[{0}] {1,-40} {2}" -f $Result, $Name, $Detail) -ForegroundColor $color
}

function Test-WebServerReachable {
  param([string]$Url)
  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 8
    return [bool]($response.StatusCode -ge 200 -and $response.StatusCode -lt 400)
  } catch {
    return $false
  }
}

function Resolve-SupabaseAnonKey {
  if (-not [string]::IsNullOrWhiteSpace($SupabaseAnonKey)) {
    return $SupabaseAnonKey.Trim()
  }
  if (-not [string]::IsNullOrWhiteSpace($env:SUPABASE_ANON_KEY)) {
    return $env:SUPABASE_ANON_KEY.Trim()
  }
  try {
    Push-Location $RepoRoot
    $statusOutput = & supabase status -o env 2>$null
    if ($LASTEXITCODE -eq 0 -and $statusOutput) {
      foreach ($line in $statusOutput) {
        if ($line -match '^ANON_KEY="(.+)"\s*$') {
          Pop-Location
          return $Matches[1]
        }
      }
    }
  } catch {
    # fall through
  } finally {
    Pop-Location
  }
  return $null
}

function Invoke-Playwright {
  param(
    [string]$Name,
    [hashtable]$ExtraEnv = @{}
  )

  $env:SMOKE_WEB_BASE_URL = $WebBaseUrl
  foreach ($key in $ExtraEnv.Keys) {
    Set-Item -Path "env:$key" -Value $ExtraEnv[$key]
  }

  Push-Location $WebDir
  try {
    & npx playwright test e2e/sprint3-flow.spec.ts 2>&1 | ForEach-Object { Write-Host $_ }
    $exitCode = $LASTEXITCODE
    if ($exitCode -eq 0) {
      Add-StepResult $Name "PASS" "playwright exit 0"
    } else {
      Add-StepResult $Name "FAIL" "playwright exit $exitCode"
    }
    return ($exitCode -eq 0)
  } catch {
    Add-StepResult $Name "FAIL" $_.Exception.Message
    return $false
  } finally {
    Pop-Location
    Remove-Item Env:SMOKE_WEB_BASE_URL -ErrorAction SilentlyContinue
    foreach ($key in $ExtraEnv.Keys) {
      Remove-Item "env:$key" -ErrorAction SilentlyContinue
    }
  }
}

Write-SmokeHeader

# --- Preflight: Playwright installed (hoisted or workspace-local) ---
$playwrightPkg = Join-Path $WebDir "node_modules\@playwright\test"
$playwrightHoisted = Join-Path $RepoRoot "node_modules\@playwright\test"
if (-not (Test-Path $playwrightPkg) -and -not (Test-Path $playwrightHoisted)) {
  Add-StepResult "playwright dependency" "FAIL" "Run: npm install from repo root"
  $Results | Format-Table -AutoSize
  exit 1
}
$pwSource = if (Test-Path $playwrightPkg) { "apps/web" } else { "root (hoisted)" }
Add-StepResult "playwright dependency" "PASS" $pwSource

# --- Preflight: web dev server ---
if (-not (Test-WebServerReachable $WebBaseUrl)) {
  Add-StepResult "web dev server reachable" "FAIL" "Start: npm run dev:web ($WebBaseUrl)"
  Write-Host ""
  Write-Host "Instructions:" -ForegroundColor Yellow
  Write-Host "  1. Copy apps/web/.env.example -> apps/web/.env.local"
  Write-Host "  2. Set VITE_USE_MOCKS=true for mock smoke (default)"
  Write-Host "  3. npm run dev:web"
  Write-Host "  4. Re-run: npm run smoke:web"
  Write-Host ""
  $Results | Format-Table -AutoSize
  exit 1
}
Add-StepResult "web dev server reachable" "PASS" $WebBaseUrl

$anyFail = $false

# --- Mock mode Playwright ---
if (-not $SkipMockMode) {
  $mockOk = Invoke-Playwright -Name "mock-mode Playwright (intake/concepts/foundation)"
  if (-not $mockOk) { $anyFail = $true }
} else {
  Add-StepResult "mock-mode Playwright" "SKIP" "-SkipMockMode"
}

# --- API mode (optional) ---
if ($IncludeApiMode) {
  $apiHealthy = $false
  try {
    $health = Invoke-RestMethod "$ApiBaseUrl/health" -TimeoutSec 8
    $ok = $false
    if ($null -ne $health.PSObject.Properties["ok"]) { $ok = [bool]$health.ok }
    elseif ($null -ne $health.data -and $null -ne $health.data.PSObject.Properties["ok"]) {
      $ok = [bool]$health.data.ok
    }
    $apiHealthy = $ok
    Add-StepResult "API health check" $(if ($ok) { "PASS" } else { "FAIL" }) "ok=$ok"
  } catch {
    Add-StepResult "API health check" "FAIL" $_.Exception.Message
  }

  $anonKey = Resolve-SupabaseAnonKey
  if (-not $anonKey) {
    Add-StepResult "resolve Supabase anon key" "FAIL" "supabase start or SUPABASE_ANON_KEY"
    Add-StepResult "API-mode Playwright" "NOT RUN" "missing anon key"
    $anyFail = $true
  } else {
    Add-StepResult "resolve Supabase anon key" "PASS" "source=env|cli"

    if ([string]::IsNullOrWhiteSpace($TestEmail)) {
      $TestEmail = "s3websmoke-$(Get-Random -Maximum 99999999)@example.com"
    }

    $token = $null
    $projectId = $null
    try {
      $signup = Invoke-RestMethod `
        -Uri "$SupabaseUrl/auth/v1/signup" `
        -Method POST `
        -Headers @{ apikey = $anonKey; Authorization = "Bearer $anonKey" } `
        -ContentType "application/json" `
        -Body (@{ email = $TestEmail; password = $TestPassword } | ConvertTo-Json)
      $token = $signup.access_token
      if (-not $token) {
        $signin = Invoke-RestMethod `
          -Uri "$SupabaseUrl/auth/v1/token?grant_type=password" `
          -Method POST `
          -Headers @{ apikey = $anonKey; Authorization = "Bearer $anonKey" } `
          -ContentType "application/json" `
          -Body (@{ email = $TestEmail; password = $TestPassword } | ConvertTo-Json)
        $token = $signin.access_token
      }
      Add-StepResult "API-mode signup/login" $(if ($token) { "PASS" } else { "FAIL" }) "email=$TestEmail"
    } catch {
      Add-StepResult "API-mode signup/login" "FAIL" $_.Exception.Message
    }

    if ($token -and $apiHealthy) {
      try {
        $created = Invoke-RestMethod `
          -Uri "$ApiBaseUrl/api/projects" `
          -Method POST `
          -Headers @{ Authorization = "Bearer $token" } `
          -ContentType "application/json" `
          -Body '{"title":"S3 Web Smoke","entryPath":"rough_idea"}'
        $projectId = $created.data.id
        Add-StepResult "API-mode create project" "PASS" "projectId=$projectId"
      } catch {
        Add-StepResult "API-mode create project" "FAIL" $_.Exception.Message
      }
    }

    if ($token -and $projectId) {
      Write-Host ""
      Write-Host "API mode requires web dev server started with VITE_USE_MOCKS=false" -ForegroundColor Yellow
      Write-Host "  and apps/web/.env.local configured (restart dev:web after changes)." -ForegroundColor Yellow
      Write-Host ""

      $apiEnv = @{
        SMOKE_WEB_API_MODE   = "true"
        SMOKE_TEST_EMAIL     = $TestEmail
        SMOKE_TEST_PASSWORD  = $TestPassword
        SMOKE_PROJECT_ID     = $projectId
      }
      $apiOk = Invoke-Playwright -Name "API-mode Playwright (DevAuth full flow)" -ExtraEnv $apiEnv
      if (-not $apiOk) { $anyFail = $true }
    } else {
      Add-StepResult "API-mode Playwright" "NOT RUN" "signup or project create failed"
      $anyFail = $true
    }
  }
} else {
  Add-StepResult "API-mode Playwright" "NOT RUN" "use -IncludeApiMode; see scripts/sprint3-smoke-web-manual-checklist.md"
}

# --- Summary ---
Write-Host ""
$Results | Format-Table Step, Test, Result, Detail -AutoSize

$failCount = @($Results | Where-Object { $_.Result -eq "FAIL" }).Count
$passCount = @($Results | Where-Object { $_.Result -eq "PASS" }).Count
$notRunCount = @($Results | Where-Object { $_.Result -eq "NOT RUN" }).Count
Write-Host "Summary: $passCount PASS, $failCount FAIL, $notRunCount NOT RUN" -ForegroundColor $(if ($failCount -gt 0) { "Red" } else { "Green" })

Write-Host ""
Write-Host "CI note: web E2E deferred from GitHub Actions (needs browser + Supabase + dual env)." -ForegroundColor DarkGray
Write-Host "Manual API checklist: scripts/sprint3-smoke-web-manual-checklist.md" -ForegroundColor DarkGray

if ($failCount -gt 0) { exit 1 }
exit 0