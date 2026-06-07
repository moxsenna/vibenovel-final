<#
.SYNOPSIS
  Sprint 5 context packet API smoke test for local VibeNovel development.
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
  [string]$Chapter2Title = "Pesan di Ponsel Arman"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Continue"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$Results = New-Object System.Collections.Generic.List[object]
$StepNumber = 0
$token = $null
$projectId = $null
$packetLogId = $null
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

Write-Host "`nVibeNovel Sprint 5 Context Packet API Smoke Test" -ForegroundColor Cyan

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

$build = Invoke-Api -Method POST -Path "/api/projects/$projectId/write/context-packet" -Headers $auth `
  -Body (@{ chapterOutlineId = $ch1 } | ConvertTo-Json)
$packetLogId = $build.data.packetLogId
Add-StepResult "POST context-packet ch1" $(if ($packetLogId) { "PASS" } else { "FAIL" }) "logId=$packetLogId"

$serialized = ($build | ConvertTo-Json -Depth 20)
Add-StepResult "response excludes packetJson" $(if ($serialized -notmatch 'packetJson' -and $serialized -notmatch 'packet_json') { "PASS" } else { "FAIL" }) ""
Add-StepResult "response no planningTruth" $(if ($serialized -notmatch '"planningTruth"\s*:' -and $serialized -notmatch 'planning_truth') { "PASS" } else { "FAIL" }) ""
Add-StepResult "ch1 response no ch2 title" $(if ($serialized -notmatch [regex]::Escape($Chapter2Title)) { "PASS" } else { "FAIL" }) ""

$preview = Invoke-Api -Path "/api/projects/$projectId/write/context-packet/$packetLogId/preview" -Headers $auth
Add-StepResult "GET preview by logId" $(if ($preview.data.preview.packetLogId) { "PASS" } else { "FAIL" }) ""

$pvJson = ($preview | ConvertTo-Json -Depth 20)
Add-StepResult "GET preview redacted" $(if ($pvJson -notmatch 'packetJson' -and $pvJson -notmatch 'planning_truth') { "PASS" } else { "FAIL" }) ""

$signupB = Invoke-RestMethod -Uri "$SupabaseUrl/auth/v1/signup" -Method POST `
  -Headers @{ apikey = $anonKey; Authorization = "Bearer $anonKey" } -ContentType "application/json" `
  -Body (@{ email = "s5b-$(Get-Random)@example.com"; password = $TestPassword } | ConvertTo-Json)
$authB = @{ Authorization = "Bearer $($signupB.access_token)" }
Invoke-ApiExpectFailure -Name "cross-user project 404" -Method POST -Headers $authB `
  -Path "/api/projects/$SeedProjectId/write/context-packet" `
  -Body (@{ chapterOutlineId = $Chapter1OutlineId } | ConvertTo-Json)

$foundationPost = Invoke-Api -Path "/api/projects/$projectId/foundation" -Headers $auth
Add-StepResult "canon counts unchanged" $(if ($foundationPost.data.facts.Count -eq $factsBefore -and $foundationPost.data.characters.Count -eq $charsBefore) { "PASS" } else { "FAIL" }) ""

$fail = @($Results | Where-Object { $_.Result -eq "FAIL" }).Count
Write-Host "`nSummary: $($Results.Count - $fail) PASS, $fail FAIL"
if ($fail -gt 0) { exit 1 }
exit 0