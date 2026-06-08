<#
.SYNOPSIS
  Sprint 8 web E2E smoke test for WritePage AI button (Task 8.5).

.DESCRIPTION
  Run from repo root:
    npm run smoke:web:write-ai
    npm run smoke:web:write-ai -- -IncludeApiMode

  Prerequisites (mock mode):
    - npm install (includes @playwright/test)
    - npx playwright install chromium  (first run only)
    - npm run dev:web with VITE_USE_MOCKS=true (default)

  Prerequisites (API mode, -IncludeApiMode):
    - supabase start && supabase db reset
    - npm run dev:api
    - apps/web/.env.local with VITE_USE_MOCKS=false + Supabase + VITE_API_URL
    - Restart dev:web after changing .env.local

  AI success path (optional):
    - Restart dev:api with AI_GENERATION_ENABLED=true and AI_PROVIDER_MOCK=true
    - Script probes API; sets SMOKE_AI_ENABLED for Playwright success test

.PARAMETER WebBaseUrl
  Vite dev server URL (default: http://localhost:5173).

.PARAMETER ApiBaseUrl
  API Worker URL (default: http://127.0.0.1:8787).

.PARAMETER IncludeApiMode
  Bootstrap foundation + outline lock via API, seed credits, run API-mode Playwright.

.PARAMETER SkipMockMode
  Skip mock-mode Playwright tests.

.PARAMETER TestPassword
  Local-only password for ephemeral signup (never committed).
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
  Write-Host "VibeNovel Sprint 8 Write AI Web Smoke Test" -ForegroundColor Cyan
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
  Write-Host ("[{0}] {1,-48} {2}" -f $Result, $Name, $Detail) -ForegroundColor $color
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

function Resolve-ServiceRoleKey {
  Push-Location $RepoRoot
  try {
    foreach ($line in (& supabase status -o env 2>$null)) {
      if ($line -match '^SERVICE_ROLE_KEY="(.+)"\s*$') {
        return $Matches[1]
      }
    }
  } finally {
    Pop-Location
  }
  throw "Supabase service role key not found."
}

function Invoke-ApiRequest {
  param(
    [ValidateSet("GET", "POST", "PATCH", "PUT", "DELETE")]
    [string]$Method = "GET",
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [hashtable]$Headers = @{},
    [string]$Body = $null
  )
  $uri = "$ApiBaseUrl$Path"
  if ($Method -eq "GET" -or $Method -eq "DELETE") {
    return Invoke-RestMethod -Uri $uri -Method $Method -Headers $Headers -ErrorAction Stop
  }
  return Invoke-RestMethod -Uri $uri -Method $Method -Headers $Headers -ContentType "application/json" -Body $Body -ErrorAction Stop
}

function Get-ApiErrorCode {
  param($ErrorRecord)
  try {
    if ($ErrorRecord.ErrorDetails.Message) {
      $payload = $ErrorRecord.ErrorDetails.Message | ConvertFrom-Json
      if ($payload.error.code) { return $payload.error.code }
    }
  } catch { }
  return "unknown"
}

function Test-AiGenerationEnabled {
  param(
    [string]$ProjectId,
    [hashtable]$AuthHeaders
  )
  try {
    Invoke-ApiRequest -Method POST -Path "/api/projects/$ProjectId/ai/generate-prose" -Headers $AuthHeaders -Body '{}' | Out-Null
    return $true
  } catch {
    $code = Get-ApiErrorCode $_
    if ($code -eq "AI_DISABLED") { return $false }
    return $true
  }
}

function Seed-CreditBalance {
  param([string]$UserId, [int]$Balance = 100)
  $srk = Resolve-ServiceRoleKey
  $headers = @{
    apikey         = $srk
    Authorization  = "Bearer $srk"
    Prefer         = "return=minimal"
    "Content-Type" = "application/json"
  }
  $body = @{
    user_id       = $UserId
    balance       = $Balance
    monthly_quota = 1000
    monthly_used  = 0
    source        = "seed"
  } | ConvertTo-Json
  $uri = "$SupabaseUrl/rest/v1/credit_balances"
  try {
    Invoke-RestMethod -Uri $uri -Method POST -Headers $headers -Body $body -ErrorAction Stop | Out-Null
    return $true
  } catch {
    $msg = $_.Exception.Message
    if ($msg -match '409|23505|duplicate') {
      $patchUri = ('{0}/rest/v1/credit_balances?user_id=eq.{1}' -f $SupabaseUrl, $UserId)
      $patchBody = @{ balance = $Balance } | ConvertTo-Json
      Invoke-RestMethod -Uri $patchUri -Method PATCH -Headers $headers -Body $patchBody -ErrorAction Stop | Out-Null
      return $true
    }
    throw
  }
}

function Bootstrap-FoundationLocked {
  param(
    [string]$ProjectId,
    [hashtable]$AuthHeaders
  )
  Invoke-ApiRequest -Method POST -Path "/api/projects/$ProjectId/intake/messages" -Headers $AuthHeaders `
    -Body '{"content":"Cerita drama rumah tangga dengan konflik keluarga dan rahasia masa lalu."}' | Out-Null
  Invoke-ApiRequest -Method POST -Path "/api/projects/$ProjectId/intake/extract-signals" -Headers $AuthHeaders -Body '{}' | Out-Null
  $concepts = Invoke-ApiRequest -Method POST -Path "/api/projects/$ProjectId/concepts/generate" -Headers $AuthHeaders -Body '{}'
  $conceptId = $concepts.data.concepts[0].id
  Invoke-ApiRequest -Method POST -Path "/api/projects/$ProjectId/concepts/$conceptId/select" -Headers $AuthHeaders -Body '{}' | Out-Null
  $proposals = Invoke-ApiRequest -Method POST -Path "/api/projects/$ProjectId/foundation/proposals/generate" -Headers $AuthHeaders -Body '{}'
  foreach ($p in $proposals.data.proposals) {
    if ($p.type -in @('foundation', 'character', 'fact', 'relationship_speech_rule', 'style')) {
      Invoke-ApiRequest -Method POST -Path "/api/projects/$ProjectId/proposals/$($p.id)/accept" -Headers $AuthHeaders -Body '{}' | Out-Null
    }
  }
  Invoke-ApiRequest -Method POST -Path "/api/projects/$ProjectId/foundation/lock" -Headers $AuthHeaders -Body '{}' | Out-Null
}

function Bootstrap-OutlineLocked {
  param(
    [string]$ProjectId,
    [hashtable]$AuthHeaders
  )
  Invoke-ApiRequest -Method POST -Path "/api/projects/$ProjectId/outline/generate" -Headers $AuthHeaders -Body '{}' | Out-Null
  Invoke-ApiRequest -Method POST -Path "/api/projects/$ProjectId/outline/approve" -Headers $AuthHeaders -Body '{}' | Out-Null
  $lock = Invoke-ApiRequest -Method POST -Path "/api/projects/$ProjectId/outline/lock" -Headers $AuthHeaders -Body '{}'
  if ($lock.data.outlinePlan.status -ne "locked") {
    throw "outline lock failed: $($lock.data.outlinePlan.status)"
  }
}

function Invoke-PlaywrightWriteAi {
  param(
    [string]$Name,
    [string]$GrepPattern,
    [hashtable]$ExtraEnv = @{}
  )

  $env:SMOKE_WEB_BASE_URL = $WebBaseUrl
  foreach ($key in $ExtraEnv.Keys) {
    Set-Item -Path "env:$key" -Value $ExtraEnv[$key]
  }

  Push-Location $WebDir
  try {
    $specFile = "e2e/sprint8-write-ai-flow.spec.ts"
    & npx playwright test $specFile --grep $GrepPattern 2>&1 | ForEach-Object { Write-Host $_ }
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

$playwrightPkg = Join-Path $WebDir "node_modules\@playwright\test"
$playwrightHoisted = Join-Path $RepoRoot "node_modules\@playwright\test"
if (-not (Test-Path $playwrightPkg) -and -not (Test-Path $playwrightHoisted)) {
  Add-StepResult "playwright dependency" "FAIL" "Run: npm install from repo root"
  $Results | Format-Table -AutoSize
  exit 1
}
$pwSource = if (Test-Path $playwrightPkg) { "apps/web" } else { "root (hoisted)" }
Add-StepResult "playwright dependency" "PASS" $pwSource

if (-not (Test-WebServerReachable $WebBaseUrl)) {
  Add-StepResult "web dev server reachable" "FAIL" "Start: npm run dev:web ($WebBaseUrl)"
  $Results | Format-Table -AutoSize
  exit 1
}
Add-StepResult "web dev server reachable" "PASS" $WebBaseUrl

$anyFail = $false

if (-not $SkipMockMode) {
  $mockOk = Invoke-PlaywrightWriteAi -Name "mock-mode Playwright (write AI)" -GrepPattern "write AI mock mode"
  if (-not $mockOk) { $anyFail = $true }
} else {
  Add-StepResult "mock-mode Playwright" "SKIP" "-SkipMockMode"
}

if ($IncludeApiMode) {
  $apiHealthy = $false
  try {
    $health = Invoke-RestMethod "$ApiBaseUrl/api/health" -TimeoutSec 8
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
    Add-StepResult "API-mode Playwright (write AI)" "NOT RUN" "missing anon key"
    $anyFail = $true
  } else {
    Add-StepResult "resolve Supabase anon key" "PASS" "source=env|cli"

    if ([string]::IsNullOrWhiteSpace($TestEmail)) {
      $TestEmail = "s8writeai-$(Get-Random -Maximum 99999999)@example.com"
    }

    $token = $null
    $projectId = $null
    $userId = $null
    $aiEnabled = $false
    try {
      $signup = Invoke-RestMethod `
        -Uri "$SupabaseUrl/auth/v1/signup" `
        -Method POST `
        -Headers @{ apikey = $anonKey; Authorization = "Bearer $anonKey" } `
        -ContentType "application/json" `
        -Body (@{ email = $TestEmail; password = $TestPassword } | ConvertTo-Json)
      $token = $signup.access_token
      $userId = $signup.user.id
      if (-not $token) {
        $signin = Invoke-RestMethod `
          -Uri "$SupabaseUrl/auth/v1/token?grant_type=password" `
          -Method POST `
          -Headers @{ apikey = $anonKey; Authorization = "Bearer $anonKey" } `
          -ContentType "application/json" `
          -Body (@{ email = $TestEmail; password = $TestPassword } | ConvertTo-Json)
        $token = $signin.access_token
        $userId = $signin.user.id
      }
      Add-StepResult "API-mode signup/login" $(if ($token) { "PASS" } else { "FAIL" }) "email=$TestEmail"
    } catch {
      Add-StepResult "API-mode signup/login" "FAIL" $_.Exception.Message
    }

    if ($token -and $apiHealthy) {
      try {
        $auth = @{ Authorization = "Bearer $token" }
        $created = Invoke-ApiRequest -Method POST -Path "/api/projects" -Headers $auth `
          -Body '{"title":"S8 Write AI Web Smoke","entryPath":"rough_idea"}'
        $projectId = $created.data.id
        Add-StepResult "API-mode create project" "PASS" "projectId=$projectId"
        Bootstrap-FoundationLocked -ProjectId $projectId -AuthHeaders $auth
        Add-StepResult "API-mode bootstrap foundation locked" "PASS" ""
        Bootstrap-OutlineLocked -ProjectId $projectId -AuthHeaders $auth
        Add-StepResult "API-mode bootstrap outline locked" "PASS" "ready for write"
        if ($userId) {
          Seed-CreditBalance -UserId $userId -Balance 100 | Out-Null
          Add-StepResult "seed credit balance" "PASS" "balance=100"
        } else {
          Add-StepResult "seed credit balance" "SKIP" "user id unavailable"
        }
        $aiEnabled = Test-AiGenerationEnabled -ProjectId $projectId -AuthHeaders $auth
        Add-StepResult "probe AI generation enabled" $(if ($aiEnabled) { "PASS" } else { "PASS" }) $(if ($aiEnabled) { "enabled" } else { "disabled (default)" })
      } catch {
        Add-StepResult "API-mode bootstrap" "FAIL" $_.Exception.Message
        $projectId = $null
      }
    }

    if ($token -and $projectId) {
      Write-Host ""
      Write-Host "API mode requires web dev server with VITE_USE_MOCKS=false" -ForegroundColor Yellow
      Write-Host "  Restart npm run dev:web after changing apps/web/.env.local" -ForegroundColor Yellow
      if (-not $aiEnabled) {
        Write-Host "  AI disabled test runs by default. For success path:" -ForegroundColor Yellow
        Write-Host "  Restart dev:api with AI_GENERATION_ENABLED=true and AI_PROVIDER_MOCK=true" -ForegroundColor Yellow
      }
      Write-Host ""

      $apiEnv = @{
        SMOKE_WEB_API_MODE  = "true"
        SMOKE_TEST_EMAIL    = $TestEmail
        SMOKE_TEST_PASSWORD = $TestPassword
        SMOKE_PROJECT_ID    = $projectId
        SMOKE_AI_ENABLED    = $(if ($aiEnabled) { "true" } else { "false" })
      }

      $creditUiOk = Invoke-PlaywrightWriteAi -Name "API-mode Playwright (credit UI labels)" -GrepPattern "API mode shows credit balance" -ExtraEnv $apiEnv
      if (-not $creditUiOk) { $anyFail = $true }

      if ($aiEnabled) {
        $successOk = Invoke-PlaywrightWriteAi -Name "API-mode Playwright (AI mock prose success)" -GrepPattern "AI enabled inserts mock prose" -ExtraEnv $apiEnv
        if (-not $successOk) { $anyFail = $true }
        Add-StepResult "API-mode Playwright (AI disabled safe msg)" "SKIP" "AI enabled - disabled test N/A"
      } else {
        $disabledOk = Invoke-PlaywrightWriteAi -Name "API-mode Playwright (AI disabled safe msg)" -GrepPattern "AI disabled shows safe" -ExtraEnv $apiEnv
        if (-not $disabledOk) { $anyFail = $true }
        Add-StepResult "API-mode Playwright (AI mock prose success)" "SKIP" "AI_GENERATION_ENABLED=false"
      }
    } else {
      Add-StepResult "API-mode Playwright (write AI)" "NOT RUN" "signup, API health, or bootstrap failed"
      $anyFail = $true
    }
  }
} else {
  Add-StepResult "API-mode Playwright (write AI)" "NOT RUN" "use -IncludeApiMode"
}

Write-Host ""
$Results | Format-Table Step, Test, Result, Detail -AutoSize

$failCount = @($Results | Where-Object { $_.Result -eq "FAIL" }).Count
$passCount = @($Results | Where-Object { $_.Result -eq "PASS" }).Count
$notRunCount = @($Results | Where-Object { $_.Result -eq "NOT RUN" }).Count
Write-Host "Summary: $passCount PASS, $failCount FAIL, $notRunCount NOT RUN" -ForegroundColor $(if ($failCount -gt 0) { "Red" } else { "Green" })

Write-Host ""
Write-Host "CI note: write AI API-mode E2E deferred from GitHub Actions (browser + Supabase + dual env)." -ForegroundColor DarkGray

if ($failCount -gt 0) { exit 1 }
exit 0