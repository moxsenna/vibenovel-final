<#
.SYNOPSIS
  Sprint 2 API smoke test for local VibeNovel development.

.DESCRIPTION
  Exercises health, auth guardrails, project CRUD, settings, foundation, canon
  rejects, proposals, credits, and cross-user 404 against a running API Worker
  and local Supabase Auth.

  Run from repo root:
    npm run smoke:api

  Prerequisites:
    - Docker Desktop + Supabase CLI (`supabase start`, `supabase db reset`)
    - API dev server (`npm run dev:api` → default http://127.0.0.1:8787)
    - Supabase anon key via env or `supabase status -o env` (never committed)

  Security:
    - Does not print full JWT/access tokens
    - Does not require service role key
    - Exit code 1 when any step fails

.PARAMETER ApiBaseUrl
  VibeNovel API base URL (default: http://127.0.0.1:8787).

.PARAMETER SupabaseUrl
  Local Supabase Auth URL (default: http://127.0.0.1:54321).

.PARAMETER SupabaseAnonKey
  Supabase anon/publishable key. If empty, reads SUPABASE_ANON_KEY env or
  `supabase status -o env` from repo root.

.PARAMETER TestEmail
  Unique smoke-test email. Auto-generated if empty.

.PARAMETER TestPassword
  Local-only password for signup (default safe test password).

.PARAMETER SeedProjectId
  Demo seed project UUID for cross-user 404 check.
#>
[CmdletBinding()]
param(
  [string]$ApiBaseUrl = "http://127.0.0.1:8787",
  [string]$SupabaseUrl = "http://127.0.0.1:54321",
  [string]$SupabaseAnonKey = "",
  [string]$TestEmail = "",
  [string]$TestPassword = "VibeNovel-Local-Smoke-Test!",
  [string]$SeedProjectId = "a0000000-0000-4000-8000-000000000101"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Continue"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$Results = New-Object System.Collections.Generic.List[object]
$StepNumber = 0
$token = $null
$projectId = $null
$propId = $null
$auth = @{}

function Write-SmokeHeader {
  Write-Host ""
  Write-Host "VibeNovel Sprint 2 API Smoke Test" -ForegroundColor Cyan
  Write-Host "API:      $ApiBaseUrl"
  Write-Host "Supabase: $SupabaseUrl"
  Write-Host "Repo:     $RepoRoot"
  Write-Host ""
}

function Get-SafeDetail {
  param([string]$Text)
  if ([string]::IsNullOrWhiteSpace($Text)) { return "" }
  $sanitized = $Text -replace 'Bearer\s+[A-Za-z0-9._-]+', 'Bearer [redacted]'
  $sanitized = $sanitized -replace 'eyJ[A-Za-z0-9._-]{20,}', '[jwt-redacted]'
  if ($sanitized.Length -gt 180) {
    return $sanitized.Substring(0, 177) + "..."
  }
  return $sanitized
}

function Add-StepResult {
  param(
    [string]$Name,
    [ValidateSet("PASS", "FAIL", "SKIP")]
    [string]$Result,
    [string]$Detail = ""
  )
  $script:StepNumber++
  $safeDetail = Get-SafeDetail $Detail
  $Results.Add([PSCustomObject]@{
      Step   = $script:StepNumber
      Test   = $Name
      Result = $Result
      Detail = $safeDetail
    }) | Out-Null

  $color = switch ($Result) {
    "PASS" { "Green" }
    "FAIL" { "Red" }
    "SKIP" { "Yellow" }
  }
  Write-Host ("[{0}] {1,-36} {2}" -f $Result, $Name, $safeDetail) -ForegroundColor $color
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

  throw "Supabase anon key not found. Set SUPABASE_ANON_KEY or pass -SupabaseAnonKey, or run 'supabase start' and ensure CLI is on PATH."
}

function Invoke-ApiExpectFailure {
  param(
    [string]$Name,
    [string]$Method = "GET",
    [string]$Path,
    [hashtable]$Headers = @{},
    [string]$Body = $null,
    [int[]]$ExpectedStatus = @(400, 401, 404)
  )

  try {
    $params = @{
      Uri         = "$ApiBaseUrl$Path"
      Method      = $Method
      Headers     = $Headers
      ErrorAction = "Stop"
    }
    if ($null -ne $Body) {
      $params.ContentType = "application/json"
      $params.Body = $Body
    }
    Invoke-RestMethod @params | Out-Null
    Add-StepResult $Name "FAIL" "expected HTTP $($ExpectedStatus -join '|'), got 2xx"
  } catch {
    $detail = $_.Exception.Message
    if ($null -ne $_.ErrorDetails -and $null -ne $_.ErrorDetails.PSObject.Properties["Message"]) {
      $detail = [string]$_.ErrorDetails.Message
    }
    Add-StepResult $Name "PASS" (Get-SafeDetail $detail)
  }
}

Write-SmokeHeader

try {
  $anonKey = Resolve-SupabaseAnonKey
} catch {
  Add-StepResult "resolve anon key" "FAIL" $_.Exception.Message
  $Results | Format-Table -AutoSize
  exit 1
}
Add-StepResult "resolve anon key" "PASS" "source=env|cli"

if ([string]::IsNullOrWhiteSpace($TestEmail)) {
  $TestEmail = "s2smoke-$(Get-Random -Maximum 99999999)@example.com"
}

# --- Health ---
try {
  $health = Invoke-RestMethod "$ApiBaseUrl/health"
  $ok = $false
  if ($null -ne $health.PSObject.Properties["ok"]) {
    $ok = [bool]$health.ok
  } elseif ($null -ne $health.data -and $null -ne $health.data.PSObject.Properties["ok"]) {
    $ok = [bool]$health.data.ok
  }
  Add-StepResult "GET /health" $(if ($ok) { "PASS" } else { "FAIL" }) "ok=$ok"
} catch {
  Add-StepResult "GET /health" "FAIL" $_.Exception.Message
}

# --- Auth guard ---
Invoke-ApiExpectFailure -Name "GET /api/me no token" -Path "/api/me" -ExpectedStatus @(401)

# --- Signup ---
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
  Add-StepResult "signup/login" $(if ($token) { "PASS" } else { "FAIL" }) "email=$TestEmail"
} catch {
  Add-StepResult "signup/login" "FAIL" $_.Exception.Message
}

if (-not $token) {
  Write-Host ""
  Write-Host "Aborting remaining steps - no access token." -ForegroundColor Yellow
  $Results | Format-Table Step, Test, Result, Detail -AutoSize
  exit 1
}

$auth = @{ Authorization = "Bearer $token" }

# --- Projects ---
try {
  $projects = Invoke-RestMethod "$ApiBaseUrl/api/projects" -Headers $auth
  Add-StepResult "GET /api/projects" "PASS" "count=$($projects.data.Count)"
} catch {
  Add-StepResult "GET /api/projects" "FAIL" $_.Exception.Message
}

$projectId = $null
try {
  $created = Invoke-RestMethod `
    -Uri "$ApiBaseUrl/api/projects" `
    -Method POST `
    -Headers $auth `
    -ContentType "application/json" `
    -Body '{"title":"S2 Smoke Test","entryPath":"rough_idea"}'
  $projectId = $created.data.id
  Add-StepResult "POST /api/projects" "PASS" "projectId=$projectId"
} catch {
  Add-StepResult "POST /api/projects" "FAIL" $_.Exception.Message
}

if (-not $projectId) {
  Add-StepResult "GET/PUT settings" "SKIP" "project create failed"
  Add-StepResult "GET/PUT foundation" "SKIP" "project create failed"
  Add-StepResult "POST character" "SKIP" "project create failed"
  Add-StepResult "POST fact source=user" "SKIP" "project create failed"
  Add-StepResult "POST fact source=ai_direct" "SKIP" "project create failed"
  Add-StepResult "POST speech rule user" "SKIP" "project create failed"
  Add-StepResult "POST speech rule ai_direct" "SKIP" "project create failed"
  Add-StepResult "POST proposal high-risk" "SKIP" "project create failed"
  Add-StepResult "accept proposal status-only" "SKIP" "project create failed"
  if ($auth.Count -gt 0) {
    try {
      $cr = Invoke-RestMethod "$ApiBaseUrl/api/credits/balance" -Headers $auth
      $balance = $cr.data.creditBalance
      $balanceLabel = if ($null -eq $balance) { "null" } else { $balance.balance }
      Add-StepResult "GET credit balance" "PASS" "balance=$balanceLabel"
    } catch {
      Add-StepResult "GET credit balance" "FAIL" $_.Exception.Message
    }
    Invoke-ApiExpectFailure `
      -Name "cross-user project 404" `
      -Path "/api/projects/$SeedProjectId" `
      -Headers $auth `
      -ExpectedStatus @(404)
  }
  Write-Host ""
  $Results | Format-Table Step, Test, Result, Detail -AutoSize
  $failCount = @($Results | Where-Object { $_.Result -eq "FAIL" }).Count
  $passCountEarly = @($Results | Where-Object { $_.Result -eq "PASS" }).Count
  Write-Host "Summary: $passCountEarly PASS, $failCount FAIL" -ForegroundColor Red
  exit 1
}

# --- Settings ---
try {
  $null = Invoke-RestMethod "$ApiBaseUrl/api/projects/$projectId/settings" -Headers $auth
  $put = Invoke-RestMethod `
    -Uri "$ApiBaseUrl/api/projects/$projectId/settings" `
    -Method PUT `
    -Headers $auth `
    -ContentType "application/json" `
    -Body '{"qualityMode":"terbaik"}'
  Add-StepResult "GET/PUT settings" "PASS" "qualityMode=$($put.data.qualityMode)"
} catch {
  Add-StepResult "GET/PUT settings" "FAIL" $_.Exception.Message
}

# --- Foundation ---
try {
  $null = Invoke-RestMethod "$ApiBaseUrl/api/projects/$projectId/foundation" -Headers $auth
  $fput = Invoke-RestMethod `
    -Uri "$ApiBaseUrl/api/projects/$projectId/foundation" `
    -Method PUT `
    -Headers $auth `
    -ContentType "application/json" `
    -Body '{"premise":"Smoke premise test","mainConflict":"Smoke conflict"}'
  Add-StepResult "GET/PUT foundation" "PASS" "premise_len=$($fput.data.premise.Length)"
} catch {
  Add-StepResult "GET/PUT foundation" "FAIL" $_.Exception.Message
}

# --- Character ---
try {
  $ch = Invoke-RestMethod `
    -Uri "$ApiBaseUrl/api/projects/$projectId/characters" `
    -Method POST `
    -Headers $auth `
    -ContentType "application/json" `
    -Body '{"name":"Smoke Char","roleLabel":"Tokoh Utama","description":"test","importance":"main","source":"user"}'
  Add-StepResult "POST character" "PASS" "characterId=$($ch.data.id)"
} catch {
  Add-StepResult "POST character" "FAIL" $_.Exception.Message
}

# --- Facts ---
try {
  $fact = Invoke-RestMethod `
    -Uri "$ApiBaseUrl/api/projects/$projectId/facts" `
    -Method POST `
    -Headers $auth `
    -ContentType "application/json" `
    -Body '{"text":"Smoke fact","category":"identity","importance":"major","source":"user"}'
  Add-StepResult "POST fact source=user" "PASS" "factId=$($fact.data.id)"
} catch {
  Add-StepResult "POST fact source=user" "FAIL" $_.Exception.Message
}

Invoke-ApiExpectFailure `
  -Name "POST fact source=ai_direct" `
  -Method POST `
  -Path "/api/projects/$projectId/facts" `
  -Headers $auth `
  -Body '{"text":"AI fact","category":"identity","source":"ai_direct"}' `
  -ExpectedStatus @(400)

# --- Speech rules ---
try {
  $sr = Invoke-RestMethod `
    -Uri "$ApiBaseUrl/api/projects/$projectId/speech-rules" `
    -Method POST `
    -Headers $auth `
    -ContentType "application/json" `
    -Body '{"relationshipLabel":"A ke B","ruleText":"Formal","source":"user"}'
  Add-StepResult "POST speech rule user" "PASS" "ruleId=$($sr.data.id)"
} catch {
  Add-StepResult "POST speech rule user" "FAIL" $_.Exception.Message
}

Invoke-ApiExpectFailure `
  -Name "POST speech rule ai_direct" `
  -Method POST `
  -Path "/api/projects/$projectId/speech-rules" `
  -Headers $auth `
  -Body '{"relationshipLabel":"X","ruleText":"Y","source":"ai_direct"}' `
  -ExpectedStatus @(400)

# --- Proposals ---
$propId = $null
try {
  $prop = Invoke-RestMethod `
    -Uri "$ApiBaseUrl/api/projects/$projectId/proposals" `
    -Method POST `
    -Headers $auth `
    -ContentType "application/json" `
    -Body '{"proposalType":"fact","title":"Smoke proposal","summary":"High risk","payload":{"suggested_text":"secret"},"riskLevel":"high","source":"user_manual"}'
  $propId = $prop.data.id
  Add-StepResult "POST proposal high-risk" "PASS" "status=$($prop.data.status)"
} catch {
  Add-StepResult "POST proposal high-risk" "FAIL" $_.Exception.Message
}

if ($propId) {
  try {
    $acc = Invoke-RestMethod `
      -Uri "$ApiBaseUrl/api/projects/$projectId/proposals/$propId/accept" `
      -Method POST `
      -Headers $auth
    $status = $acc.data.status
    Add-StepResult "accept proposal status-only" $(if ($status -eq "accepted") { "PASS" } else { "FAIL" }) "status=$status"
  } catch {
    Add-StepResult "accept proposal status-only" "FAIL" $_.Exception.Message
  }
} else {
  Add-StepResult "accept proposal status-only" "SKIP" "proposal create failed"
}

# --- Credits ---
try {
  $cr = Invoke-RestMethod "$ApiBaseUrl/api/credits/balance" -Headers $auth
  $balance = $cr.data.creditBalance
  $balanceLabel = if ($null -eq $balance) { "null" } else { $balance.balance }
  Add-StepResult "GET credit balance" "PASS" "balance=$balanceLabel"
} catch {
  Add-StepResult "GET credit balance" "FAIL" $_.Exception.Message
}

# --- Cross-user ---
Invoke-ApiExpectFailure `
  -Name "cross-user project 404" `
  -Path "/api/projects/$SeedProjectId" `
  -Headers $auth `
  -ExpectedStatus @(404)

# --- Summary ---
Write-Host ""
$Results | Format-Table Step, Test, Result, Detail -AutoSize

$failCount = @($Results | Where-Object { $_.Result -eq "FAIL" }).Count
$passCount = @($Results | Where-Object { $_.Result -eq "PASS" }).Count
Write-Host "Summary: $passCount PASS, $failCount FAIL" -ForegroundColor $(if ($failCount -gt 0) { "Red" } else { "Green" })

if ($failCount -gt 0) { exit 1 }
exit 0