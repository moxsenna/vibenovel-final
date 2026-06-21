<#
.SYNOPSIS
  Sprint 14 Layer 0 - prose to summary to publish HTTP smoke against Node API.

.DESCRIPTION
  Run from repo root:
    npm run smoke:api:sprint14:e2e-node

  Prerequisites:
    - supabase start && supabase db reset
    - apps/api/.dev.vars:
        AI_GENERATION_ENABLED=true
        AI_PROVIDER_MOCK=true
        ALLOW_DETERMINISTIC_STORY_STUBS=true (optional with -StubOnly)
    - npm run dev:api:node  -> http://localhost:8787

.PARAMETER ApiBaseUrl
  Default http://localhost:8787 (Node).

.PARAMETER StubOnly
  Expect deterministic story stubs when AI is off.
#>
[CmdletBinding()]
param(
  [string]$ApiBaseUrl = "http://localhost:8787",
  [string]$SupabaseUrl = "http://127.0.0.1:54321",
  [string]$SupabaseAnonKey = "",
  [string]$TestEmail = "",
  [string]$TestPassword = "Narraza-Local-Smoke-Test!",
  [switch]$StubOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$Results = New-Object System.Collections.Generic.List[object]
$script:StepNumber = 0
$auth = @{}

function Add-StepResult {
  param([string]$Name, [ValidateSet("PASS", "FAIL", "SKIP", "NOT RUN")][string]$Result, [string]$Detail = "")
  $script:StepNumber++
  $Results.Add([PSCustomObject]@{ Step = $script:StepNumber; Test = $Name; Result = $Result; Detail = $Detail }) | Out-Null
  $color = switch ($Result) { "PASS" { "Green" } "FAIL" { "Red" } default { "Yellow" } }
  Write-Host ("[{0}] {1,-52} {2}" -f $Result, $Name, $Detail) -ForegroundColor $color
}

function Get-SafeDetail {
  param([string]$Text)
  if ([string]::IsNullOrWhiteSpace($Text)) { return "" }
  $sanitized = $Text -replace '(?i)(Bearer\s+)[^\s]+', '$1***'
  if ($sanitized.Length -gt 240) { return $sanitized.Substring(0, 240) + "..." }
  return $sanitized
}

function Resolve-SupabaseAnonKey {
  if (-not [string]::IsNullOrWhiteSpace($SupabaseAnonKey)) { return $SupabaseAnonKey.Trim() }
  if (-not [string]::IsNullOrWhiteSpace($env:SUPABASE_ANON_KEY)) { return $env:SUPABASE_ANON_KEY.Trim() }
  $envPath = Join-Path $RepoRoot "apps/api/.dev.vars"
  if (Test-Path $envPath) {
    foreach ($line in Get-Content $envPath) {
      if ($line -match '^\s*SUPABASE_ANON_KEY\s*=\s*(.+)\s*$') {
        return $Matches[1].Trim().Trim('"').Trim("'")
      }
    }
  }
  throw "Supabase anon key not found (set apps/api/.dev.vars SUPABASE_ANON_KEY or pass -SupabaseAnonKey)."
}

function Exit-SmokeFailure {
  param([string]$StepName, [string]$Detail)
  Add-StepResult $StepName "FAIL" (Get-SafeDetail $Detail)
  $fail = @($Results | Where-Object { $_.Result -eq "FAIL" }).Count
  Write-Host ""
  Write-Host "Summary: $($Results.Count - $fail) PASS, $fail FAIL" -ForegroundColor Red
  Write-Host 'Tip: keep npm run dev:api:node in another terminal; restart the API if it crashed mid-run.' -ForegroundColor DarkGray
  exit 1
}

function Wait-ApiReady {
  param([int]$TimeoutSec = 90, [int]$IntervalSec = 2)
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    try {
      $health = Invoke-RestMethod -Uri "$ApiBaseUrl/api/health" -Method GET -TimeoutSec 8 -DisableKeepAlive -ErrorAction Stop
      if ($health.ok -eq $true -and $null -ne $health.data) { return $health }
    } catch {
      # API still starting
    }
    Start-Sleep -Seconds $IntervalSec
  }
  return $null
}

function Invoke-Api {
  param(
    [ValidateSet("GET", "POST", "PATCH", "PUT", "DELETE")][string]$Method = "GET",
    [Parameter(Mandatory)][string]$Path,
    [hashtable]$Headers = @{},
    [string]$Body = $null,
    [int]$MaxAttempts = 4
  )
  $uri = "$ApiBaseUrl$Path"
  $lastError = $null
  for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
    try {
      $common = @{
        Uri              = $uri
        Method           = $Method
        Headers          = $Headers
        TimeoutSec       = 120
        DisableKeepAlive = $true
        ErrorAction      = "Stop"
      }
      if ($Method -eq "GET" -or $Method -eq "DELETE") {
        return Invoke-RestMethod @common
      }
      $postBody = if ($null -eq $Body) { "{}" } else { $Body }
      return Invoke-RestMethod @common -ContentType "application/json" -Body $postBody
    } catch {
      $lastError = $_
      $msg = $_.Exception.Message
      $retryable = $msg -match "connection was closed|Unable to connect|actively refused|forcibly closed|timed out"
      if (-not $retryable -or $attempt -ge $MaxAttempts) { throw }
      Start-Sleep -Seconds ([Math]::Min(8, 2 * $attempt))
      $null = Wait-ApiReady -TimeoutSec 15 -IntervalSec 2
    }
  }
  throw $lastError
}

function Invoke-ApiStep {
  param(
    [string]$StepName,
    [scriptblock]$Action,
    [string]$PassDetail = ""
  )
  try {
    $result = & $Action
    Add-StepResult $StepName "PASS" $PassDetail
    return $result
  } catch {
    Exit-SmokeFailure $StepName $_.Exception.Message
  }
}
function Test-FoundationProposalAcceptable {
  param($Proposal)
  $ptype = if ($Proposal.type) { $Proposal.type } else { $Proposal.proposalType }
  if ($ptype -in @('secret', 'reveal', 'chapter_delta')) { return $false }
  if ($ptype -notin @('foundation', 'character', 'fact', 'relationship_speech_rule', 'style')) { return $false }
  if ($ptype -eq 'fact') {
    if ($Proposal.riskLevel -eq 'high') { return $false }
    $payload = $Proposal.payload
    if ($null -ne $payload -and $payload.category -eq 'secret') { return $false }
  }
  return $true
}

function Bootstrap-FoundationLocked {
  param([string]$ProjectId)
  Invoke-ApiStep "bootstrap intake/messages" {
    Invoke-Api -Method POST -Path "/api/projects/$ProjectId/intake/messages" -Headers $auth `
      -Body '{"content":"Cerita drama rumah tangga dengan konflik keluarga dan rahasia masa lalu."}' | Out-Null
  }
  Invoke-ApiStep "bootstrap intake/extract-signals" {
    Invoke-Api -Method POST -Path "/api/projects/$ProjectId/intake/extract-signals" -Headers $auth | Out-Null
  }
  $concepts = Invoke-ApiStep "bootstrap concepts/generate" {
    Invoke-Api -Method POST -Path "/api/projects/$ProjectId/concepts/generate" -Headers $auth
  }
  $conceptId = $concepts.data.concepts[0].id
  Invoke-ApiStep "bootstrap concepts/select" {
    Invoke-Api -Method POST -Path "/api/projects/$ProjectId/concepts/$conceptId/select" -Headers $auth | Out-Null
  }
  $proposals = Invoke-ApiStep "bootstrap foundation/proposals/generate" {
    Invoke-Api -Method POST -Path "/api/projects/$ProjectId/foundation/proposals/generate" -Headers $auth
  }
  foreach ($p in $proposals.data.proposals) {
    $ptype = if ($p.type) { $p.type } else { $p.proposalType }
    if (-not (Test-FoundationProposalAcceptable $p)) {
      Add-StepResult "bootstrap skip proposal $ptype" "SKIP" "not directly promotable"
      continue
    }
    try {
      Invoke-Api -Method POST -Path "/api/projects/$ProjectId/foundation/proposals/$($p.id)/accept" -Headers $auth | Out-Null
      Add-StepResult "bootstrap accept proposal $ptype" "PASS" ""
    } catch {
      $msg = $_.Exception.Message
      if ($msg -match '409|Conflict') {
        Add-StepResult "bootstrap accept proposal $ptype" "SKIP" "409 not promotable"
      } else {
        Exit-SmokeFailure "bootstrap accept proposal $ptype" $msg
      }
    }
  }
  Invoke-ApiStep "bootstrap foundation/lock" {
    Invoke-Api -Method POST -Path "/api/projects/$ProjectId/foundation/lock" -Headers $auth | Out-Null
  }
}

Write-Host ""
Write-Host "Narraza Sprint 14 E2E Prose -> Publish (Node API)" -ForegroundColor Cyan
Write-Host "API: $ApiBaseUrl" -ForegroundColor DarkGray
if ($StubOnly) { Write-Host "Mode: stub (deterministic story stubs)" -ForegroundColor DarkGray }

$health = Wait-ApiReady
if (-not $health) {
  Exit-SmokeFailure "API ready poll" "GET /api/health did not return ok within 90s. Start: npm run dev:api:node"
}
Add-StepResult "GET /api/health" "PASS" "service=$($health.data.service)"

$anonKey = Resolve-SupabaseAnonKey
if ([string]::IsNullOrWhiteSpace($TestEmail)) {
  $TestEmail = "s14e2e-$(Get-Random -Maximum 99999999)@example.com"
}

try {
  $signup = Invoke-RestMethod -Uri "$SupabaseUrl/auth/v1/signup" -Method POST -DisableKeepAlive `
    -Headers @{ apikey = $anonKey; Authorization = "Bearer $anonKey" } -ContentType "application/json" `
    -Body (@{ email = $TestEmail; password = $TestPassword } | ConvertTo-Json) -ErrorAction Stop
  $token = $signup.access_token
  if (-not $token) { throw "signup returned no access_token" }
  Add-StepResult "signup/login" "PASS" "email=$TestEmail"
} catch {
  Exit-SmokeFailure "signup/login" $_.Exception.Message
}

$auth = @{ Authorization = "Bearer $token" }

$created = Invoke-ApiStep "POST /api/projects" {
  Invoke-Api -Method POST -Path "/api/projects" -Headers $auth -Body '{"title":"S14 E2E","entryPath":"rough_idea"}'
}
$projectId = $created.data.id
Add-StepResult "POST /api/projects id" "PASS" "projectId=$projectId"

Bootstrap-FoundationLocked -ProjectId $projectId

Invoke-ApiStep "outline generate" {
  Invoke-Api -Method POST -Path "/api/projects/$projectId/outline/generate" -Headers $auth | Out-Null
}
Invoke-ApiStep "outline approve" {
  Invoke-Api -Method POST -Path "/api/projects/$projectId/outline/approve" -Headers $auth | Out-Null
}
Invoke-ApiStep "outline lock" {
  Invoke-Api -Method POST -Path "/api/projects/$projectId/outline/lock" -Headers $auth | Out-Null
}

$chapters = Invoke-ApiStep "GET outline chapters" {
  Invoke-Api -Path "/api/projects/$projectId/outline/chapters" -Headers $auth
}
$ch1Row = $chapters.data.chapters | Where-Object { $_.chapterNumber -eq 1 } | Select-Object -First 1
if (-not $ch1Row -or -not $ch1Row.id) {
  Exit-SmokeFailure "resolve chapter 1" "no chapter with chapterNumber=1 (count=$($chapters.data.chapters.Count))"
}
$ch1 = $ch1Row.id
Add-StepResult "resolve chapter 1" "PASS" "ch1=$ch1"

$session = Invoke-ApiStep "POST write session" {
  Invoke-Api -Method POST -Path "/api/projects/$projectId/write/sessions" -Headers $auth `
    -Body (@{ chapterOutlineId = $ch1 } | ConvertTo-Json -Compress)
}
$sessionId = $session.data.session.id
if (-not $sessionId) { Exit-SmokeFailure "write session id" "missing session.id" }

$genBeats = Invoke-ApiStep "POST beats/generate" {
  Invoke-Api -Method POST -Path "/api/projects/$projectId/write/sessions/$sessionId/beats/generate" -Headers $auth
}
$beatCount = @($genBeats.data.beats).Count
if ($beatCount -lt 1) { Exit-SmokeFailure "beats count" "expected >= 1, got $beatCount" }
Add-StepResult "beats count" "PASS" "count=$beatCount"

$beatId = $genBeats.data.beats[0].id
Invoke-ApiStep "POST beat prose" {
  Invoke-Api -Method POST -Path "/api/projects/$projectId/write/beats/$beatId/prose" -Headers $auth `
    -Body '{"proseText":"Nadira memangkas sayuran di dapur dengan irama yang sudah hafal di luar kepala."}' | Out-Null
}

Invoke-ApiStep "POST ready-for-summary" {
  Invoke-Api -Method POST -Path "/api/projects/$projectId/write/sessions/$sessionId/ready-for-summary" -Headers $auth | Out-Null
}

$genSummary = Invoke-ApiStep "POST summary/generate" {
  Invoke-Api -Method POST -Path "/api/projects/$projectId/summary/generate" -Headers $auth `
    -Body (@{ chapterOutlineId = $ch1; writingSessionId = $sessionId } | ConvertTo-Json -Compress)
}
$summaryId = $genSummary.data.summary.id
if (-not $summaryId) { Exit-SmokeFailure "summary id" "missing summary.id" }
Add-StepResult "summary id" "PASS" "id=$summaryId"

Invoke-ApiStep "POST summary/approve" {
  Invoke-Api -Method POST -Path "/api/projects/$projectId/summary/$summaryId/approve" -Headers $auth | Out-Null
}

$pub = Invoke-ApiStep "POST publish/generate" {
  Invoke-Api -Method POST -Path "/api/projects/$projectId/publish/generate" -Headers $auth `
    -Body (@{ chapterOutlineId = $ch1 } | ConvertTo-Json -Compress)
}
$pkgId = $pub.data.publishPackage.id
if (-not $pkgId) { Exit-SmokeFailure "publish package id" "missing publishPackage.id" }
Add-StepResult "publish package id" "PASS" "packageId=$pkgId"

$fail = @($Results | Where-Object { $_.Result -eq "FAIL" }).Count
Write-Host ""
Write-Host "Summary: $($Results.Count - $fail) PASS, $fail FAIL" -ForegroundColor $(if ($fail -gt 0) { "Red" } else { "Green" })
if ($fail -gt 0) { exit 1 }
exit 0