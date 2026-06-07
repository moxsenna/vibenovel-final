<#
.SYNOPSIS
  Sprint 4 outline API smoke test for local VibeNovel development.

.DESCRIPTION
  Exercises outline bundle, generate, chapter PATCH, open-loop/reveal CRUD,
  approve/lock workflow, planningTruth redaction, canon guardrails, and
  cross-user 404 against a running API Worker and local Supabase Auth.

  Run from repo root:
    powershell -ExecutionPolicy Bypass -File scripts/sprint4-smoke-api.ps1

  Prerequisites:
    - Docker Desktop + Supabase CLI (`supabase start`, `supabase db reset`)
    - API dev server (`npm run dev:api` → default http://127.0.0.1:8787)

  Security:
    - Does not print full JWT/access tokens
    - Does not require service role key
    - Exit code 1 when any step fails
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
$tokenB = $null
$projectId = $null
$chapterId = $null
$loopId = $null
$revealId = $null
$auth = @{}

function Write-SmokeHeader {
  Write-Host ""
  Write-Host "VibeNovel Sprint 4 Outline API Smoke Test" -ForegroundColor Cyan
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
    [ValidateSet("PASS", "FAIL", "SKIP", "NOT RUN")]
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
    "NOT RUN" { "DarkYellow" }
  }
  Write-Host ("[{0}] {1,-42} {2}" -f $Result, $Name, $safeDetail) -ForegroundColor $color
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
  throw "Supabase anon key not found."
}

function Invoke-Api {
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

function Invoke-ApiExpectFailure {
  param(
    [string]$Name,
    [string]$Method = "GET",
    [string]$Path,
    [hashtable]$Headers = @{},
    [string]$Body = $null,
    [int[]]$ExpectedStatus = @(400, 401, 404, 409)
  )
  try {
    Invoke-Api -Method $Method -Path $Path -Headers $Headers -Body $Body | Out-Null
    Add-StepResult $Name "FAIL" "expected HTTP $($ExpectedStatus -join '|'), got 2xx"
    return $null
  } catch {
    $detail = $_.Exception.Message
    if ($null -ne $_.ErrorDetails -and $null -ne $_.ErrorDetails.PSObject.Properties["Message"]) {
      $detail = [string]$_.ErrorDetails.Message
    }
    Add-StepResult $Name "PASS" (Get-SafeDetail $detail)
    return $detail
  }
}

function Get-AuthToken {
  param([string]$Email)
  $signup = Invoke-RestMethod `
    -Uri "$SupabaseUrl/auth/v1/signup" `
    -Method POST `
    -Headers @{ apikey = $anonKey; Authorization = "Bearer $anonKey" } `
    -ContentType "application/json" `
    -Body (@{ email = $Email; password = $TestPassword } | ConvertTo-Json)
  $t = $signup.access_token
  if (-not $t) {
    $signin = Invoke-RestMethod `
      -Uri "$SupabaseUrl/auth/v1/token?grant_type=password" `
      -Method POST `
      -Headers @{ apikey = $anonKey; Authorization = "Bearer $anonKey" } `
      -ContentType "application/json" `
      -Body (@{ email = $Email; password = $TestPassword } | ConvertTo-Json)
    $t = $signin.access_token
  }
  return $t
}

function Bootstrap-FoundationLocked {
  param([string]$ProjectId)
  Invoke-Api -Method POST -Path "/api/projects/$ProjectId/intake/messages" -Headers $auth `
    -Body '{"content":"Cerita drama rumah tangga dengan konflik keluarga dan rahasia masa lalu."}' | Out-Null
  Invoke-Api -Method POST -Path "/api/projects/$ProjectId/intake/extract-signals" -Headers $auth -Body '{}' | Out-Null
  $concepts = Invoke-Api -Method POST -Path "/api/projects/$ProjectId/concepts/generate" -Headers $auth -Body '{}'
  $conceptId = $concepts.data.concepts[0].id
  Invoke-Api -Method POST -Path "/api/projects/$ProjectId/concepts/$conceptId/select" -Headers $auth -Body '{}' | Out-Null
  $proposals = Invoke-Api -Method POST -Path "/api/projects/$ProjectId/foundation/proposals/generate" -Headers $auth -Body '{}'
  foreach ($p in $proposals.data.proposals) {
    if ($p.type -in @('foundation', 'character', 'fact', 'relationship_speech_rule', 'style')) {
      Invoke-Api -Method POST -Path "/api/projects/$ProjectId/proposals/$($p.id)/accept" -Headers $auth -Body '{}' | Out-Null
    }
  }
  Invoke-Api -Method POST -Path "/api/projects/$ProjectId/foundation/lock" -Headers $auth -Body '{}' | Out-Null
}

Write-SmokeHeader

try {
  $anonKey = Resolve-SupabaseAnonKey
  Add-StepResult "resolve anon key" "PASS" "source=env|cli"
} catch {
  Add-StepResult "resolve anon key" "FAIL" $_.Exception.Message
  $Results | Format-Table -AutoSize
  exit 1
}

if ([string]::IsNullOrWhiteSpace($TestEmail)) {
  $TestEmail = "s4smoke-$(Get-Random -Maximum 99999999)@example.com"
}

# --- Auth ---
try {
  $token = Get-AuthToken -Email $TestEmail
  Add-StepResult "signup/login user A" $(if ($token) { "PASS" } else { "FAIL" }) "email=$TestEmail"
} catch {
  Add-StepResult "signup/login user A" "FAIL" $_.Exception.Message
}

if (-not $token) {
  $Results | Format-Table Step, Test, Result, Detail -AutoSize
  exit 1
}

$auth = @{ Authorization = "Bearer $token" }

# --- Create project ---
try {
  $created = Invoke-Api -Method POST -Path "/api/projects" -Headers $auth `
    -Body '{"title":"S4 Outline Smoke","entryPath":"rough_idea"}'
  $projectId = $created.data.id
  Add-StepResult "POST /api/projects" "PASS" "projectId=$projectId"
} catch {
  Add-StepResult "POST /api/projects" "FAIL" $_.Exception.Message
  $Results | Format-Table -AutoSize
  exit 1
}

# --- GET outline no token ---
Invoke-ApiExpectFailure -Name "GET outline no token" -Path "/api/projects/$projectId/outline" -ExpectedStatus @(401)

# --- Generate without locked foundation ---
Invoke-ApiExpectFailure -Name "POST generate without locked foundation" `
  -Method POST -Path "/api/projects/$projectId/outline/generate" -Headers $auth -Body '{}' -ExpectedStatus @(409)

# --- Bootstrap foundation locked ---
try {
  Bootstrap-FoundationLocked -ProjectId $projectId
  Add-StepResult "bootstrap foundation locked" "PASS" "isLocked expected"
} catch {
  Add-StepResult "bootstrap foundation locked" "FAIL" $_.Exception.Message
  $Results | Format-Table -AutoSize
  exit 1
}

# --- Canon snapshot after lock, before generate ---
$factsBeforeGen = 0
$charsBeforeGen = 0
try {
  $foundationPreGen = Invoke-Api -Method GET -Path "/api/projects/$projectId/foundation" -Headers $auth
  $factsBeforeGen = $foundationPreGen.data.facts.Count
  $charsBeforeGen = $foundationPreGen.data.characters.Count
} catch {
  # ok
}

# --- Generate outline ---
try {
  $gen = Invoke-Api -Method POST -Path "/api/projects/$projectId/outline/generate" -Headers $auth -Body '{}'
  $chCount = $gen.data.chapterOutlines.Count
  $loopCount = $gen.data.openLoops.Count
  $revealCount = $gen.data.plannedReveals.Count
  $chapterId = $gen.data.chapterOutlines[0].id
  $ok = ($chCount -eq 10 -and $loopCount -eq 3 -and $revealCount -eq 3)
  Add-StepResult "POST generate after foundation locked" $(if ($ok) { "PASS" } else { "FAIL" }) `
    "chapters=$chCount loops=$loopCount reveals=$revealCount"
} catch {
  Add-StepResult "POST generate after foundation locked" "FAIL" $_.Exception.Message
}

# --- planningTruth redacted ---
try {
  $bundle = Invoke-Api -Method GET -Path "/api/projects/$projectId/outline" -Headers $auth
  $json = $bundle | ConvertTo-Json -Depth 12
  $hasRawTruth = $json -match '"planningTruth"\s*:'
  $redacted = [bool]$bundle.data.planningTruthRedacted
  Add-StepResult "planningTruth redacted in GET bundle" $(if (-not $hasRawTruth -and $redacted) { "PASS" } else { "FAIL" }) `
    "planningTruthRedacted=$redacted"
} catch {
  Add-StepResult "planningTruth redacted in GET bundle" "FAIL" $_.Exception.Message
}

# --- Canon unchanged ---
try {
  $foundationAfter = Invoke-Api -Method GET -Path "/api/projects/$projectId/foundation" -Headers $auth
  $factsAfter = $foundationAfter.data.facts.Count
  $charsAfter = $foundationAfter.data.characters.Count
  $ok = ($factsAfter -eq $factsBeforeGen -and $charsAfter -eq $charsBeforeGen)
  Add-StepResult "canon counts unchanged post-generate" $(if ($ok) { "PASS" } else { "FAIL" }) `
    "facts=$factsBeforeGen->$factsAfter chars=$charsBeforeGen->$charsAfter"
} catch {
  Add-StepResult "canon counts unchanged post-generate" "FAIL" $_.Exception.Message
}

# --- PATCH chapter valid ---
try {
  $patched = Invoke-Api -Method PATCH -Path "/api/projects/$projectId/outline/chapters/$chapterId" -Headers $auth `
    -Body '{"title":"Bab 1 Smoke Edit","summary":"Ringkasan diperbarui smoke test."}'
  $ok = $patched.data.title -eq "Bab 1 Smoke Edit"
  Add-StepResult "PATCH chapter valid" $(if ($ok) { "PASS" } else { "FAIL" }) "title=$($patched.data.title)"
} catch {
  Add-StepResult "PATCH chapter valid" "FAIL" $_.Exception.Message
}

# --- PATCH chapterText / planningTruth rejected ---
Invoke-ApiExpectFailure -Name "PATCH chapterText rejected" -Method PATCH `
  -Path "/api/projects/$projectId/outline/chapters/$chapterId" -Headers $auth `
  -Body '{"chapterText":"prose tidak boleh"}' -ExpectedStatus @(400)

Invoke-ApiExpectFailure -Name "PATCH planningTruth rejected" -Method PATCH `
  -Path "/api/projects/$projectId/outline/chapters/$chapterId" -Headers $auth `
  -Body '{"planningTruth":"rahasia internal"}' -ExpectedStatus @(400)

# --- CRUD open loops ---
try {
  $loop = Invoke-Api -Method POST -Path "/api/projects/$projectId/outline/open-loops" -Headers $auth `
    -Body '{"question":"Siapa yang mengirim pesan anonim?","readerFacingHint":"Petunjuk aman."}'
  $loopId = $loop.data.id
  Invoke-Api -Method DELETE -Path "/api/projects/$projectId/outline/open-loops/$loopId" -Headers $auth | Out-Null
  $loops = Invoke-Api -Method GET -Path "/api/projects/$projectId/outline/open-loops" -Headers $auth
  $dropped = $loops.data.openLoops | Where-Object { $_.id -eq $loopId -and $_.status -eq 'dropped' }
  Add-StepResult "CRUD open loops soft dropped" $(if ($dropped) { "PASS" } else { "FAIL" }) "loopId=$loopId"
} catch {
  Add-StepResult "CRUD open loops soft dropped" "FAIL" $_.Exception.Message
}

# --- CRUD reveals ---
try {
  $rev = Invoke-Api -Method POST -Path "/api/projects/$projectId/outline/reveals" -Headers $auth `
    -Body '{"title":"Rahasia Smoke","planningTruth":"INTERNAL TRUTH NOT RETURNED","readerFacingHint":"Hint aman"}'
  $revealId = $rev.data.id
  $hasTruthInCreate = ($rev | ConvertTo-Json -Depth 8) -match '"planningTruth"\s*:'
  $deleted = Invoke-Api -Method DELETE -Path "/api/projects/$projectId/outline/reveals/$revealId" -Headers $auth
  $ok = (-not $hasTruthInCreate) -and ($deleted.data.status -eq 'cancelled')
  Add-StepResult "CRUD reveals soft cancelled redacted" $(if ($ok) { "PASS" } else { "FAIL" }) `
    "revealId=$revealId status=$($deleted.data.status)"
} catch {
  Add-StepResult "CRUD reveals soft cancelled redacted" "FAIL" $_.Exception.Message
}

# --- Approve outline ---
try {
  $approve = Invoke-Api -Method POST -Path "/api/projects/$projectId/outline/approve" -Headers $auth -Body '{}'
  $ok = $approve.data.outlinePlan.status -eq 'reviewing'
  Add-StepResult "POST approve outline" $(if ($ok) { "PASS" } else { "FAIL" }) "status=$($approve.data.outlinePlan.status)"
} catch {
  Add-StepResult "POST approve outline" "FAIL" $_.Exception.Message
}

# --- Lock outline ---
try {
  $lock = Invoke-Api -Method POST -Path "/api/projects/$projectId/outline/lock" -Headers $auth -Body '{}'
  $planLocked = $lock.data.outlinePlan.status -eq 'locked'
  $chapterList = @($lock.data.chapters)
  $unlockedCount = @($chapterList | Where-Object { $_.status -ne 'locked' }).Length
  $allChLocked = $unlockedCount -eq 0
  Add-StepResult "POST lock outline" $(if ($planLocked -and $allChLocked) { "PASS" } else { "FAIL" }) `
    "plan=$($lock.data.outlinePlan.status) chapters=$($chapterList.Length)"
} catch {
  Add-StepResult "POST lock outline" "FAIL" $_.Exception.Message
}

# --- workflow_phase ---
try {
  $proj = Invoke-Api -Method GET -Path "/api/projects/$projectId" -Headers $auth
  $ok = $proj.data.workflowPhase -eq 'outline_locked'
  Add-StepResult "workflow_phase outline_locked" $(if ($ok) { "PASS" } else { "FAIL" }) `
    "phase=$($proj.data.workflowPhase)"
} catch {
  Add-StepResult "workflow_phase outline_locked" "FAIL" $_.Exception.Message
}

# --- GET after locked ---
try {
  $lockedBundle = Invoke-Api -Method GET -Path "/api/projects/$projectId/outline" -Headers $auth
  $json = $lockedBundle | ConvertTo-Json -Depth 12
  $ok = ($lockedBundle.data.outlinePlan.status -eq 'locked') -and ($json -notmatch '"planningTruth"\s*:')
  Add-StepResult "GET after locked redacted" $(if ($ok) { "PASS" } else { "FAIL" }) "status=$($lockedBundle.data.outlinePlan.status)"
} catch {
  Add-StepResult "GET after locked redacted" "FAIL" $_.Exception.Message
}

# --- PATCH chapter when locked ---
Invoke-ApiExpectFailure -Name "PATCH chapter when locked" -Method PATCH `
  -Path "/api/projects/$projectId/outline/chapters/$chapterId" -Headers $auth `
  -Body '{"title":"Should fail"}' -ExpectedStatus @(409)

# --- Cross-user 404 ---
try {
  $emailB = "s4smoke-b-$(Get-Random -Maximum 99999999)@example.com"
  $tokenB = Get-AuthToken -Email $emailB
  $authB = @{ Authorization = "Bearer $tokenB" }
  Invoke-ApiExpectFailure -Name "cross-user outline 404" -Path "/api/projects/$projectId/outline" `
    -Headers $authB -ExpectedStatus @(404)
} catch {
  Add-StepResult "cross-user outline 404" "FAIL" $_.Exception.Message
}

# --- Summary ---
Write-Host ""
$passCount = @($Results | Where-Object { $_.Result -eq "PASS" }).Length
$failCount = @($Results | Where-Object { $_.Result -eq "FAIL" }).Length
$Results | Format-Table Step, Test, Result, Detail -AutoSize
Write-Host ""
Write-Host "Summary: $passCount PASS, $failCount FAIL" -ForegroundColor $(if ($failCount -eq 0) { "Green" } else { "Red" })
if ($failCount -gt 0) { exit 1 }
exit 0