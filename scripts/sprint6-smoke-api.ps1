<#
.SYNOPSIS
  Sprint 6 Summary/Delta/Approval API safety & regression smoke (Task 6.2–6.6).

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
    'full_prompt', 'openrouter', '"proseText"\s*:', '"prose_text"\s*:',
    '"provider"\s*:', '"model"\s*:', '"token"\s*:'
  )
  foreach ($p in $patterns) {
    if ($JsonText -match $p) { return $false }
  }
  return $true
}

function Test-ProposalResponseSafe {
  param([string]$JsonText)
  $forbidden = @(
    'prose_text', 'proseText', 'packet_json', 'packetJson', 'planningTruth',
    'planning_truth', 'full_prompt', 'openrouter'
  )
  foreach ($f in $forbidden) {
    if ($JsonText -match $f) { return $false }
  }
  return $true
}

function Get-AuditLogsByAction {
  param([string]$ProjectId, [string]$Action, [hashtable]$AuthHeaders, [string]$AnonKey)
  $headers = @{
    apikey        = $AnonKey
    Authorization = $AuthHeaders.Authorization
  }
  $uri = "$SupabaseUrl/rest/v1/audit_logs?project_id=eq.$ProjectId&action=eq.$Action&select=action,entity_type,entity_id,metadata,before_data,after_data&order=created_at.desc&limit=20"
  return @(Invoke-RestMethod -Uri $uri -Method GET -Headers $headers -ErrorAction Stop)
}

function Test-AuditPayloadSafe {
  param([string]$JsonText)
  $forbidden = @(
    'packet_json', 'packetJson', 'planningTruth', 'planning_truth', 'delta_json', 'deltaJson',
    'prose_text', 'proseText', 'content_text', 'contentText', 'full_prompt', 'service_role', 'openrouter'
  )
  foreach ($f in $forbidden) {
    if ($JsonText -match $f) { return $false }
  }
  return $true
}

function Assert-AuditActionExists {
  param([string]$Name, [string]$ProjectId, [string]$Action, [hashtable]$AuthHeaders, [string]$AnonKey)
  try {
    $rows = Get-AuditLogsByAction -ProjectId $ProjectId -Action $Action -AuthHeaders $AuthHeaders -AnonKey $AnonKey
    if ($rows.Count -lt 1) {
      Add-StepResult $Name "FAIL" "no audit row for $Action"
      return
    }
    $json = ($rows | ConvertTo-Json -Depth 12)
    $safe = Test-AuditPayloadSafe $json
    Add-StepResult $Name $(if ($safe) { "PASS" } else { "FAIL" }) "count=$($rows.Count)"
  } catch {
    Add-StepResult $Name "FAIL" $_.Exception.Message.Substring(0, [Math]::Min(80, $_.Exception.Message.Length))
  }
}

function Test-LinkedProposalStatus {
  param(
    [string]$SummaryId,
    [string]$ProposalId,
    [string]$ExpectedStatus,
    [string]$ExpectedLinkStatus
  )
  $prop = Invoke-Api -Path "/api/projects/$projectId/summary/$SummaryId/proposals" -Headers $auth
  $match = $prop.data.proposals | Where-Object { $_.proposalId -eq $ProposalId } | Select-Object -First 1
  if (-not $match) { return $false }
  return ($match.status -eq $ExpectedStatus -and $match.linkStatus -eq $ExpectedLinkStatus)
}

function Assert-ProposalStatus {
  param(
    [string]$Name,
    [string]$SummaryId,
    [string]$ProposalId,
    [string]$ExpectedStatus,
    [string]$ExpectedLinkStatus
  )
  $ok = Test-LinkedProposalStatus -SummaryId $SummaryId -ProposalId $ProposalId `
    -ExpectedStatus $ExpectedStatus -ExpectedLinkStatus $ExpectedLinkStatus
  Add-StepResult $Name $(if ($ok) { "PASS" } else { "FAIL" }) "expect=$ExpectedStatus/$ExpectedLinkStatus"
}

function Get-SpeechRulesCount {
  param([string]$ProjectId)
  $res = Invoke-Api -Path "/api/projects/$ProjectId/speech-rules" -Headers $auth
  if ($res.data -is [array]) { return $res.data.Count }
  if ($null -ne $res.data.rules) { return $res.data.rules.Count }
  return 0
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
$speechBefore = Get-SpeechRulesCount -ProjectId $projectId
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

Invoke-Api -Method PATCH -Path "/api/projects/$projectId/write/beats/$beatId" -Headers $auth `
  -Body '{"mustInclude":["rahasia identitas keluarga tersembunyi di balik dapur"]}' | Out-Null

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
$listJson = ($list | ConvertTo-Json -Depth 20)
Add-StepResult "GET summary list leak guard" $(if (Test-JsonNoLeakMarkers $listJson) { "PASS" } else { "FAIL" }) ""

$detail = Invoke-Api -Path "/api/projects/$projectId/summary/$summaryId" -Headers $auth
Add-StepResult "GET summary detail" $(if ($detail.data.summary.id -eq $summaryId) { "PASS" } else { "FAIL" }) ""
$detailJson = ($detail | ConvertTo-Json -Depth 20)
Add-StepResult "GET summary detail leak guard" $(if (Test-JsonNoLeakMarkers $detailJson) { "PASS" } else { "FAIL" }) ""

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

$v1Detail = Invoke-Api -Path "/api/projects/$projectId/summary/$summaryId" -Headers $auth
Add-StepResult "regenerate supersedes previous" $(if ($v1Detail.data.summary.isCurrent -eq $false) { "PASS" } else { "FAIL" }) "v1 current=$($v1Detail.data.summary.isCurrent)"

$foundationAfter = Invoke-Api -Path "/api/projects/$projectId/foundation" -Headers $auth
$loopsAfter = (Invoke-Api -Path "/api/projects/$projectId/outline/open-loops" -Headers $auth).data.openLoops.Count
$revealsAfter = (Invoke-Api -Path "/api/projects/$projectId/outline/reveals" -Headers $auth).data.reveals.Count
$propResAfter = Invoke-Api -Path "/api/projects/$projectId/proposals?includeResolved=true" -Headers $auth
$proposalsAfter = if ($propResAfter.data -is [array]) { $propResAfter.data.Count } else { 0 }

$speechAfter = Get-SpeechRulesCount -ProjectId $projectId
Add-StepResult "no canon mutation" $(if (
    $foundationAfter.data.facts.Count -eq $factsBefore -and
    $foundationAfter.data.characters.Count -eq $charsBefore -and
    $speechAfter -eq $speechBefore -and
    $loopsAfter -eq $loopsBefore -and
    $revealsAfter -eq $revealsBefore
  ) { "PASS" } else { "FAIL" }) ""

Add-StepResult "no ai_proposals created" $(if ($proposalsAfter -eq $proposalsBefore) { "PASS" } else { "FAIL" }) "before=$proposalsBefore after=$proposalsAfter"

$sessionAfter = Invoke-Api -Path "/api/projects/$projectId/write/sessions/$sessionId" -Headers $auth
Add-StepResult "not summarized yet" $(if ($sessionAfter.data.writingState.status -eq "ready_for_summary") { "PASS" } else { "FAIL" }) ""

$currentSummaryId = $genV2.data.summary.id
$proposalsBeforeDelta = $proposalsAfter

Invoke-ApiExpectFailure -Name "POST delta extract no token" -Method POST `
  -Path "/api/projects/$projectId/summary/$currentSummaryId/delta/extract" `
  -Body '{}'

Invoke-ApiExpectFailure -Name "extract before summary exists" -Method POST -Headers $auth `
  -Path "/api/projects/$projectId/summary/00000000-0000-4000-8000-000000009999/delta/extract" `
  -Body '{}'

$extract = Invoke-Api -Method POST -Path "/api/projects/$projectId/summary/$currentSummaryId/delta/extract" -Headers $auth -Body '{}'
$deltaId = $extract.data.delta.id
$linkedCount = $extract.data.proposals.Count
Add-StepResult "POST delta extract" $(if ($extract.data.created -eq $true -and $deltaId) { "PASS" } else { "FAIL" }) "deltaId=$deltaId"
Add-StepResult "proposals created from delta" $(if ($linkedCount -ge 1 -and $linkedCount -le 5) { "PASS" } else { "FAIL" }) "count=$linkedCount"

$extractJson = ($extract | ConvertTo-Json -Depth 20)
Add-StepResult "delta/proposal leak guard" $(if (Test-JsonNoLeakMarkers $extractJson) { "PASS" } else { "FAIL" }) ""

$deltaGet = Invoke-Api -Path "/api/projects/$projectId/summary/$currentSummaryId/delta" -Headers $auth
Add-StepResult "GET summary delta" $(if ($deltaGet.data.delta.id -eq $deltaId) { "PASS" } else { "FAIL" }) ""

$deltaGetJson = ($deltaGet | ConvertTo-Json -Depth 20)
Add-StepResult "GET delta leak guard" $(if (Test-JsonNoLeakMarkers $deltaGetJson) { "PASS" } else { "FAIL" }) ""

$propGet = Invoke-Api -Path "/api/projects/$projectId/summary/$currentSummaryId/proposals" -Headers $auth
Add-StepResult "GET summary proposals" $(if ($propGet.data.proposals.Count -ge 1) { "PASS" } else { "FAIL" }) ""
$propGetJson = ($propGet | ConvertTo-Json -Depth 20)
Add-StepResult "proposals response safe excerpt" $(if (Test-ProposalResponseSafe $propGetJson) { "PASS" } else { "FAIL" }) ""

$allLinked = $true
$noneAcceptedOnExtract = $true
foreach ($p in $propGet.data.proposals) {
  if ($p.linkStatus -ne "linked") { $allLinked = $false }
  if ($p.status -ne "proposed" -or $p.linkStatus -eq "accepted") { $noneAcceptedOnExtract = $false }
}
Add-StepResult "proposals linked not accepted" $(if ($allLinked -and $noneAcceptedOnExtract) { "PASS" } else { "FAIL" }) ""

Invoke-ApiExpectFailure -Name "delta regenerate blocked" -Method POST -Headers $auth `
  -Path "/api/projects/$projectId/summary/$currentSummaryId/delta/extract" `
  -Body '{"regenerate":true}'

$extractAgain = Invoke-Api -Method POST -Path "/api/projects/$projectId/summary/$currentSummaryId/delta/extract" -Headers $auth -Body '{}'
Add-StepResult "delta extract idempotent" $(if (
    $extractAgain.data.created -eq $false -and $extractAgain.data.delta.id -eq $deltaId
  ) { "PASS" } else { "FAIL" }) ""

Assert-AuditActionExists -Name "audit chapter_delta_extracted" -ProjectId $projectId `
  -Action "chapter_delta_extracted" -AuthHeaders $auth -AnonKey $anonKey
Assert-AuditActionExists -Name "audit summary_proposal_linked" -ProjectId $projectId `
  -Action "summary_proposal_linked" -AuthHeaders $auth -AnonKey $anonKey

$allProposed = $true
foreach ($p in $propGet.data.proposals) {
  if ($p.status -ne "proposed") { $allProposed = $false }
}
Add-StepResult "proposals remain proposed" $(if ($allProposed) { "PASS" } else { "FAIL" }) ""

$propResDelta = Invoke-Api -Path "/api/projects/$projectId/proposals?includeResolved=true" -Headers $auth
$proposalsAfterDelta = if ($propResDelta.data -is [array]) { $propResDelta.data.Count } else { 0 }
Add-StepResult "delta proposals added" $(if ($proposalsAfterDelta -gt $proposalsBeforeDelta) { "PASS" } else { "FAIL" }) "before=$proposalsBeforeDelta after=$proposalsAfterDelta"

$foundationDelta = Invoke-Api -Path "/api/projects/$projectId/foundation" -Headers $auth
$loopsDelta = (Invoke-Api -Path "/api/projects/$projectId/outline/open-loops" -Headers $auth).data.openLoops.Count
$revealsDelta = (Invoke-Api -Path "/api/projects/$projectId/outline/reveals" -Headers $auth).data.reveals.Count
$speechDelta = Get-SpeechRulesCount -ProjectId $projectId
Add-StepResult "no canon mutation after delta" $(if (
    $foundationDelta.data.facts.Count -eq $factsBefore -and
    $foundationDelta.data.characters.Count -eq $charsBefore -and
    $speechDelta -eq $speechBefore -and
    $loopsDelta -eq $loopsBefore -and
    $revealsDelta -eq $revealsBefore
  ) { "PASS" } else { "FAIL" }) ""

$signupB = Invoke-RestMethod -Uri "$SupabaseUrl/auth/v1/signup" -Method POST `
  -Headers @{ apikey = $anonKey; Authorization = "Bearer $anonKey" } -ContentType "application/json" `
  -Body (@{ email = "s6b-$(Get-Random)@example.com"; password = $TestPassword } | ConvertTo-Json)
$authB = @{ Authorization = "Bearer $($signupB.access_token)" }
Invoke-ApiExpectFailure -Name "cross-user summary list 404" -Method GET -Headers $authB `
  -Path "/api/projects/$projectId/summary"
Invoke-ApiExpectFailure -Name "cross-user summary 404" -Method GET -Headers $authB `
  -Path "/api/projects/$projectId/summary/$summaryId"
Invoke-ApiExpectFailure -Name "cross-user delta 404" -Method GET -Headers $authB `
  -Path "/api/projects/$projectId/summary/$currentSummaryId/delta"
Invoke-ApiExpectFailure -Name "cross-user proposals 404" -Method GET -Headers $authB `
  -Path "/api/projects/$projectId/summary/$currentSummaryId/proposals"

$factProposal = $propGet.data.proposals | Where-Object { $_.type -eq "fact" } | Select-Object -First 1
$revealProposal = $propGet.data.proposals | Where-Object { $_.type -eq "reveal_status_update" } | Select-Object -First 1

Invoke-ApiExpectFailure -Name "POST approve no token" -Method POST `
  -Path "/api/projects/$projectId/summary/$currentSummaryId/approve" -Body '{}'

if ($factProposal) {
  Invoke-ApiExpectFailure -Name "accept before approve" -Method POST -Headers $auth `
    -Path "/api/projects/$projectId/summary/$currentSummaryId/proposals/$($factProposal.proposalId)/accept" -Body '{}'
  Assert-ProposalStatus -Name "accept before approve stays proposed" `
    -SummaryId $currentSummaryId -ProposalId $factProposal.proposalId `
    -ExpectedStatus "proposed" -ExpectedLinkStatus "linked"
}

$factsBeforeApprove = (Invoke-Api -Path "/api/projects/$projectId/foundation" -Headers $auth).data.facts.Count

$approve = Invoke-Api -Method POST -Path "/api/projects/$projectId/summary/$currentSummaryId/approve" -Headers $auth -Body '{}'
Add-StepResult "POST approve summary" $(if ($approve.data.summary.status -eq "approved") { "PASS" } else { "FAIL" }) ""

$factsAfterApprove = (Invoke-Api -Path "/api/projects/$projectId/foundation" -Headers $auth).data.facts.Count
Add-StepResult "approve no canon mutation" $(if ($factsAfterApprove -eq $factsBeforeApprove) { "PASS" } else { "FAIL" }) ""

$approveJson = ($approve | ConvertTo-Json -Depth 20)
Add-StepResult "approve response leak guard" $(if (Test-JsonNoLeakMarkers $approveJson) { "PASS" } else { "FAIL" }) ""

Add-StepResult "approve proposalCounts no accept" $(if ($approve.data.proposalCounts.accepted -eq 0) { "PASS" } else { "FAIL" }) "accepted=$($approve.data.proposalCounts.accepted)"

$propAfterApprove = Invoke-Api -Path "/api/projects/$projectId/summary/$currentSummaryId/proposals" -Headers $auth
$stillProposedAfterApprove = $true
foreach ($p in $propAfterApprove.data.proposals) {
  if ($p.status -ne "proposed") { $stillProposedAfterApprove = $false }
}
Add-StepResult "approve no auto-accept proposals" $(if ($stillProposedAfterApprove) { "PASS" } else { "FAIL" }) ""

$relProposal = $propAfterApprove.data.proposals | Where-Object {
  $_.type -eq "relationship_update" -and $_.status -eq "proposed"
} | Select-Object -First 1
if ($relProposal) {
  Invoke-ApiExpectFailure -Name "relationship accept unsupported" -Method POST -Headers $auth `
    -Path "/api/projects/$projectId/summary/$currentSummaryId/proposals/$($relProposal.proposalId)/accept" -Body '{}'
  Assert-ProposalStatus -Name "unsupported promotion stays proposed" `
    -SummaryId $currentSummaryId -ProposalId $relProposal.proposalId `
    -ExpectedStatus "proposed" -ExpectedLinkStatus "linked"
}

$sessionPostApprove = Invoke-Api -Path "/api/projects/$projectId/write/sessions/$sessionId" -Headers $auth
Add-StepResult "session completed after approve" $(if ($sessionPostApprove.data.session.status -eq "completed") { "PASS" } else { "FAIL" }) ""
Add-StepResult "writing state summarized" $(if ($sessionPostApprove.data.writingState.status -eq "summarized") { "PASS" } else { "FAIL" }) ""

$approveAgain = Invoke-Api -Method POST -Path "/api/projects/$projectId/summary/$currentSummaryId/approve" -Headers $auth -Body '{}'
Add-StepResult "approve idempotent" $(if ($approveAgain.data.alreadyApproved -eq $true) { "PASS" } else { "FAIL" }) ""

Assert-AuditActionExists -Name "audit chapter_summary_approved" -ProjectId $projectId `
  -Action "chapter_summary_approved" -AuthHeaders $auth -AnonKey $anonKey

if ($revealProposal) {
  Invoke-ApiExpectFailure -Name "reveal accept without confirm" -Method POST -Headers $auth `
    -Path "/api/projects/$projectId/summary/$currentSummaryId/proposals/$($revealProposal.proposalId)/accept" -Body '{}'
  Assert-ProposalStatus -Name "reveal accept stays proposed" `
    -SummaryId $currentSummaryId -ProposalId $revealProposal.proposalId `
    -ExpectedStatus "proposed" -ExpectedLinkStatus "linked"
  Assert-AuditActionExists -Name "audit canon_promotion_failed reveal" -ProjectId $projectId `
    -Action "canon_promotion_failed" -AuthHeaders $auth -AnonKey $anonKey
  $factsBeforeReject = (Invoke-Api -Path "/api/projects/$projectId/foundation" -Headers $auth).data.facts.Count
  Invoke-Api -Method POST -Path "/api/projects/$projectId/summary/$currentSummaryId/proposals/$($revealProposal.proposalId)/reject" -Headers $auth `
    -Body '{"reason":"smoke skip reveal"}' | Out-Null
  $factsAfterReject = (Invoke-Api -Path "/api/projects/$projectId/foundation" -Headers $auth).data.facts.Count
  Add-StepResult "reject linked proposal" "PASS" "reveal"
  Add-StepResult "reject no canon mutation" $(if ($factsAfterReject -eq $factsBeforeReject) { "PASS" } else { "FAIL" }) ""
} elseif ($factProposal) {
  Invoke-Api -Method POST -Path "/api/projects/$projectId/summary/$currentSummaryId/proposals/$($factProposal.proposalId)/reject" -Headers $auth `
    -Body '{"reason":"smoke reject path"}' | Out-Null
  Add-StepResult "reject linked proposal" "PASS" "fact"
  $genV3 = Invoke-Api -Method POST -Path "/api/projects/$projectId/summary/generate" -Headers $auth `
    -Body (@{ chapterOutlineId = $ch1; regenerate = $true } | ConvertTo-Json)
  $currentSummaryId = $genV3.data.summary.id
  Invoke-Api -Method POST -Path "/api/projects/$projectId/summary/$currentSummaryId/delta/extract" -Headers $auth -Body '{}' | Out-Null
  Invoke-Api -Method POST -Path "/api/projects/$projectId/summary/$currentSummaryId/approve" -Headers $auth -Body '{}' | Out-Null
  $propGet = Invoke-Api -Path "/api/projects/$projectId/summary/$currentSummaryId/proposals" -Headers $auth
  $factProposal = $propGet.data.proposals | Where-Object { $_.type -eq "fact" -and $_.status -eq "proposed" } | Select-Object -First 1
}

if ($factProposal -and $factProposal.status -eq "proposed") {
  $acceptFact = Invoke-Api -Method POST -Path "/api/projects/$projectId/summary/$currentSummaryId/proposals/$($factProposal.proposalId)/accept" -Headers $auth -Body '{}'
  Add-StepResult "accept fact proposal" $(if ($acceptFact.data.promoted.entityType -eq "fact") { "PASS" } else { "FAIL" }) ""
  $acceptJson = ($acceptFact | ConvertTo-Json -Depth 20)
  Add-StepResult "accept response leak guard" $(if (Test-JsonNoLeakMarkers $acceptJson) { "PASS" } else { "FAIL" }) ""
  Add-StepResult "accept link status" $(if ($acceptFact.data.proposal.linkStatus -eq "accepted") { "PASS" } else { "FAIL" }) ""

  $factsAfterAccept = (Invoke-Api -Path "/api/projects/$projectId/foundation" -Headers $auth).data.facts.Count
  Add-StepResult "fact creates confirmed canon" $(if ($factsAfterAccept -gt $factsBeforeApprove) { "PASS" } else { "FAIL" }) "before=$factsBeforeApprove after=$factsAfterAccept"

  $acceptAgain = Invoke-Api -Method POST -Path "/api/projects/$projectId/summary/$currentSummaryId/proposals/$($factProposal.proposalId)/accept" -Headers $auth -Body '{}'
  Add-StepResult "accept idempotent" $(if ($acceptAgain.data.alreadyAccepted -eq $true) { "PASS" } else { "FAIL" }) ""

  Assert-AuditActionExists -Name "audit summary_proposal_accepted" -ProjectId $projectId `
    -Action "summary_proposal_accepted" -AuthHeaders $auth -AnonKey $anonKey
  Assert-AuditActionExists -Name "audit canon_promotion_applied" -ProjectId $projectId `
    -Action "canon_promotion_applied" -AuthHeaders $auth -AnonKey $anonKey

  Invoke-ApiExpectFailure -Name "reject accepted proposal" -Method POST -Headers $auth `
    -Path "/api/projects/$projectId/summary/$currentSummaryId/proposals/$($factProposal.proposalId)/reject" -Body '{}'
  Assert-ProposalStatus -Name "reject accepted status unchanged" `
    -SummaryId $currentSummaryId -ProposalId $factProposal.proposalId `
    -ExpectedStatus "accepted" -ExpectedLinkStatus "accepted"
} else {
  Add-StepResult "accept fact proposal" "FAIL" "no proposed fact"
  Add-StepResult "fact creates confirmed canon" "FAIL" "skipped"
  Add-StepResult "accept idempotent" "FAIL" "skipped"
  Invoke-ApiExpectFailure -Name "reject accepted proposal" -Method POST -Headers $auth `
    -Path "/api/projects/$projectId/summary/$currentSummaryId/proposals/00000000-0000-4000-8000-000000000099/reject" -Body '{}'
}

Invoke-ApiExpectFailure -Name "cross-user approve 404" -Method POST -Headers $authB `
  -Path "/api/projects/$projectId/summary/$currentSummaryId/approve" -Body '{}'
if ($factProposal) {
  Invoke-ApiExpectFailure -Name "cross-user accept 404" -Method POST -Headers $authB `
    -Path "/api/projects/$projectId/summary/$currentSummaryId/proposals/$($factProposal.proposalId)/accept" -Body '{}'
}
if ($revealProposal) {
  Invoke-ApiExpectFailure -Name "cross-user reject 404" -Method POST -Headers $authB `
    -Path "/api/projects/$projectId/summary/$currentSummaryId/proposals/$($revealProposal.proposalId)/reject" -Body '{}'
}

$fail = @($Results | Where-Object { $_.Result -eq "FAIL" }).Count
Write-Host "`nSummary: $($Results.Count - $fail) PASS, $fail FAIL"
$Results | Format-Table Step, Test, Result, Detail -AutoSize
if ($fail -gt 0) { exit 1 }
exit 0