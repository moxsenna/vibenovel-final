<#
.SYNOPSIS
  Sprint 7 Publish Package API safety smoke (Task 7.2–7.5).

.DESCRIPTION
  Run from repo root:
    powershell -ExecutionPolicy Bypass -File scripts/sprint7-smoke-api.ps1

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

function Get-SpeechRulesCount {
  param([string]$ProjectId)
  $res = Invoke-Api -Path "/api/projects/$ProjectId/speech-rules" -Headers $auth
  if ($res.data -is [array]) { return $res.data.Count }
  if ($null -ne $res.data.rules) { return $res.data.rules.Count }
  return 0
}

function Test-PublishJsonNoLeakMarkers {
  param([string]$JsonText)
  $patterns = @(
    'packetJson', 'packet_json', '"planningTruth"\s*:', 'planning_truth',
    'full_prompt', 'openrouter', '"proseText"\s*:', '"prose_text"\s*:',
    '"delta_json"\s*:', 'deltaJson', '"payload"\s*:',
    '"provider"\s*:', '"model"\s*:', '"token"\s*:'
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

Write-Host "`nVibeNovel Sprint 7 Publish Package API Smoke Test" -ForegroundColor Cyan

$anonKey = Resolve-SupabaseAnonKey
if ([string]::IsNullOrWhiteSpace($TestEmail)) {
  $TestEmail = "s7smoke-$(Get-Random -Maximum 99999999)@example.com"
}

try {
  $signup = Invoke-RestMethod -Uri "$SupabaseUrl/auth/v1/signup" -Method POST `
    -Headers @{ apikey = $anonKey; Authorization = "Bearer $anonKey" } -ContentType "application/json" `
    -Body (@{ email = $TestEmail; password = $TestPassword } | ConvertTo-Json)
  $token = $signup.access_token
  Add-StepResult "signup/login" $(if ($token) { "PASS" } else { "FAIL" }) "email=$TestEmail"
} catch { Add-StepResult "signup/login" "FAIL" $_.Exception.Message; exit 1 }

$auth = @{ Authorization = "Bearer $token" }

Invoke-ApiExpectFailure -Name "POST publish/generate no token" -Method POST `
  -Path "/api/projects/00000000-0000-4000-8000-000000000001/publish/generate" `
  -Body '{"chapterOutlineId":"00000000-0000-4000-8000-000000000001"}'

$created = Invoke-Api -Method POST -Path "/api/projects" -Headers $auth -Body '{"title":"S7 Smoke","entryPath":"rough_idea"}'
$projectId = $created.data.id
Add-StepResult "POST /api/projects" "PASS" "projectId=$projectId"

Bootstrap-FoundationLocked -ProjectId $projectId
Invoke-Api -Method POST -Path "/api/projects/$projectId/outline/generate" -Headers $auth -Body '{}' | Out-Null
Invoke-Api -Method POST -Path "/api/projects/$projectId/outline/approve" -Headers $auth -Body '{}' | Out-Null
Invoke-Api -Method POST -Path "/api/projects/$projectId/outline/lock" -Headers $auth -Body '{}' | Out-Null

$chapters = Invoke-Api -Path "/api/projects/$projectId/outline/chapters" -Headers $auth
$ch1 = ($chapters.data.chapters | Where-Object { $_.chapterNumber -eq 1 } | Select-Object -First 1)
$ch1Id = $ch1.id
$ch2 = ($chapters.data.chapters | Where-Object { $_.chapterNumber -eq 2 } | Select-Object -First 1)

$foundationBefore = Invoke-Api -Path "/api/projects/$projectId/foundation" -Headers $auth
$factsBefore = $foundationBefore.data.facts.Count
$charsBefore = $foundationBefore.data.characters.Count
$speechBefore = Get-SpeechRulesCount -ProjectId $projectId
$openLoopsBefore = (Invoke-Api -Path "/api/projects/$projectId/outline/open-loops" -Headers $auth).data.openLoops.Count
$revealsBefore = (Invoke-Api -Path "/api/projects/$projectId/outline/reveals" -Headers $auth).data.reveals.Count



$session = Invoke-Api -Method POST -Path "/api/projects/$projectId/write/sessions" -Headers $auth `
  -Body (@{ chapterOutlineId = $ch1Id } | ConvertTo-Json)
$sessionId = $session.data.session.id
Invoke-Api -Method POST -Path "/api/projects/$projectId/write/sessions/$sessionId/beats/generate" -Headers $auth -Body '{}' | Out-Null
$beats = Invoke-Api -Path "/api/projects/$projectId/write/sessions/$sessionId/beats" -Headers $auth
$beatId = $beats.data.beats[0].id

Invoke-Api -Method PATCH -Path "/api/projects/$projectId/write/beats/$beatId" -Headers $auth `
  -Body '{"mustInclude":["rahasia identitas keluarga tersembunyi di balik dapur"]}' | Out-Null
Invoke-Api -Method POST -Path "/api/projects/$projectId/write/beats/$beatId/prose" -Headers $auth `
  -Body '{"proseText":"Nadira memangkas sayuran di dapur dengan irama yang sudah hafal di luar kepala."}' | Out-Null
Invoke-Api -Method POST -Path "/api/projects/$projectId/write/sessions/$sessionId/ready-for-summary" -Headers $auth -Body '{}' | Out-Null

$gen = Invoke-Api -Method POST -Path "/api/projects/$projectId/summary/generate" -Headers $auth `
  -Body (@{ chapterOutlineId = $ch1Id; writingSessionId = $sessionId } | ConvertTo-Json)
$summaryId = $gen.data.summary.id
Add-StepResult "POST summary generate" $(if ($summaryId) { "PASS" } else { "FAIL" }) "id=$summaryId"

Invoke-ApiExpectFailure -Name "generate before summary approved" -Method POST -Headers $auth `
  -Path "/api/projects/$projectId/publish/generate" `
  -Body (@{ chapterOutlineId = $ch1Id } | ConvertTo-Json)

Invoke-Api -Method POST -Path "/api/projects/$projectId/summary/$summaryId/delta/extract" -Headers $auth -Body '{}' | Out-Null
$approve = Invoke-Api -Method POST -Path "/api/projects/$projectId/summary/$summaryId/approve" -Headers $auth -Body '{}'
Add-StepResult "POST approve summary" $(if ($approve.data.summary.status -eq "approved") { "PASS" } else { "FAIL" }) ""

$propResBeforePublish = Invoke-Api -Path "/api/projects/$projectId/proposals?includeResolved=true" -Headers $auth
$proposalsBeforePublish = if ($propResBeforePublish.data -is [array]) { $propResBeforePublish.data.Count } else { 0 }
$summariesBeforePublish = (Invoke-Api -Path "/api/projects/$projectId/summary" -Headers $auth).data.summaries.Count

$pubGen = Invoke-Api -Method POST -Path "/api/projects/$projectId/publish/generate" -Headers $auth `
  -Body (@{ chapterOutlineId = $ch1Id; chapterSummaryId = $summaryId } | ConvertTo-Json)
$packageId = $pubGen.data.publishPackage.id
Add-StepResult "POST publish generate" $(if ($pubGen.data.created -eq $true -and $packageId) { "PASS" } else { "FAIL" }) "id=$packageId created=201"
Add-StepResult "generate after approved+summarized" $(if (
    $pubGen.data.publishPackage.status -in @("draft", "ready") -and
    $pubGen.data.publishPackage.chapterSummaryId -eq $summaryId
  ) { "PASS" } else { "FAIL" }) "status=$($pubGen.data.publishPackage.status)"
Add-StepResult "package has copy fields" $(if (
    $pubGen.data.publishPackage.displayTitle -and
    $pubGen.data.publishPackage.teaser -and
    $pubGen.data.publishPackage.shortSynopsis -and
    $pubGen.data.publishPackage.caption -and
    $pubGen.data.publishPackage.readerQuestion -and
    $pubGen.data.publishPackage.checklist.Count -eq 5
  ) { "PASS" } else { "FAIL" }) ""

$pubJson = ($pubGen | ConvertTo-Json -Depth 20)
Add-StepResult "publish generate leak guard" $(if (Test-PublishJsonNoLeakMarkers $pubJson) { "PASS" } else { "FAIL" }) ""

$list = Invoke-Api -Path "/api/projects/$projectId/publish" -Headers $auth
Add-StepResult "GET publish list" $(if ($list.data.packages.Count -ge 1) { "PASS" } else { "FAIL" }) "count=$($list.data.packages.Count)"
$listJson = ($list | ConvertTo-Json -Depth 20)
Add-StepResult "GET publish list leak guard" $(if (Test-PublishJsonNoLeakMarkers $listJson) { "PASS" } else { "FAIL" }) ""

$detail = Invoke-Api -Path "/api/projects/$projectId/publish/$packageId" -Headers $auth
Add-StepResult "GET publish detail" $(if ($detail.data.publishPackage.id -eq $packageId) { "PASS" } else { "FAIL" }) ""
$detailJson = ($detail | ConvertTo-Json -Depth 20)
Add-StepResult "GET publish detail leak guard" $(if (Test-PublishJsonNoLeakMarkers $detailJson) { "PASS" } else { "FAIL" }) ""

$byChapter = Invoke-Api -Path "/api/projects/$projectId/publish/by-chapter/$ch1Id" -Headers $auth
Add-StepResult "GET publish by chapter" $(if ($byChapter.data.publishPackage.id -eq $packageId) { "PASS" } else { "FAIL" }) ""

$pubAgain = Invoke-Api -Method POST -Path "/api/projects/$projectId/publish/generate" -Headers $auth `
  -Body (@{ chapterOutlineId = $ch1Id } | ConvertTo-Json)
Add-StepResult "regenerate=false idempotent" $(if (
    $pubAgain.data.created -eq $false -and $pubAgain.data.publishPackage.id -eq $packageId
  ) { "PASS" } else { "FAIL" }) ""

$pubV2 = Invoke-Api -Method POST -Path "/api/projects/$projectId/publish/generate" -Headers $auth `
  -Body (@{ chapterOutlineId = $ch1Id; regenerate = $true } | ConvertTo-Json)
$packageV2Id = $pubV2.data.publishPackage.id
Add-StepResult "regenerate=true new version" $(if (
    $pubV2.data.created -eq $true -and $pubV2.data.publishPackage.packageVersion -eq 2 -and $pubV2.data.publishPackage.isCurrent -eq $true
  ) { "PASS" } else { "FAIL" }) "v=$($pubV2.data.publishPackage.packageVersion)"

$v1Detail = Invoke-Api -Path "/api/projects/$projectId/publish/$packageId" -Headers $auth
Add-StepResult "regenerate supersedes previous" $(if (
    $v1Detail.data.publishPackage.isCurrent -eq $false -and $v1Detail.data.publishPackage.status -eq "superseded"
  ) { "PASS" } else { "FAIL" }) "v1 current=$($v1Detail.data.publishPackage.isCurrent)"

$foundationAfter = Invoke-Api -Path "/api/projects/$projectId/foundation" -Headers $auth
$propResAfter = Invoke-Api -Path "/api/projects/$projectId/proposals?includeResolved=true" -Headers $auth
$proposalsAfter = if ($propResAfter.data -is [array]) { $propResAfter.data.Count } else { 0 }
$speechAfter = Get-SpeechRulesCount -ProjectId $projectId
$openLoopsAfter = (Invoke-Api -Path "/api/projects/$projectId/outline/open-loops" -Headers $auth).data.openLoops.Count
$revealsAfter = (Invoke-Api -Path "/api/projects/$projectId/outline/reveals" -Headers $auth).data.reveals.Count
$summariesAfter = (Invoke-Api -Path "/api/projects/$projectId/summary" -Headers $auth).data.summaries.Count
Add-StepResult "no canon mutation" $(if (
    $foundationAfter.data.facts.Count -eq $factsBefore -and
    $foundationAfter.data.characters.Count -eq $charsBefore -and
    $speechAfter -eq $speechBefore -and
    $openLoopsAfter -eq $openLoopsBefore -and
    $revealsAfter -eq $revealsBefore
  ) { "PASS" } else { "FAIL" }) "facts/chars/speech/openLoops/reveals"
Add-StepResult "summaries unchanged by publish" $(if ($summariesAfter -eq $summariesBeforePublish) { "PASS" } else { "FAIL" }) "before=$summariesBeforePublish after=$summariesAfter"
Add-StepResult "no ai_proposals from publish" $(if ($proposalsAfter -eq $proposalsBeforePublish) { "PASS" } else { "FAIL" }) "before=$proposalsBeforePublish after=$proposalsAfter"

$nextTeaser = $pubV2.data.publishPackage.nextChapterTeaser
$ch2SummaryLeak = $false
if ($ch2 -and $ch2.summary -and $nextTeaser) {
  $summarySnippet = $ch2.summary.Substring(0, [Math]::Min(80, $ch2.summary.Length))
  if ($nextTeaser.Contains($summarySnippet)) { $ch2SummaryLeak = $true }
}
Add-StepResult "next chapter teaser safe" $(if (-not $ch2SummaryLeak) { "PASS" } else { "FAIL" }) ""

Invoke-ApiExpectFailure -Name "PATCH fields no token" -Method PATCH `
  -Path "/api/projects/$projectId/publish/$packageV2Id/fields" `
  -Body '{"teaser":"Teaser smoke edit"}'

$fieldPatch = Invoke-Api -Method PATCH -Path "/api/projects/$projectId/publish/$packageV2Id/fields" -Headers $auth `
  -Body '{"teaser":"Teaser bab ini menggoda tanpa membocorkan rahasia besar.","caption":"Caption hangat untuk pembaca serial mobile.","tags":["drama keluarga","revenge emosional","bab 1"]}'
Add-StepResult "PATCH fields updates copy" $(if (
    $fieldPatch.data.publishPackage.teaser -match "menggoda" -and
    $fieldPatch.data.publishPackage.caption -match "Caption hangat" -and
    $fieldPatch.data.publishPackage.tags.Count -eq 3
  ) { "PASS" } else { "FAIL" }) ""

Invoke-ApiExpectFailure -Name "PATCH fields rejects planningTruth" -Method PATCH -Headers $auth `
  -Path "/api/projects/$projectId/publish/$packageV2Id/fields" `
  -Body '{"caption":"planningTruth leak attempt"}'
Invoke-ApiExpectFailure -Name "PATCH fields rejects packet_json" -Method PATCH -Headers $auth `
  -Path "/api/projects/$projectId/publish/$packageV2Id/fields" `
  -Body '{"teaser":"packet_json dump"}'
Invoke-ApiExpectFailure -Name "PATCH fields rejects prose_text" -Method PATCH -Headers $auth `
  -Path "/api/projects/$projectId/publish/$packageV2Id/fields" `
  -Body '{"caption":"prose_text full dump"}'
Invoke-ApiExpectFailure -Name "PATCH fields rejects overclaim dijamin viral" -Method PATCH -Headers $auth `
  -Path "/api/projects/$projectId/publish/$packageV2Id/fields" `
  -Body '{"caption":"dijamin viral di KBM"}'
Invoke-ApiExpectFailure -Name "PATCH fields rejects overclaim pasti viral" -Method PATCH -Headers $auth `
  -Path "/api/projects/$projectId/publish/$packageV2Id/fields" `
  -Body '{"teaser":"pasti viral di platform"}'
Invoke-ApiExpectFailure -Name "PATCH fields rejects overclaim dijamin unlock" -Method PATCH -Headers $auth `
  -Path "/api/projects/$projectId/publish/$packageV2Id/fields" `
  -Body '{"caption":"dijamin unlock bab berikutnya"}'
Invoke-ApiExpectFailure -Name "PATCH fields rejects overclaim pasti banyak pembaca" -Method PATCH -Headers $auth `
  -Path "/api/projects/$projectId/publish/$packageV2Id/fields" `
  -Body '{"readerQuestion":"pasti banyak pembaca lanjut"}'

$checklistItems = @(
  @{ id = "chk_teaser"; checked = $true },
  @{ id = "chk_caption"; checked = $true },
  @{ id = "chk_tags"; checked = $true },
  @{ id = "chk_question"; checked = $true },
  @{ id = "chk_preview"; checked = $true }
)
$checklistPatch = Invoke-Api -Method PATCH -Path "/api/projects/$projectId/publish/$packageV2Id/checklist" -Headers $auth `
  -Body (@{ items = $checklistItems } | ConvertTo-Json -Depth 5)
$allChecked = $true
foreach ($item in $checklistPatch.data.publishPackage.checklist) {
  if (-not $item.checked) { $allChecked = $false }
}
Add-StepResult "PATCH checklist updates ids" $(if ($allChecked -and $checklistPatch.data.publishPackage.checklist.Count -eq 5) { "PASS" } else { "FAIL" }) ""

$badChecklist = @(
  @{ id = "chk_unknown"; checked = $true },
  @{ id = "chk_caption"; checked = $true },
  @{ id = "chk_tags"; checked = $true },
  @{ id = "chk_question"; checked = $true },
  @{ id = "chk_preview"; checked = $true }
)
Invoke-ApiExpectFailure -Name "PATCH checklist rejects unknown id" -Method PATCH -Headers $auth `
  -Path "/api/projects/$projectId/publish/$packageV2Id/checklist" `
  -Body (@{ items = $badChecklist } | ConvertTo-Json -Depth 5)

$dupChecklist = @(
  @{ id = "chk_teaser"; checked = $true },
  @{ id = "chk_teaser"; checked = $false },
  @{ id = "chk_caption"; checked = $true },
  @{ id = "chk_tags"; checked = $true },
  @{ id = "chk_question"; checked = $true }
)
Invoke-ApiExpectFailure -Name "PATCH checklist rejects duplicate id" -Method PATCH -Headers $auth `
  -Path "/api/projects/$projectId/publish/$packageV2Id/checklist" `
  -Body (@{ items = $dupChecklist } | ConvertTo-Json -Depth 5)

$factsBeforeExport = (Invoke-Api -Path "/api/projects/$projectId/foundation" -Headers $auth).data.facts.Count
$exported = Invoke-Api -Method POST -Path "/api/projects/$projectId/publish/$packageV2Id/mark-exported" -Headers $auth `
  -Body '{"exportTarget":"kbm_manual_copy","note":"smoke manual copy"}'
Add-StepResult "mark-exported sets status" $(if (
    $exported.data.publishPackage.status -eq "exported" -and $exported.data.publishPackage.exportedAt
  ) { "PASS" } else { "FAIL" }) "status=$($exported.data.publishPackage.status)"

$factsAfterExport = (Invoke-Api -Path "/api/projects/$projectId/foundation" -Headers $auth).data.facts.Count
Add-StepResult "mark-exported no canon mutation" $(if ($factsAfterExport -eq $factsBeforeExport) { "PASS" } else { "FAIL" }) ""

$exportedJson = ($exported | ConvertTo-Json -Depth 20)
Add-StepResult "mark-exported response leak guard" $(if (Test-PublishJsonNoLeakMarkers $exportedJson) { "PASS" } else { "FAIL" }) ""

$exportMeta = $exported.data.publishPackage.metadata
$manualMarker = $false
if ($exportMeta -is [pscustomobject]) {
  $manualMarker = ($exportMeta.exportTarget -eq "kbm_manual_copy") -or ($exportMeta.exportedMarker -eq $true)
}
Add-StepResult "mark-exported manual marker only" $(if ($manualMarker) { "PASS" } else { "FAIL" }) "exportTarget=kbm_manual_copy"
Add-StepResult "mark-exported no external URL" $(if ($exportedJson -notmatch 'https?://[^"]*kbm') { "PASS" } else { "FAIL" }) ""

Invoke-ApiExpectFailure -Name "exported package fields locked" -Method PATCH -Headers $auth `
  -Path "/api/projects/$projectId/publish/$packageV2Id/fields" `
  -Body '{"teaser":"should fail"}'
Invoke-ApiExpectFailure -Name "exported package checklist locked" -Method PATCH -Headers $auth `
  -Path "/api/projects/$projectId/publish/$packageV2Id/checklist" `
  -Body (@{ items = $checklistItems } | ConvertTo-Json -Depth 5)

$exportedAgain = Invoke-Api -Method POST -Path "/api/projects/$projectId/publish/$packageV2Id/mark-exported" -Headers $auth `
  -Body '{"exportTarget":"kbm_manual_copy"}'
Add-StepResult "mark-exported idempotent" $(if ($exportedAgain.data.alreadyExported -eq $true) { "PASS" } else { "FAIL" }) ""

$pubV3 = Invoke-Api -Method POST -Path "/api/projects/$projectId/publish/generate" -Headers $auth `
  -Body (@{ chapterOutlineId = $ch1Id; regenerate = $true } | ConvertTo-Json)
$packageV3Id = $pubV3.data.publishPackage.id
$v2AfterRegen = Invoke-Api -Path "/api/projects/$projectId/publish/$packageV2Id" -Headers $auth
Add-StepResult "regenerate after exported keeps exported" $(if (
    $pubV3.data.created -eq $true -and
    $pubV3.data.publishPackage.packageVersion -eq 3 -and
    $v2AfterRegen.data.publishPackage.status -eq "exported" -and
    $v2AfterRegen.data.publishPackage.isCurrent -eq $false
  ) { "PASS" } else { "FAIL" }) "v3=$($pubV3.data.publishPackage.packageVersion)"

$signupB = Invoke-RestMethod -Uri "$SupabaseUrl/auth/v1/signup" -Method POST `
  -Headers @{ apikey = $anonKey; Authorization = "Bearer $anonKey" } -ContentType "application/json" `
  -Body (@{ email = "s7b-$(Get-Random)@example.com"; password = $TestPassword } | ConvertTo-Json)
$authB = @{ Authorization = "Bearer $($signupB.access_token)" }
Invoke-ApiExpectFailure -Name "cross-user publish list 404" -Method GET -Headers $authB `
  -Path "/api/projects/$projectId/publish"
Invoke-ApiExpectFailure -Name "cross-user publish detail 404" -Method GET -Headers $authB `
  -Path "/api/projects/$projectId/publish/$packageV2Id"
Invoke-ApiExpectFailure -Name "cross-user publish by-chapter 404" -Method GET -Headers $authB `
  -Path "/api/projects/$projectId/publish/by-chapter/$ch1Id"
Invoke-ApiExpectFailure -Name "cross-user PATCH fields 404" -Method PATCH -Headers $authB `
  -Path "/api/projects/$projectId/publish/$packageV3Id/fields" `
  -Body '{"teaser":"cross user"}'
Invoke-ApiExpectFailure -Name "cross-user PATCH checklist 404" -Method PATCH -Headers $authB `
  -Path "/api/projects/$projectId/publish/$packageV3Id/checklist" `
  -Body (@{ items = $checklistItems } | ConvertTo-Json -Depth 5)
Invoke-ApiExpectFailure -Name "cross-user mark-exported 404" -Method POST -Headers $authB `
  -Path "/api/projects/$projectId/publish/$packageV3Id/mark-exported" -Body '{}'

$publishRoutesPath = Join-Path $RepoRoot "apps\api\src\routes\publish.ts"
$publishRoutesText = Get-Content $publishRoutesPath -Raw
$hasKbmAutopost = $publishRoutesText -match 'autopost|platform\.post|fetch\(|https?://'
Add-StepResult "no KBM autopost route in publish API" $(if (-not $hasKbmAutopost) { "PASS" } else { "FAIL" }) "publish.ts static check"

$fail = @($Results | Where-Object { $_.Result -eq "FAIL" }).Count
Write-Host "`nSummary: $($Results.Count - $fail) PASS, $fail FAIL"
$Results | Format-Table Step, Test, Result, Detail -AutoSize
if ($fail -gt 0) { exit 1 }
exit 0