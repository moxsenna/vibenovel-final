<#
.SYNOPSIS
  Sprint 7 web E2E safety smoke for Publish page (/publish) — Task 7.5.

.DESCRIPTION
  Runs Playwright browser checks for publish page mock mode (default) and
  optional API mode (bootstrap through approved summary via API).

  Run from repo root:
    npm run smoke:web:publish
    npm run smoke:web:publish -- -IncludeApiMode

  Prerequisites (mock mode):
    - npm install (includes @playwright/test)
    - npx playwright install chromium  (first run only)
    - npm run dev:web with VITE_USE_MOCKS=true (default)

  Prerequisites (API mode, -IncludeApiMode):
    - supabase start && supabase db reset
    - npm run dev:api
    - apps/web/.env.local with VITE_USE_MOCKS=false + Supabase + VITE_API_URL
    - Restart dev:web after changing .env.local
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
  Write-Host "VibeNovel Sprint 7 Publish Web Smoke Test" -ForegroundColor Cyan
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
  Write-Host ("[{0}] {1,-44} {2}" -f $Result, $Name, $Detail) -ForegroundColor $color
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

function Bootstrap-FoundationLocked {
  param([string]$ProjectId, [hashtable]$AuthHeaders)
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
  param([string]$ProjectId, [hashtable]$AuthHeaders)
  Invoke-ApiRequest -Method POST -Path "/api/projects/$ProjectId/outline/generate" -Headers $AuthHeaders -Body '{}' | Out-Null
  Invoke-ApiRequest -Method POST -Path "/api/projects/$ProjectId/outline/approve" -Headers $AuthHeaders -Body '{}' | Out-Null
  $lock = Invoke-ApiRequest -Method POST -Path "/api/projects/$ProjectId/outline/lock" -Headers $AuthHeaders -Body '{}'
  if ($lock.data.outlinePlan.status -ne "locked") {
    throw "outline lock failed: $($lock.data.outlinePlan.status)"
  }
}

function Bootstrap-ApprovedSummary {
  param([string]$ProjectId, [hashtable]$AuthHeaders)
  $chapters = Invoke-ApiRequest -Path "/api/projects/$ProjectId/outline/chapters" -Headers $AuthHeaders
  $ch1 = ($chapters.data.chapters | Where-Object { $_.chapterNumber -eq 1 } | Select-Object -First 1).id

  $session = Invoke-ApiRequest -Method POST -Path "/api/projects/$ProjectId/write/sessions" -Headers $AuthHeaders `
    -Body (@{ chapterOutlineId = $ch1 } | ConvertTo-Json)
  $sessionId = $session.data.session.id

  Invoke-ApiRequest -Method POST -Path "/api/projects/$ProjectId/write/sessions/$sessionId/beats/generate" -Headers $AuthHeaders -Body '{}' | Out-Null
  $beats = Invoke-ApiRequest -Path "/api/projects/$ProjectId/write/sessions/$sessionId/beats" -Headers $AuthHeaders
  $beatId = $beats.data.beats[0].id

  Invoke-ApiRequest -Method PATCH -Path "/api/projects/$ProjectId/write/beats/$beatId" -Headers $AuthHeaders `
    -Body '{"mustInclude":["rahasia identitas keluarga tersembunyi di balik dapur"]}' | Out-Null
  Invoke-ApiRequest -Method POST -Path "/api/projects/$ProjectId/write/beats/$beatId/prose" -Headers $AuthHeaders `
    -Body '{"proseText":"Nadira memangkas sayuran di dapur dengan irama yang sudah hafal di luar kepala."}' | Out-Null
  Invoke-ApiRequest -Method POST -Path "/api/projects/$ProjectId/write/sessions/$sessionId/ready-for-summary" -Headers $AuthHeaders -Body '{}' | Out-Null

  $gen = Invoke-ApiRequest -Method POST -Path "/api/projects/$ProjectId/summary/generate" -Headers $AuthHeaders `
    -Body (@{ chapterOutlineId = $ch1; writingSessionId = $sessionId } | ConvertTo-Json)
  $summaryId = $gen.data.summary.id

  Invoke-ApiRequest -Method POST -Path "/api/projects/$ProjectId/summary/$summaryId/delta/extract" -Headers $AuthHeaders -Body '{}' | Out-Null
  $approve = Invoke-ApiRequest -Method POST -Path "/api/projects/$ProjectId/summary/$summaryId/approve" -Headers $AuthHeaders -Body '{}'
  if ($approve.data.summary.status -ne "approved") {
    throw "summary approve failed: $($approve.data.summary.status)"
  }

  return @{ ChapterOutlineId = $ch1; SummaryId = $summaryId }
}

function Invoke-PlaywrightPublish {
  param([string]$Name, [hashtable]$ExtraEnv = @{})

  $env:SMOKE_WEB_BASE_URL = $WebBaseUrl
  foreach ($key in $ExtraEnv.Keys) {
    Set-Item -Path "env:$key" -Value $ExtraEnv[$key]
  }

  Push-Location $WebDir
  try {
    $specFile = "e2e/sprint7-publish-flow.spec.ts"
    if ($ExtraEnv["SMOKE_WEB_API_MODE"] -eq "true") {
      & npx playwright test $specFile --grep "publish API mode" 2>&1 | ForEach-Object { Write-Host $_ }
    } else {
      & npx playwright test $specFile --grep "publish mock mode" 2>&1 | ForEach-Object { Write-Host $_ }
    }
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
  $mockOk = Invoke-PlaywrightPublish -Name "mock-mode Playwright (/publish)"
  if (-not $mockOk) { $anyFail = $true }
} else {
  Add-StepResult "mock-mode Playwright" "SKIP" "-SkipMockMode"
}

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
    Add-StepResult "API-mode Playwright (/publish)" "NOT RUN" "missing anon key"
    $anyFail = $true
  } else {
    Add-StepResult "resolve Supabase anon key" "PASS" "source=env|cli"

    if ([string]::IsNullOrWhiteSpace($TestEmail)) {
      $TestEmail = "s7websmoke-$(Get-Random -Maximum 99999999)@example.com"
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
        $auth = @{ Authorization = "Bearer $token" }
        $created = Invoke-ApiRequest -Method POST -Path "/api/projects" -Headers $auth `
          -Body '{"title":"S7 Publish Web Smoke","entryPath":"rough_idea"}'
        $projectId = $created.data.id
        Add-StepResult "API-mode create project" "PASS" "projectId=$projectId"
        Bootstrap-FoundationLocked -ProjectId $projectId -AuthHeaders $auth
        Add-StepResult "API-mode bootstrap foundation locked" "PASS" ""
        Bootstrap-OutlineLocked -ProjectId $projectId -AuthHeaders $auth
        Add-StepResult "API-mode bootstrap outline locked" "PASS" ""
        $summaryCtx = Bootstrap-ApprovedSummary -ProjectId $projectId -AuthHeaders $auth
        Add-StepResult "API-mode bootstrap approved summary" "PASS" "summary=$($summaryCtx.SummaryId)"
      } catch {
        Add-StepResult "API-mode bootstrap approved summary" "FAIL" $_.Exception.Message
        $projectId = $null
      }
    }

    if ($token -and $projectId) {
      Write-Host ""
      Write-Host "API mode requires web dev server with VITE_USE_MOCKS=false" -ForegroundColor Yellow
      Write-Host "  Restart npm run dev:web after changing apps/web/.env.local" -ForegroundColor Yellow
      Write-Host ""

      $apiEnv = @{
        SMOKE_WEB_API_MODE  = "true"
        SMOKE_TEST_EMAIL    = $TestEmail
        SMOKE_TEST_PASSWORD = $TestPassword
        SMOKE_PROJECT_ID    = $projectId
      }
      $apiOk = Invoke-PlaywrightPublish -Name "API-mode Playwright (/publish full flow)" -ExtraEnv $apiEnv
      if (-not $apiOk) { $anyFail = $true }
    } else {
      Add-StepResult "API-mode Playwright (/publish)" "NOT RUN" "signup, API health, or bootstrap failed"
      $anyFail = $true
    }
  }
} else {
  Add-StepResult "API-mode Playwright (/publish)" "NOT RUN" "use -IncludeApiMode"
}

Write-Host ""
$Results | Format-Table Step, Test, Result, Detail -AutoSize

$failCount = @($Results | Where-Object { $_.Result -eq "FAIL" }).Count
$passCount = @($Results | Where-Object { $_.Result -eq "PASS" }).Count
$notRunCount = @($Results | Where-Object { $_.Result -eq "NOT RUN" }).Count
Write-Host "Summary: $passCount PASS, $failCount FAIL, $notRunCount NOT RUN" -ForegroundColor $(if ($failCount -gt 0) { "Red" } else { "Green" })

Write-Host ""
Write-Host "CI note: publish API-mode E2E deferred from GitHub Actions (browser + Supabase + dual env)." -ForegroundColor DarkGray

if ($failCount -gt 0) { exit 1 }
exit 0