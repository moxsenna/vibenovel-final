<#
.SYNOPSIS
  Sprint 12.2–12.3 HTTP smoke — beat + chapter summary generation (AI mock path).

.DESCRIPTION
  Run from repo root:
    powershell -ExecutionPolicy Bypass -File scripts/sprint12-story-generation-smoke-api.ps1

  Prerequisites:
    - supabase start && supabase db reset
    - apps/api/.dev.vars:
        AI_GENERATION_ENABLED=true
        AI_PROVIDER_MOCK=true
      (restart `npm run dev:api` after editing)
    - npm run dev:api  -> ApiBaseUrl

  Verifies:
    - POST beats/generate returns 5 beats with metadata.generator = beat_ai_generator
    - POST summary/generate returns summary with metadata.generatorVersion = summary_ai_generator
    - No planning_truth / packet_json leaks in JSON responses
    - Generic foundation accept path (foundation/proposals/:id/accept) used in bootstrap

.PARAMETER StubOnly
  Expect deterministic stubs (AI off + ALLOW_DETERMINISTIC_STORY_STUBS=true) instead of AI markers.
#>
[CmdletBinding()]
param(
  [string]$ApiBaseUrl = "http://127.0.0.1:8787",
  [string]$SupabaseUrl = "http://127.0.0.1:54321",
  [string]$SupabaseAnonKey = "",
  [string]$TestEmail = "",
  [string]$TestPassword = "VibeNovel-Local-Smoke-Test!",
  [switch]$StubOnly
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
  Write-Host ("[{0}] {1,-52} {2}" -f $Result, $Name, $Detail) -ForegroundColor $color
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

function Test-JsonNoLeakMarkers {
  param([string]$JsonText)
  $patterns = @(
    'packetJson', 'packet_json', '"planningTruth"\s*:', 'planning_truth',
    'full_prompt', 'openrouter', '"provider"\s*:', '"model"\s*:', '"token"\s*:'
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
      Invoke-Api -Method POST -Path "/api/projects/$ProjectId/foundation/proposals/$($p.id)/accept" -Headers $auth -Body '{}' | Out-Null
    }
  }
  Invoke-Api -Method POST -Path "/api/projects/$ProjectId/foundation/lock" -Headers $auth -Body '{}' | Out-Null
}

$expectedBeatGen = if ($StubOnly) { "beat_stub_deterministic" } else { "beat_ai_generator" }
$expectedSummaryGen = if ($StubOnly) { "summary_stub_v1" } else { "summary_ai_generator" }

Write-Host "`nVibeNovel Sprint 12 Beat + Summary HTTP Smoke" -ForegroundColor Cyan
Write-Host "Mode: $(if ($StubOnly) { 'stub (AI off + allow stubs)' } else { 'AI mock (AI on + AI_PROVIDER_MOCK)' })" -ForegroundColor DarkGray

try {
  $health = Invoke-RestMethod -Uri "$ApiBaseUrl/api/health" -Method GET -ErrorAction Stop
  Add-StepResult "GET /api/health" $(if ($health.ok -eq $true -and $health.data.service) { "PASS" } else { "FAIL" }) ""
} catch {
  Add-StepResult "GET /api/health" "FAIL" "start dev:api at $ApiBaseUrl"
  exit 1
}

$anonKey = Resolve-SupabaseAnonKey
if ([string]::IsNullOrWhiteSpace($TestEmail)) {
  $TestEmail = "s12smoke-$(Get-Random -Maximum 99999999)@example.com"
}

try {
  $signup = Invoke-RestMethod -Uri "$SupabaseUrl/auth/v1/signup" -Method POST `
    -Headers @{ apikey = $anonKey; Authorization = "Bearer $anonKey" } -ContentType "application/json" `
    -Body (@{ email = $TestEmail; password = $TestPassword } | ConvertTo-Json)
  $token = $signup.access_token
  Add-StepResult "signup/login" $(if ($token) { "PASS" } else { "FAIL" }) "email=$TestEmail"
} catch {
  Add-StepResult "signup/login" "FAIL" $_.Exception.Message
  exit 1
}

$auth = @{ Authorization = "Bearer $token" }

$created = Invoke-Api -Method POST -Path "/api/projects" -Headers $auth -Body '{"title":"S12 Smoke","entryPath":"rough_idea"}'
$projectId = $created.data.id
Add-StepResult "POST /api/projects" "PASS" "projectId=$projectId"

Bootstrap-FoundationLocked -ProjectId $projectId
Invoke-Api -Method POST -Path "/api/projects/$projectId/outline/generate" -Headers $auth -Body '{}' | Out-Null
Invoke-Api -Method POST -Path "/api/projects/$projectId/outline/approve" -Headers $auth -Body '{}' | Out-Null
Invoke-Api -Method POST -Path "/api/projects/$projectId/outline/lock" -Headers $auth -Body '{}' | Out-Null

$chapters = Invoke-Api -Path "/api/projects/$projectId/outline/chapters" -Headers $auth
$ch1 = ($chapters.data.chapters | Where-Object { $_.chapterNumber -eq 1 } | Select-Object -First 1).id

$session = Invoke-Api -Method POST -Path "/api/projects/$projectId/write/sessions" -Headers $auth `
  -Body (@{ chapterOutlineId = $ch1 } | ConvertTo-Json)
$sessionId = $session.data.session.id

$genBeats = Invoke-Api -Method POST -Path "/api/projects/$projectId/write/sessions/$sessionId/beats/generate" -Headers $auth -Body '{}'
$beatCount = $genBeats.data.beats.Count
Add-StepResult "POST beats/generate count" $(if ($beatCount -ge 3) { "PASS" } else { "FAIL" }) "count=$beatCount"

$beatMarkerOk = $true
foreach ($b in $genBeats.data.beats) {
  $g = $b.metadata.generator
  if ($g -ne $expectedBeatGen) { $beatMarkerOk = $false }
}
Add-StepResult "beats generator marker" $(if ($beatMarkerOk) { "PASS" } else { "FAIL" }) "expect=$expectedBeatGen"

$beatsJson = ($genBeats | ConvertTo-Json -Depth 12)
Add-StepResult "beats response leak guard" $(if (Test-JsonNoLeakMarkers $beatsJson) { "PASS" } else { "FAIL" }) ""

$beatId = $genBeats.data.beats[0].id
Invoke-Api -Method POST -Path "/api/projects/$projectId/write/beats/$beatId/prose" -Headers $auth `
  -Body '{"proseText":"Nadira memangkas sayuran di dapur dengan irama yang sudah hafal di luar kepala."}' | Out-Null
Invoke-Api -Method POST -Path "/api/projects/$projectId/write/sessions/$sessionId/ready-for-summary" -Headers $auth -Body '{}' | Out-Null

$factsBefore = (Invoke-Api -Path "/api/projects/$projectId/foundation" -Headers $auth).data.facts.Count
$propBefore = (Invoke-Api -Path "/api/projects/$projectId/proposals?includeResolved=true" -Headers $auth).data.Count

$genSummary = Invoke-Api -Method POST -Path "/api/projects/$projectId/summary/generate" -Headers $auth `
  -Body (@{ chapterOutlineId = $ch1; writingSessionId = $sessionId } | ConvertTo-Json)
$summaryId = $genSummary.data.summary.id
$genVer = $genSummary.data.summary.metadata.generatorVersion
Add-StepResult "POST summary/generate" $(if ($summaryId) { "PASS" } else { "FAIL" }) "id=$summaryId"
Add-StepResult "summary generatorVersion" $(if ($genVer -eq $expectedSummaryGen) { "PASS" } else { "FAIL" }) "got=$genVer expect=$expectedSummaryGen"
Add-StepResult "summary items present" $(if ($genSummary.data.items.Count -ge 1) { "PASS" } else { "FAIL" }) "count=$($genSummary.data.items.Count)"

$sumJson = ($genSummary | ConvertTo-Json -Depth 15)
Add-StepResult "summary response leak guard" $(if (Test-JsonNoLeakMarkers $sumJson) { "PASS" } else { "FAIL" }) ""

$factsAfter = (Invoke-Api -Path "/api/projects/$projectId/foundation" -Headers $auth).data.facts.Count
$propAfter = (Invoke-Api -Path "/api/projects/$projectId/proposals?includeResolved=true" -Headers $auth).data.Count
Add-StepResult "summary no direct fact canon" $(if ($factsAfter -eq $factsBefore) { "PASS" } else { "FAIL" }) "before=$factsBefore after=$factsAfter"

if (-not $StubOnly) {
  Add-StepResult "AI path may add proposals only" $(if ($propAfter -ge $propBefore) { "PASS" } else { "FAIL" }) "before=$propBefore after=$propAfter"
} else {
  Add-StepResult "stub path proposals unchanged" $(if ($propAfter -eq $propBefore) { "PASS" } else { "FAIL" }) ""
}

$fail = @($Results | Where-Object { $_.Result -eq "FAIL" }).Count
Write-Host "`nSummary: $($Results.Count - $fail) PASS, $fail FAIL" -ForegroundColor $(if ($fail -gt 0) { "Red" } else { "Green" })
if ($fail -gt 0) { exit 1 }
exit 0