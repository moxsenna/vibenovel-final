<#
.SYNOPSIS
  Sprint 5 Write Room API smoke test — context packet, session, prose, safety leak guards (Task 5.6).

.DESCRIPTION
  Run from repo root:
    powershell -ExecutionPolicy Bypass -File scripts/sprint5-smoke-api.ps1

  Prerequisites:
    - supabase start && supabase db reset
    - npm run dev:api
    - Supabase anon key via env or supabase status -o env

  Security: does not print JWT tokens or service role keys.
#>
[CmdletBinding()]
param(
  [string]$ApiBaseUrl = "http://127.0.0.1:8787",
  [string]$SupabaseUrl = "http://127.0.0.1:54321",
  [string]$SupabaseAnonKey = "",
  [string]$TestEmail = "",
  [string]$TestPassword = "VibeNovel-Local-Smoke-Test!",
  [string]$SeedProjectId = "a0000000-0000-4000-8000-000000000101",
  [string]$Chapter1OutlineId = "a0000000-0000-4000-8000-000000000911",
  [string]$Chapter2Title = "Pesan di Ponsel Arman",
  [string]$Chapter2SummarySnippet = "Nadira tidak sengaja melihat pesan yang terhapus cepat",
  [string]$ForbiddenRevealLabel = "Identitas dan hubungan Siska",
  [string]$PlanningTruthSnippet = "Siska adalah mantan kekasih Arman yang masih memiliki ikatan rahasia"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Continue"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$Results = New-Object System.Collections.Generic.List[object]
$StepNumber = 0
$token = $null
$projectId = $null
$packetLogId = $null
$sessionId = $null
$beatId = $null
$auth = @{}

function Add-StepResult {
  param([string]$Name, [ValidateSet("PASS", "FAIL", "SKIP", "NOT RUN")][string]$Result, [string]$Detail = "")
  $script:StepNumber++
  $Results.Add([PSCustomObject]@{ Step = $script:StepNumber; Test = $Name; Result = $Result; Detail = $Detail }) | Out-Null
  $color = if ($Result -eq "PASS") { "Green" } elseif ($Result -eq "FAIL") { "Red" } else { "Yellow" }
  Write-Host ("[{0}] {1,-46} {2}" -f $Result, $Name, $Detail) -ForegroundColor $color
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
    'full_prompt', 'openrouter', '"provider"\s*:', '"model"\s*:', '"token"\s*:'
  )
  foreach ($p in $patterns) {
    if ($JsonText -match $p) { return $false }
  }
  return $true
}

function Get-SpeechRulesCount {
  param([hashtable]$AuthHeaders, [string]$ProjectId)
  $res = Invoke-Api -Path "/api/projects/$ProjectId/speech-rules" -Headers $AuthHeaders
  if ($res.data -is [array]) { return $res.data.Count }
  if ($null -ne $res.data.rules) { return $res.data.rules.Count }
  return 0
}

function Get-PacketJsonFromDb {
  param([string]$LogId, [hashtable]$AuthHeaders, [string]$AnonKey)
  $headers = @{
    apikey        = $AnonKey
    Authorization = $AuthHeaders.Authorization
  }
  $uri = "$SupabaseUrl/rest/v1/context_packet_logs?id=eq.$LogId&select=packet_json"
  $rows = Invoke-RestMethod -Uri $uri -Method GET -Headers $headers -ErrorAction Stop
  if (-not $rows -or $rows.Count -lt 1) {
    throw "context_packet_logs row not found for id=$LogId"
  }
  return ($rows[0].packet_json | ConvertTo-Json -Depth 30 -Compress)
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

Write-Host "`nVibeNovel Sprint 5 Write Room API Smoke Test" -ForegroundColor Cyan

$anonKey = Resolve-SupabaseAnonKey
if ([string]::IsNullOrWhiteSpace($TestEmail)) {
  $TestEmail = "s5smoke-$(Get-Random -Maximum 99999999)@example.com"
}

try {
  $signup = Invoke-RestMethod -Uri "$SupabaseUrl/auth/v1/signup" -Method POST `
    -Headers @{ apikey = $anonKey; Authorization = "Bearer $anonKey" } -ContentType "application/json" `
    -Body (@{ email = $TestEmail; password = $TestPassword } | ConvertTo-Json)
  $token = $signup.access_token
  Add-StepResult "signup/login" $(if ($token) { "PASS" } else { "FAIL" }) "email=$TestEmail"
} catch { Add-StepResult "signup/login" "FAIL" $_.Exception.Message; exit 1 }

$auth = @{ Authorization = "Bearer $token" }

Invoke-ApiExpectFailure -Name "POST context-packet no token" -Method POST `
  -Path "/api/projects/$SeedProjectId/write/context-packet" -Body (@{ chapterOutlineId = $Chapter1OutlineId } | ConvertTo-Json)

$created = Invoke-Api -Method POST -Path "/api/projects" -Headers $auth -Body '{"title":"S5 Smoke","entryPath":"rough_idea"}'
$projectId = $created.data.id
Add-StepResult "POST /api/projects" "PASS" "projectId=$projectId"

Bootstrap-FoundationLocked -ProjectId $projectId
Add-StepResult "bootstrap foundation locked" "PASS" ""

Invoke-Api -Method POST -Path "/api/projects/$projectId/outline/generate" -Headers $auth -Body '{}' | Out-Null
$chaptersPreLock = Invoke-Api -Path "/api/projects/$projectId/outline/chapters" -Headers $auth
$ch1PreLock = ($chaptersPreLock.data.chapters | Where-Object { $_.chapterNumber -eq 1 } | Select-Object -First 1).id
Invoke-ApiExpectFailure -Name "POST without outline_locked" -Method POST -Headers $auth `
  -Path "/api/projects/$projectId/write/context-packet" `
  -Body (@{ chapterOutlineId = $ch1PreLock } | ConvertTo-Json)
Invoke-Api -Method POST -Path "/api/projects/$projectId/outline/approve" -Headers $auth -Body '{}' | Out-Null
$lock = Invoke-Api -Method POST -Path "/api/projects/$projectId/outline/lock" -Headers $auth -Body '{}'
Add-StepResult "outline lock flow" $(if ($lock.data.outlinePlan.status -eq "locked") { "PASS" } else { "FAIL" }) $lock.data.outlinePlan.status

$chapters = Invoke-Api -Path "/api/projects/$projectId/outline/chapters" -Headers $auth
$ch1 = ($chapters.data.chapters | Where-Object { $_.chapterNumber -eq 1 } | Select-Object -First 1).id

$foundationPre = Invoke-Api -Path "/api/projects/$projectId/foundation" -Headers $auth
$factsBefore = $foundationPre.data.facts.Count
$charsBefore = $foundationPre.data.characters.Count
$speechBefore = Get-SpeechRulesCount -AuthHeaders $auth -ProjectId $projectId
$outlineBefore = Invoke-Api -Path "/api/projects/$projectId/outline/chapters" -Headers $auth
$chaptersCountBefore = $outlineBefore.data.chapters.Count

$build = Invoke-Api -Method POST -Path "/api/projects/$projectId/write/context-packet" -Headers $auth `
  -Body (@{ chapterOutlineId = $ch1 } | ConvertTo-Json)
$packetLogId = $build.data.packetLogId
Add-StepResult "POST context-packet ch1" $(if ($packetLogId) { "PASS" } else { "FAIL" }) "logId=$packetLogId"

$serialized = ($build | ConvertTo-Json -Depth 20)
Add-StepResult "response preview-only leak guard" $(if (Test-JsonNoLeakMarkers $serialized) { "PASS" } else { "FAIL" }) ""
Add-StepResult "ch1 response no ch2 title" $(if ($serialized -notmatch [regex]::Escape($Chapter2Title)) { "PASS" } else { "FAIL" }) ""
Add-StepResult "ch1 response no ch2 summary" $(if ($serialized -notmatch [regex]::Escape($Chapter2SummarySnippet)) { "PASS" } else { "FAIL" }) ""
Add-StepResult "response has preview fields" $(if ($build.data.preview -and $build.data.safety.packetHash) { "PASS" } else { "FAIL" }) ""

$preview = Invoke-Api -Path "/api/projects/$projectId/write/context-packet/$packetLogId/preview" -Headers $auth
Add-StepResult "GET preview by logId" $(if ($preview.data.preview.packetLogId) { "PASS" } else { "FAIL" }) ""

$pvJson = ($preview | ConvertTo-Json -Depth 20)
Add-StepResult "GET preview redacted" $(if (Test-JsonNoLeakMarkers $pvJson) { "PASS" } else { "FAIL" }) ""

try {
  $dbPacketJson = Get-PacketJsonFromDb -LogId $packetLogId -AuthHeaders $auth -AnonKey $anonKey
  Add-StepResult "DB packet_json leak guard" $(if (Test-JsonNoLeakMarkers $dbPacketJson) { "PASS" } else { "FAIL" }) ""
  Add-StepResult "DB packet_json no ch2 title" $(if ($dbPacketJson -notmatch [regex]::Escape($Chapter2Title)) { "PASS" } else { "FAIL" }) ""
  Add-StepResult "DB packet_json no ch2 summary" $(if ($dbPacketJson -notmatch [regex]::Escape($Chapter2SummarySnippet)) { "PASS" } else { "FAIL" }) ""
  Add-StepResult "DB packet_json no planning truth" $(if ($dbPacketJson -notmatch [regex]::Escape($PlanningTruthSnippet)) { "PASS" } else { "FAIL" }) ""
  Add-StepResult "DB forbidden reveal label only" $(if (
      $dbPacketJson -match [regex]::Escape($ForbiddenRevealLabel) -and
      $dbPacketJson -match 'forbiddenReveals' -and
      $dbPacketJson -notmatch [regex]::Escape($PlanningTruthSnippet)
    ) { "PASS" } else { "FAIL" }) ""
} catch {
  Add-StepResult "DB packet_json safety" "FAIL" $_.Exception.Message
}

$signupB = Invoke-RestMethod -Uri "$SupabaseUrl/auth/v1/signup" -Method POST `
  -Headers @{ apikey = $anonKey; Authorization = "Bearer $anonKey" } -ContentType "application/json" `
  -Body (@{ email = "s5b-$(Get-Random)@example.com"; password = $TestPassword } | ConvertTo-Json)
$authB = @{ Authorization = "Bearer $($signupB.access_token)" }
Invoke-ApiExpectFailure -Name "cross-user project 404" -Method POST -Headers $authB `
  -Path "/api/projects/$SeedProjectId/write/context-packet" `
  -Body (@{ chapterOutlineId = $Chapter1OutlineId } | ConvertTo-Json)

$foundationPost = Invoke-Api -Path "/api/projects/$projectId/foundation" -Headers $auth
Add-StepResult "canon counts unchanged" $(if ($foundationPost.data.facts.Count -eq $factsBefore -and $foundationPost.data.characters.Count -eq $charsBefore) { "PASS" } else { "FAIL" }) ""

# --- Task 5.3: Writing session & beats ---
Invoke-ApiExpectFailure -Name "POST session no token" -Method POST `
  -Path "/api/projects/$projectId/write/sessions" `
  -Body (@{ chapterOutlineId = $ch1 } | ConvertTo-Json)

$session1 = Invoke-Api -Method POST -Path "/api/projects/$projectId/write/sessions" -Headers $auth `
  -Body (@{ chapterOutlineId = $ch1 } | ConvertTo-Json)
$sessionId = $session1.data.session.id
Add-StepResult "POST writing session" $(if ($session1.data.session.status -eq "active") { "PASS" } else { "FAIL" }) "sessionId=$sessionId"

$session2 = Invoke-Api -Method POST -Path "/api/projects/$projectId/write/sessions" -Headers $auth `
  -Body (@{ chapterOutlineId = $ch1 } | ConvertTo-Json)
Add-StepResult "POST session idempotent" $(if ($session2.data.session.id -eq $sessionId) { "PASS" } else { "FAIL" }) ""

$sessionGet = Invoke-Api -Path "/api/projects/$projectId/write/sessions/$sessionId" -Headers $auth
Add-StepResult "GET writing session" $(if ($sessionGet.data.session.id -eq $sessionId) { "PASS" } else { "FAIL" }) "beatsCount=$($sessionGet.data.beatsCount)"

$beatsBefore = Invoke-Api -Path "/api/projects/$projectId/write/sessions/$sessionId/beats" -Headers $auth
Add-StepResult "GET beats before generate" $(if ($beatsBefore.data.beats -is [array]) { "PASS" } else { "FAIL" }) "count=$($beatsBefore.data.beats.Count)"

$genBeats = Invoke-Api -Method POST -Path "/api/projects/$projectId/write/sessions/$sessionId/beats/generate" -Headers $auth -Body '{}'
Add-StepResult "POST beats/generate" $(if ($genBeats.data.beats.Count -eq 5) { "PASS" } else { "FAIL" }) "count=$($genBeats.data.beats.Count)"

$genAgain = Invoke-Api -Method POST -Path "/api/projects/$projectId/write/sessions/$sessionId/beats/generate" -Headers $auth -Body '{}'
Add-StepResult "POST beats/generate idempotent" $(if ($genAgain.data.created -eq $false) { "PASS" } else { "FAIL" }) ""

$beatId = $genAgain.data.beats[0].id
$patchBeat = Invoke-Api -Method PATCH -Path "/api/projects/$projectId/write/beats/$beatId" -Headers $auth `
  -Body '{"status":"draft","direction":"Arahan uji smoke"}'
Add-StepResult "PATCH beat status/direction" $(if ($patchBeat.data.beat.status -eq "draft") { "PASS" } else { "FAIL" }) ""

Invoke-ApiExpectFailure -Name "PATCH beat rejects proseText" -Method PATCH -Headers $auth `
  -Path "/api/projects/$projectId/write/beats/$beatId" -Body '{"proseText":"rahasia"}'

$patchSession = Invoke-Api -Method PATCH -Path "/api/projects/$projectId/write/sessions/$sessionId" -Headers $auth `
  -Body (@{ activeBeatId = $beatId } | ConvertTo-Json)
Add-StepResult "PATCH session activeBeatId" $(if ($patchSession.data.session.activeBeatId -eq $beatId) { "PASS" } else { "FAIL" }) ""

# --- Task 5.4: Prose draft persistence ---
Invoke-ApiExpectFailure -Name "POST prose no token" -Method POST `
  -Path "/api/projects/$projectId/write/beats/$beatId/prose" -Body '{"proseText":"Teks uji"}'

Invoke-Api -Method PATCH -Path "/api/projects/$projectId/write/sessions/$sessionId" -Headers $auth `
  -Body '{"status":"abandoned"}' | Out-Null
Invoke-ApiExpectFailure -Name "POST prose without session" -Method POST -Headers $auth `
  -Path "/api/projects/$projectId/write/beats/$beatId/prose" -Body '{"proseText":"Teks tanpa sesi aktif"}'

$sessionResume = Invoke-Api -Method POST -Path "/api/projects/$projectId/write/sessions" -Headers $auth `
  -Body (@{ chapterOutlineId = $ch1 } | ConvertTo-Json)
$sessionId = $sessionResume.data.session.id
Add-StepResult "resume session for prose" $(if ($sessionResume.data.session.status -eq "active") { "PASS" } else { "FAIL" }) ""

$fictionalSecret = "Rahasia keluarga itu hanya diketahui Bu Siti. Nadira belum pernah mendengar cerita lengkapnya dari Arman."
$fictionalProse = Invoke-Api -Method POST -Path "/api/projects/$projectId/write/beats/$beatId/prose" -Headers $auth `
  -Body (@{ proseText = $fictionalSecret } | ConvertTo-Json)
Add-StepResult "POST prose fictional secret allowed" $(if ($fictionalProse.data.version.id) { "PASS" } else { "FAIL" }) ""

$prose1 = Invoke-Api -Method POST -Path "/api/projects/$projectId/write/beats/$beatId/prose" -Headers $auth `
  -Body '{"proseText":"Nadira memangkas sayuran di dapur dengan irama yang sudah hafal di luar kepala."}'
$version1Id = $prose1.data.version.id
Add-StepResult "POST prose version 2" $(if ($prose1.data.version.versionNumber -eq 2 -and $prose1.data.version.isCurrent) { "PASS" } else { "FAIL" }) "v=$version1Id"

$prose1Json = ($prose1 | ConvertTo-Json -Depth 10)
Add-StepResult "prose response no packet_json" $(if (Test-JsonNoLeakMarkers $prose1Json) { "PASS" } else { "FAIL" }) ""

$prose2Body = @{ proseText = "Pintu depan dibuka. Suara tawa memenuhi ruang tamu." }
if ($packetLogId) { $prose2Body.contextPacketLogId = $packetLogId }
$prose2 = Invoke-Api -Method POST -Path "/api/projects/$projectId/write/beats/$beatId/prose" -Headers $auth `
  -Body ($prose2Body | ConvertTo-Json)
$version2Id = $prose2.data.version.id
Add-StepResult "POST prose version 3" $(if ($prose2.data.version.versionNumber -eq 3 -and $prose2.data.version.isCurrent) { "PASS" } else { "FAIL" }) ""

$listProse = Invoke-Api -Path "/api/projects/$projectId/write/beats/$beatId/prose" -Headers $auth
$v1Current = ($listProse.data.versions | Where-Object { $_.id -eq $version1Id } | Select-Object -First 1).isCurrent
Add-StepResult "GET prose versions" $(if ($listProse.data.versions.Count -eq 3 -and $v1Current -eq $false) { "PASS" } else { "FAIL" }) ""

$proseDetail = Invoke-Api -Path "/api/projects/$projectId/write/prose/$version2Id" -Headers $auth
Add-StepResult "GET prose version detail" $(if ($proseDetail.data.version.id -eq $version2Id) { "PASS" } else { "FAIL" }) ""

if ($packetLogId) {
  Add-StepResult "contextPacketLogId linked" $(if ($prose2.data.version.contextPacketLogId -eq $packetLogId) { "PASS" } else { "FAIL" }) ""
}

Invoke-ApiExpectFailure -Name "POST prose ai_generated rejected" -Method POST -Headers $auth `
  -Path "/api/projects/$projectId/write/beats/$beatId/prose" -Body '{"proseText":"Teks","source":"ai_generated"}'

Invoke-ApiExpectFailure -Name "POST prose planningTruth rejected" -Method POST -Headers $auth `
  -Path "/api/projects/$projectId/write/beats/$beatId/prose" -Body '{"proseText":"Ada planningTruth di sini"}'

$dumpProse = '{"currentChapter":{"title":"x"},"revealGate":{"allowedBreadcrumbs":[]},"forbiddenReveals":[]}'
Invoke-ApiExpectFailure -Name "POST prose packet dump rejected" -Method POST -Headers $auth `
  -Path "/api/projects/$projectId/write/beats/$beatId/prose" -Body (@{ proseText = $dumpProse } | ConvertTo-Json)

$foundationMid = Invoke-Api -Path "/api/projects/$projectId/foundation" -Headers $auth
$speechMid = Get-SpeechRulesCount -AuthHeaders $auth -ProjectId $projectId
$outlineMid = Invoke-Api -Path "/api/projects/$projectId/outline/chapters" -Headers $auth
Add-StepResult "prose save no canon mutation" $(if (
    $foundationMid.data.facts.Count -eq $factsBefore -and
    $foundationMid.data.characters.Count -eq $charsBefore -and
    $speechMid -eq $speechBefore -and
    $outlineMid.data.chapters.Count -eq $chaptersCountBefore
  ) { "PASS" } else { "FAIL" }) ""

$ready = Invoke-Api -Method POST -Path "/api/projects/$projectId/write/sessions/$sessionId/ready-for-summary" -Headers $auth -Body '{}'
Add-StepResult "POST ready-for-summary" $(if ($ready.data.session.status -eq "ready_for_summary") { "PASS" } else { "FAIL" }) ""

$sessionAfterReady = Invoke-Api -Path "/api/projects/$projectId/write/sessions/$sessionId" -Headers $auth
Add-StepResult "ready_for_summary not summarized" $(if (
    $sessionAfterReady.data.writingState.status -eq "ready_for_summary" -and
    $sessionAfterReady.data.writingState.status -ne "summarized"
  ) { "PASS" } else { "FAIL" }) "status=$($sessionAfterReady.data.writingState.status)"

$foundationFinal = Invoke-Api -Path "/api/projects/$projectId/foundation" -Headers $auth
$speechFinal = Get-SpeechRulesCount -AuthHeaders $auth -ProjectId $projectId
$outlineFinal = Invoke-Api -Path "/api/projects/$projectId/outline/chapters" -Headers $auth
Add-StepResult "canon unchanged after write flow" $(if (
    $foundationFinal.data.facts.Count -eq $factsBefore -and
    $foundationFinal.data.characters.Count -eq $charsBefore -and
    $speechFinal -eq $speechBefore -and
    $outlineFinal.data.chapters.Count -eq $chaptersCountBefore
  ) { "PASS" } else { "FAIL" }) ""
Add-StepResult "ready_for_summary no fact mutation" $(if ($foundationFinal.data.facts.Count -eq $factsBefore) { "PASS" } else { "FAIL" }) ""

Invoke-ApiExpectFailure -Name "cross-user session 404" -Method GET -Headers $authB `
  -Path "/api/projects/$projectId/write/sessions/$sessionId"

$fail = @($Results | Where-Object { $_.Result -eq "FAIL" }).Count
Write-Host "`nSummary: $($Results.Count - $fail) PASS, $fail FAIL"
if ($fail -gt 0) { exit 1 }
exit 0