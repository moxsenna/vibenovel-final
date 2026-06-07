<#
.SYNOPSIS
  Sprint 6 Chapter Summary API smoke test (Task 6.2).

.DESCRIPTION
  Run from repo root:
    powershell -ExecutionPolicy Bypass -File scripts/sprint6-smoke-api.ps1

  Prerequisites:
    - supabase start && supabase db reset
    - npm run dev:api
#>
[CmdletBinding()]
param(
  [string]$ApiBaseUrl = "http://127.0.0.1:8787",
  [string]$SupabaseUrl = "http://127.0.0.1:54321",
  [string]$SupabaseAnonKey = "",
  [string]$TestEmail = "",
  [string]$TestPassword = "VibeNovel-Local-Smoke-Test!"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Continue"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$Results = New-Object System.Collections.Generic.List[object]
$StepNumber = 0
$auth = @{}

function Add-StepResult {
  param([string]$Name, [ValidateSet("PASS", "FAIL", "SKIP", "NOT RUN")][string]$Result, [string]$Detail = "")
  $script:StepNumber++
  $Results.Add([PSCustomObject]@{ Step = $script:StepNumber; Test = $Name; Result = $Result; Detail = $Detail }) | Out-Null
  $color = if ($Result -eq "PASS") { "Green" } elseif ($Result -eq "FAIL") { "Red" } else { "Yellow" }
  Write-Host ("[{0}] {1,-48} {2}" -f $Result, $Name, $Detail) -ForegroundColor $color
}

function Resolve-SupabaseAnonKey {
  if (-not [string]::IsNullOrWhiteSpace($SupabaseAnonKey)) { return $SupabaseAnonKey.Trim() }
  if (-not [string]::IsNullOrWhiteSpace($env:SUPABASE_ANON_KEY)) { return $env:SUPABASE_ANON_KEY.Trim() }
  Push-Location $RepoRoot
  try {
    foreach ($line in (& supabase status -o env 2>$null)) {
      if ($line -match '^ANON_KEY="(.+)"\s*$') { return $Matches[1] }
    }
  } finally { Pop-Location }
  throw "Supabase anon key not found."
}

function Invoke-Api {
  param(
    [ValidateSet("GET", "POST", "PATCH", "PUT", "DELETE")][string]$Method = "GET",
    [Parameter(Mandatory)][string]$Path,
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
  param([string]$Name, [string]$Method = "GET", [string]$Path, [hashtable]$Headers = @{}, [string]$Body = $null)
  try {
    Invoke-Api -Method $Method -Path $Path -Headers $Headers -Body $Body | Out-Null
    Add-StepResult $Name "FAIL" "expected error, got 2xx"
  } catch {
    Add-StepResult $Name "PASS" ($_.Exception.Message.Substring(0, [Math]::Min(80, $_.Exception.Message.Length)))
  }
}

function Test-JsonNoLeakMarkers {
  param([string]$JsonText)
  $patterns = @(
    'packetJson', 'packet_json', '"planningTruth"\s*:', 'planning_truth',
    'full_prompt', 'openrouter', '"proseText"\s*:', '"prose_text"\s*:'
  )
  foreach ($p in $patterns) {
    if ($JsonText -match $p) { return $false }
  }
  return $true
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

Write-Host "`nVibeNovel Sprint 6 Chapter Summary API Smoke Test" -ForegroundColor Cyan

$anonKey = Resolve-SupabaseAnonKey
if ([string]::IsNullOrWhiteSpace($TestEmail)) {
  $TestEmail = "s6smoke-$(Get-Random -Maximum 99999999)@example.com"
}

try {
  $signup = Invoke-RestMethod -Uri "$SupabaseUrl/auth/v1/signup" -Method POST `
    -Headers @{ apikey = $anonKey; Authorization = "Bearer $anonKey" } -ContentType "application/json" `
    -Body (@{ email = $TestEmail; password = $TestPassword } | ConvertTo-Json)
  $token = $signup.access_token
  Add-StepResult "signup/login" $(if ($token) { "PASS" } else { "FAIL" }) "email=$TestEmail"
} catch { Add-StepResult "signup/login" "FAIL" $_.Exception.Message; exit 1 }

$auth = @{ Authorization = "Bearer $token" }

Invoke-ApiExpectFailure -Name "POST summary no token" -Method POST `
  -Path "/api/projects/00000000-0000-4000-8000-000000000001/summary/generate" `
  -Body '{"chapterOutlineId":"00000000-0000-4000-8000-000000000001"}'

$created = Invoke-Api -Method POST -Path "/api/projects" -Headers $auth -Body '{"title":"S6 Smoke","entryPath":"rough_idea"}'
$projectId = $created.data.id
Add-StepResult "POST /api/projects" "PASS" "projectId=$projectId"

Bootstrap-FoundationLocked -ProjectId $projectId
Invoke-Api -Method POST -Path "/api/projects/$projectId/outline/generate" -Headers $auth -Body '{}' | Out-Null
Invoke-Api -Method POST -Path "/api/projects/$projectId/outline/approve" -Headers $auth -Body '{}' | Out-Null
Invoke-Api -Method POST -Path "/api/projects/$projectId/outline/lock" -Headers $auth -Body '{}' | Out-Null

$chapters = Invoke-Api -Path "/api/projects/$projectId/outline/chapters" -Headers $auth
$ch1 = ($chapters.data.chapters | Where-Object { $_.chapterNumber -eq 1 } | Select-Object -First 1).id

$foundationBefore = Invoke-Api -Path "/api/projects/$projectId/foundation" -Headers $auth
$factsBefore = $foundationBefore.data.facts.Count
$charsBefore = $foundationBefore.data.characters.Count
$loopsBefore = (Invoke-Api -Path "/api/projects/$projectId/outline/open-loops" -Headers $auth).data.openLoops.Count
$revealsBefore = (Invoke-Api -Path "/api/projects/$projectId/outline/reveals" -Headers $auth).data.reveals.Count
$propResBefore = Invoke-Api -Path "/api/projects/$projectId/proposals?includeResolved=true" -Headers $auth
$proposalsBefore = if ($propResBefore.data -is [array]) { $propResBefore.data.Count } else { 0 }

$session = Invoke-Api -Method POST -Path "/api/projects/$projectId/write/sessions" -Headers $auth `
  -Body (@{ chapterOutlineId = $ch1 } | ConvertTo-Json)
$sessionId = $session.data.session.id
Invoke-Api -Method POST -Path "/api/projects/$projectId/write/sessions/$sessionId/beats/generate" -Headers $auth -Body '{}' | Out-Null
$beats = Invoke-Api -Path "/api/projects/$projectId/write/sessions/$sessionId/beats" -Headers $auth
$beatId = $beats.data.beats[0].id

Invoke-ApiExpectFailure -Name "generate before ready_for_summary" -Method POST -Headers $auth `
  -Path "/api/projects/$projectId/summary/generate" `
  -Body (@{ chapterOutlineId = $ch1 } | ConvertTo-Json)

Invoke-Api -Method POST -Path "/api/projects/$projectId/write/beats/$beatId/prose" -Headers $auth `
  -Body '{"proseText":"Nadira memangkas sayuran di dapur dengan irama yang sudah hafal di luar kepala."}' | Out-Null

Invoke-Api -Method POST -Path "/api/projects/$projectId/write/sessions/$sessionId/ready-for-summary" -Headers $auth -Body '{}' | Out-Null

$gen = Invoke-Api -Method POST -Path "/api/projects/$projectId/summary/generate" -Headers $auth `
  -Body (@{ chapterOutlineId = $ch1; writingSessionId = $sessionId } | ConvertTo-Json)
$summaryId = $gen.data.summary.id
Add-StepResult "POST summary generate" $(if ($gen.data.created -eq $true -and $summaryId) { "PASS" } else { "FAIL" }) "id=$summaryId"
Add-StepResult "summary has items" $(if ($gen.data.items.Count -ge 4) { "PASS" } else { "FAIL" }) "count=$($gen.data.items.Count)"

$genJson = ($gen | ConvertTo-Json -Depth 20)
Add-StepResult "summary response leak guard" $(if (Test-JsonNoLeakMarkers $genJson) { "PASS" } else { "FAIL" }) ""

$list = Invoke-Api -Path "/api/projects/$projectId/summary" -Headers $auth
Add-StepResult "GET summary list" $(if ($list.data.summaries.Count -ge 1) { "PASS" } else { "FAIL" }) ""

$detail = Invoke-Api -Path "/api/projects/$projectId/summary/$summaryId" -Headers $auth
Add-StepResult "GET summary detail" $(if ($detail.data.summary.id -eq $summaryId) { "PASS" } else { "FAIL" }) ""

$byChapter = Invoke-Api -Path "/api/projects/$projectId/summary/by-chapter/$ch1" -Headers $auth
Add-StepResult "GET summary by chapter" $(if ($byChapter.data.summary.id -eq $summaryId) { "PASS" } else { "FAIL" }) ""

$genAgain = Invoke-Api -Method POST -Path "/api/projects/$projectId/summary/generate" -Headers $auth `
  -Body (@{ chapterOutlineId = $ch1 } | ConvertTo-Json)
Add-StepResult "regenerate=false idempotent" $(if (
    $genAgain.data.created -eq $false -and $genAgain.data.summary.id -eq $summaryId
  ) { "PASS" } else { "FAIL" }) ""

$genV2 = Invoke-Api -Method POST -Path "/api/projects/$projectId/summary/generate" -Headers $auth `
  -Body (@{ chapterOutlineId = $ch1; regenerate = $true } | ConvertTo-Json)
Add-StepResult "regenerate=true new version" $(if (
    $genV2.data.created -eq $true -and $genV2.data.summary.summaryVersion -eq 2 -and $genV2.data.summary.isCurrent -eq $true
  ) { "PASS" } else { "FAIL" }) "v=$($genV2.data.summary.summaryVersion)"

$foundationAfter = Invoke-Api -Path "/api/projects/$projectId/foundation" -Headers $auth
$loopsAfter = (Invoke-Api -Path "/api/projects/$projectId/outline/open-loops" -Headers $auth).data.openLoops.Count
$revealsAfter = (Invoke-Api -Path "/api/projects/$projectId/outline/reveals" -Headers $auth).data.reveals.Count
$propResAfter = Invoke-Api -Path "/api/projects/$projectId/proposals?includeResolved=true" -Headers $auth
$proposalsAfter = if ($propResAfter.data -is [array]) { $propResAfter.data.Count } else { 0 }

Add-StepResult "no canon mutation" $(if (
    $foundationAfter.data.facts.Count -eq $factsBefore -and
    $foundationAfter.data.characters.Count -eq $charsBefore -and
    $loopsAfter -eq $loopsBefore -and
    $revealsAfter -eq $revealsBefore
  ) { "PASS" } else { "FAIL" }) ""

Add-StepResult "no ai_proposals created" $(if ($proposalsAfter -eq $proposalsBefore) { "PASS" } else { "FAIL" }) "before=$proposalsBefore after=$proposalsAfter"

$sessionAfter = Invoke-Api -Path "/api/projects/$projectId/write/sessions/$sessionId" -Headers $auth
Add-StepResult "not summarized yet" $(if ($sessionAfter.data.writingState.status -eq "ready_for_summary") { "PASS" } else { "FAIL" }) ""

$signupB = Invoke-RestMethod -Uri "$SupabaseUrl/auth/v1/signup" -Method POST `
  -Headers @{ apikey = $anonKey; Authorization = "Bearer $anonKey" } -ContentType "application/json" `
  -Body (@{ email = "s6b-$(Get-Random)@example.com"; password = $TestPassword } | ConvertTo-Json)
$authB = @{ Authorization = "Bearer $($signupB.access_token)" }
Invoke-ApiExpectFailure -Name "cross-user summary 404" -Method GET -Headers $authB `
  -Path "/api/projects/$projectId/summary/$summaryId"

$fail = @($Results | Where-Object { $_.Result -eq "FAIL" }).Count
Write-Host "`nSummary: $($Results.Count - $fail) PASS, $fail FAIL"
$Results | Format-Table Step, Test, Result, Detail -AutoSize
if ($fail -gt 0) { exit 1 }
exit 0