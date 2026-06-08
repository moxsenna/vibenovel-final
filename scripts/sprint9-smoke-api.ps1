<#
.SYNOPSIS
  Sprint 9 AI API safety smoke — prose rewrite (9.3) + publish copy (9.5).

.DESCRIPTION
  Run from repo root:
    powershell -ExecutionPolicy Bypass -File scripts/sprint9-smoke-api.ps1

  Prerequisites:
    - supabase start && supabase db reset
    - npm run dev:api
    - apps/api/.dev.vars (gitignored)

  Baseline (always runs):
    - AI disabled default → 503 AI_DISABLED
    - no token → 401

  Mock success / failure modes require restart dev:api with:
    AI_GENERATION_ENABLED=true
    AI_PROVIDER_MOCK=true
    AI_PROVIDER_MOCK_MODE=success   # or fail_provider | unsafe_output

  Example mock success run:
    npm run smoke:api:sprint9 -- -MockMode success

  Security: does not print JWT or service role keys.
#>
[CmdletBinding()]
param(
  [string]$ApiBaseUrl = "http://127.0.0.1:8787",
  [string]$SupabaseUrl = "http://127.0.0.1:54321",
  [string]$SupabaseAnonKey = "",
  [ValidateSet("auto", "success", "fail_provider", "unsafe_output", "skip_mock")]
  [string]$MockMode = "auto",
  [string]$TestEmail = "",
  [string]$TestPassword = "VibeNovel-Local-Smoke-Test!"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Continue"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$Results = New-Object System.Collections.Generic.List[object]
$StepNumber = 0
$auth = @{}
$script:UserId = $null
$script:ServiceRoleKey = $null

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

function Resolve-ServiceRoleKey {
  if ($script:ServiceRoleKey) { return $script:ServiceRoleKey }
  Push-Location $RepoRoot
  try {
    foreach ($line in (& supabase status -o env 2>$null)) {
      if ($line -match '^SERVICE_ROLE_KEY="(.+)"\s*$') {
        $script:ServiceRoleKey = $Matches[1]
        return $script:ServiceRoleKey
      }
    }
  } finally { Pop-Location }
  throw "Supabase service role key not found."
}

function Get-SafeDetail {
  param([string]$Text)
  if ([string]::IsNullOrWhiteSpace($Text)) { return "" }
  $sanitized = $Text -replace 'Bearer\s+[A-Za-z0-9._-]+', 'Bearer [redacted]'
  $sanitized = $sanitized -replace 'eyJ[A-Za-z0-9._-]{20,}', '[jwt-redacted]'
  if ($sanitized.Length -gt 120) { return $sanitized.Substring(0, 117) + "..." }
  return $sanitized
}

function Wait-ApiReady {
  param(
    [int]$TimeoutSec = 90,
    [int]$IntervalSec = 2
  )
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    try {
      $health = Invoke-RestMethod -Uri "$ApiBaseUrl/api/health" -Method GET -TimeoutSec 5 -ErrorAction Stop
      if ($health.ok -eq $true -and $null -ne $health.data) {
        return $health
      }
    } catch {
      # API still starting - keep polling
    }
    Start-Sleep -Seconds $IntervalSec
  }
  return $null
}

function Exit-SmokeBootstrapFailure {
  param([string]$StepName, [string]$Detail)
  Add-StepResult $StepName "FAIL" (Get-SafeDetail $Detail)
  Write-Host ""
  Write-Host "Bootstrap aborted - fix API/dev:api and retry." -ForegroundColor Red
  exit 1
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

function Get-ApiErrorPayload {
  param($ErrorRecord)
  try {
    if ($ErrorRecord.ErrorDetails.Message) {
      return ($ErrorRecord.ErrorDetails.Message | ConvertFrom-Json)
    }
  } catch { }
  return $null
}

function Invoke-ApiExpectErrorCode {
  param(
    [string]$Name,
    [string]$Method = "POST",
    [string]$Path,
    [hashtable]$Headers = @{},
    [string]$Body = $null,
    [string]$ExpectedCode
  )
  try {
    Invoke-Api -Method $Method -Path $Path -Headers $Headers -Body $Body | Out-Null
    Add-StepResult $Name "FAIL" "expected $ExpectedCode, got 2xx"
  } catch {
    $payload = Get-ApiErrorPayload $_
    $code = if ($payload -and $payload.error.code) { $payload.error.code } else { "unknown" }
    if ($code -eq $ExpectedCode) {
      Add-StepResult $Name "PASS" "code=$code"
    } else {
      Add-StepResult $Name "FAIL" "expected=$ExpectedCode got=$code"
    }
  }
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

function Test-PublishCopyResponseSafe {
  param([string]$JsonText)
  $forbidden = @(
    '"packetJson"\s*:', '"packet_json"\s*:', '"planningTruth"\s*:', '"planning_truth"\s*:',
    '"full_prompt"\s*:', 'openrouter', '"promptText"\s*:', '"prompt_text"\s*:',
    '"promptMessages"\s*:', '"contextPacket"\s*:', '"context_packet"\s*:',
    '"proseText"\s*:', '"prose_text"\s*:', '"delta_json"\s*:', 'estimated_cost_usd'
  )
  foreach ($f in $forbidden) {
    if ($JsonText -match $f) { return $false }
  }
  return $true
}

function New-ImprovePublishCopyBody {
  param(
    [string]$PackageId,
    [string[]]$Fields,
    [string]$IdempotencyKey,
    [string]$QualityMode = $null,
    [string]$Instruction = $null
  )
  $body = @{
    packageId      = $PackageId
    fields         = $Fields
    idempotencyKey = $IdempotencyKey
  }
  if ($QualityMode) { $body.qualityMode = $QualityMode }
  if ($Instruction) { $body.instruction = $Instruction }
  return ($body | ConvertTo-Json -Compress)
}

function Initialize-PublishSmokeContext {
  $created = Invoke-Api -Method POST -Path "/api/projects" -Headers $auth -Body '{"title":"S9 Publish Copy Smoke","entryPath":"rough_idea"}'
  if (-not $created.data.id) { throw "POST /api/projects returned no project id" }
  $projectId = $created.data.id
  Add-StepResult "publish bootstrap project" "PASS" "projectId=$projectId"

  Bootstrap-FoundationLocked -ProjectId $projectId
  Invoke-Api -Method POST -Path "/api/projects/$projectId/outline/generate" -Headers $auth -Body '{}' | Out-Null
  Invoke-Api -Method POST -Path "/api/projects/$projectId/outline/approve" -Headers $auth -Body '{}' | Out-Null
  Invoke-Api -Method POST -Path "/api/projects/$projectId/outline/lock" -Headers $auth -Body '{}' | Out-Null

  $chapters = Invoke-Api -Path "/api/projects/$projectId/outline/chapters" -Headers $auth
  $ch1 = ($chapters.data.chapters | Where-Object { $_.chapterNumber -eq 1 } | Select-Object -First 1)
  if (-not $ch1.id) { throw "chapter 1 outline not found" }
  $ch1Id = $ch1.id

  $session = Invoke-Api -Method POST -Path "/api/projects/$projectId/write/sessions" -Headers $auth `
    -Body (@{ chapterOutlineId = $ch1Id } | ConvertTo-Json)
  $sessionId = $session.data.session.id
  Invoke-Api -Method POST -Path "/api/projects/$projectId/write/sessions/$sessionId/beats/generate" -Headers $auth -Body '{}' | Out-Null
  $beats = Invoke-Api -Path "/api/projects/$projectId/write/sessions/$sessionId/beats" -Headers $auth
  $beatId = $beats.data.beats[0].id

  Invoke-Api -Method POST -Path "/api/projects/$projectId/write/beats/$beatId/prose" -Headers $auth `
    -Body '{"proseText":"Nadira memangkas sayuran di dapur dengan irama yang sudah hafal di luar kepala."}' | Out-Null
  Invoke-Api -Method POST -Path "/api/projects/$projectId/write/sessions/$sessionId/ready-for-summary" -Headers $auth -Body '{}' | Out-Null

  $gen = Invoke-Api -Method POST -Path "/api/projects/$projectId/summary/generate" -Headers $auth `
    -Body (@{ chapterOutlineId = $ch1Id; writingSessionId = $sessionId } | ConvertTo-Json)
  $summaryId = $gen.data.summary.id
  Invoke-Api -Method POST -Path "/api/projects/$projectId/summary/$summaryId/delta/extract" -Headers $auth -Body '{}' | Out-Null
  Invoke-Api -Method POST -Path "/api/projects/$projectId/summary/$summaryId/approve" -Headers $auth -Body '{}' | Out-Null

  $pubGen = Invoke-Api -Method POST -Path "/api/projects/$projectId/publish/generate" -Headers $auth `
    -Body (@{ chapterOutlineId = $ch1Id } | ConvertTo-Json)
  $packageId = $pubGen.data.publishPackage.id
  Add-StepResult "publish package ready" "PASS" "packageId=$packageId"

  return [PSCustomObject]@{
    ProjectId  = $projectId
    PackageId  = $packageId
    Ch1Id      = $ch1Id
  }
}

function Test-RewriteResponseSafe {
  param([string]$JsonText)
  $forbidden = @(
    '"packetJson"\s*:', '"packet_json"\s*:', '"planningTruth"\s*:', '"planning_truth"\s*:',
    '"full_prompt"\s*:', 'openrouter', '"promptText"\s*:', '"prompt_text"\s*:',
    '"promptMessages"\s*:', '"contextPacket"\s*:', '"context_packet"\s*:'
  )
  foreach ($f in $forbidden) {
    if ($JsonText -match $f) { return $false }
  }
  return $true
}

function Test-AuditPayloadSafe {
  param([string]$JsonText)
  $forbidden = @(
    'packet_json', 'packetJson', 'planningTruth', 'planning_truth',
    'full_prompt', 'prompt_text', 'promptText', 'prose_text', 'proseText',
    'service_role', 'openrouter'
  )
  foreach ($f in $forbidden) {
    if ($JsonText -match $f) { return $false }
  }
  return $true
}

function Test-AttemptMetadataSafe {
  param([string]$JsonText)
  $forbidden = @(
    'packet_json', 'packetJson', 'planningTruth', 'planning_truth',
    'full_prompt', 'prompt_text', 'promptText', 'prose_text', 'proseText',
    'inputUsdPer1M', 'outputUsdPer1M', 'MODEL_COST_MAP', 'pricingSource',
    'OPENROUTER_API_KEY', 'api_key', 'apiKey', 'service_role'
  )
  foreach ($f in $forbidden) {
    if ($JsonText -match $f) { return $false }
  }
  return $true
}

function Get-GenerationAttemptRow {
  param([string]$AttemptId)
  $srk = Resolve-ServiceRoleKey
  $headers = @{
    apikey        = $srk
    Authorization = "Bearer $srk"
  }
  $uri = ('{0}/rest/v1/generation_attempts?id=eq.{1}&select=id,provider,model,input_tokens,output_tokens,estimated_cost_usd,metadata&limit=1' -f $SupabaseUrl, $AttemptId)
  $rows = @(Invoke-RestMethod -Uri $uri -Method GET -Headers $headers -ErrorAction Stop)
  if ($rows.Count -lt 1) { return $null }
  return $rows[0]
}

function Get-AuditLogsByAction {
  param([string]$ProjectId, [string]$Action, [hashtable]$AuthHeaders, [string]$AnonKey)
  $headers = @{
    apikey        = $AnonKey
    Authorization = $AuthHeaders.Authorization
  }
  $uri = ('{0}/rest/v1/audit_logs?project_id=eq.{1}&action=eq.{2}&select=action,entity_type,entity_id,metadata,before_data,after_data&order=created_at.desc&limit=20' -f $SupabaseUrl, $ProjectId, $Action)
  return @(Invoke-RestMethod -Uri $uri -Method GET -Headers $headers -ErrorAction Stop)
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

function Get-SpeechRulesCount {
  param([string]$ProjectId)
  $res = Invoke-Api -Path "/api/projects/$ProjectId/speech-rules" -Headers $auth
  if ($res.data -is [array]) { return $res.data.Count }
  if ($null -ne $res.data.rules) { return $res.data.rules.Count }
  return 0
}

function Seed-CreditBalance {
  param([string]$UserId, [int]$Balance = 100)
  $srk = Resolve-ServiceRoleKey
  $headers = @{
    apikey        = $srk
    Authorization = "Bearer $srk"
    Prefer        = "return=minimal"
    "Content-Type" = "application/json"
  }
  $body = @{
    user_id      = $UserId
    balance      = $Balance
    monthly_quota = 1000
    monthly_used = 0
    source       = "seed"
  } | ConvertTo-Json
  $uri = "$SupabaseUrl/rest/v1/credit_balances"
  try {
    Invoke-RestMethod -Uri $uri -Method POST -Headers $headers -Body $body -ErrorAction Stop | Out-Null
    return $true
  } catch {
    $msg = $_.Exception.Message
    if ($msg -match '409|23505|duplicate') {
      $patchUri = ('{0}/rest/v1/credit_balances?user_id=eq.{1}' -f $SupabaseUrl, $UserId)
      $patchBody = @{ balance = $Balance } | ConvertTo-Json
      Invoke-RestMethod -Uri $patchUri -Method PATCH -Headers $headers -Body $patchBody -ErrorAction Stop | Out-Null
      return $true
    }
    throw
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

function Initialize-WriteSmokeContext {
  $created = Invoke-Api -Method POST -Path "/api/projects" -Headers $auth -Body '{"title":"S9 Smoke","entryPath":"rough_idea"}'
  if (-not $created.data.id) {
    throw "POST /api/projects returned no project id"
  }
  $projectId = $created.data.id
  Add-StepResult "POST /api/projects" "PASS" "projectId=$projectId"

  Bootstrap-FoundationLocked -ProjectId $projectId
  Invoke-Api -Method POST -Path "/api/projects/$projectId/outline/generate" -Headers $auth -Body '{}' | Out-Null
  Invoke-Api -Method POST -Path "/api/projects/$projectId/outline/approve" -Headers $auth -Body '{}' | Out-Null
  Invoke-Api -Method POST -Path "/api/projects/$projectId/outline/lock" -Headers $auth -Body '{}' | Out-Null

  $chapters = Invoke-Api -Path "/api/projects/$projectId/outline/chapters" -Headers $auth
  $ch1 = ($chapters.data.chapters | Where-Object { $_.chapterNumber -eq 1 } | Select-Object -First 1)
  if (-not $ch1.id) { throw "chapter 1 outline not found" }
  $ch1Id = $ch1.id

  $session = Invoke-Api -Method POST -Path "/api/projects/$projectId/write/sessions" -Headers $auth `
    -Body (@{ chapterOutlineId = $ch1Id } | ConvertTo-Json)
  if (-not $session.data.session.id) { throw "writing session create failed" }
  $sessionId = $session.data.session.id
  Invoke-Api -Method POST -Path "/api/projects/$projectId/write/sessions/$sessionId/beats/generate" -Headers $auth -Body '{}' | Out-Null
  $beats = Invoke-Api -Path "/api/projects/$projectId/write/sessions/$sessionId/beats" -Headers $auth
  if (-not $beats.data.beats -or $beats.data.beats.Count -lt 1) { throw "no beats generated" }
  $beatId = $beats.data.beats[0].id
  Add-StepResult "write session + beats" "PASS" "session=$sessionId beat=$beatId"

  return [PSCustomObject]@{
    ProjectId = $projectId
    Ch1Id     = $ch1Id
    SessionId = $sessionId
    BeatId    = $beatId
  }
}

function Test-CanonUnchanged {
  param(
    [string]$ProjectId,
    [int]$FactsBefore,
    [int]$CharsBefore,
    [int]$SpeechBefore,
    [int]$OpenLoopsBefore,
    [int]$RevealsBefore,
    [int]$ProposalsBefore
  )
  $foundationAfter = Invoke-Api -Path "/api/projects/$ProjectId/foundation" -Headers $auth
  $openLoopsAfter = (Invoke-Api -Path "/api/projects/$ProjectId/outline/open-loops" -Headers $auth).data.openLoops.Count
  $revealsAfter = (Invoke-Api -Path "/api/projects/$ProjectId/outline/reveals" -Headers $auth).data.reveals.Count
  $propResAfter = Invoke-Api -Path "/api/projects/$ProjectId/proposals?includeResolved=true" -Headers $auth
  $proposalsAfter = if ($propResAfter.data -is [array]) { $propResAfter.data.Count } else { 0 }
  return (
    $foundationAfter.data.facts.Count -eq $FactsBefore -and
    $foundationAfter.data.characters.Count -eq $CharsBefore -and
    (Get-SpeechRulesCount -ProjectId $ProjectId) -eq $SpeechBefore -and
    $openLoopsAfter -eq $OpenLoopsBefore -and
    $revealsAfter -eq $RevealsBefore -and
    $proposalsAfter -eq $ProposalsBefore
  )
}

function New-RewriteProseBody {
  param(
    [string]$BeatId,
    [string]$SessionId,
    [string]$RewriteMode,
    [string]$IdempotencyKey,
    [string]$QualityMode = $null,
    [string]$Instruction = $null
  )
  $body = @{
    beatId           = $BeatId
    writingSessionId = $SessionId
    rewriteMode      = $RewriteMode
    idempotencyKey   = $IdempotencyKey
  }
  if ($QualityMode) { $body.qualityMode = $QualityMode }
  if ($Instruction) { $body.instruction = $Instruction }
  return ($body | ConvertTo-Json -Compress)
}

function Seed-UserProseForBeat {
  param([string]$ProjectId, [string]$BeatId)
  $proseText = "Nadira memangkas sayuran di dapur dengan irama yang sudah hafal di luar kepala."
  $res = Invoke-Api -Method POST -Path "/api/projects/$ProjectId/write/beats/$BeatId/prose" -Headers $auth `
    -Body (@{ proseText = $proseText } | ConvertTo-Json)
  if (-not $res.data.version.id) {
    throw "POST user prose returned no version id"
  }
  return [PSCustomObject]@{
    VersionId   = $res.data.version.id
    ProseText   = $proseText
    VersionNumber = $res.data.version.versionNumber
  }
}

Write-Host "`nVibeNovel Sprint 9 AI API Smoke Test (rewrite + publish copy)" -ForegroundColor Cyan

$anonKey = Resolve-SupabaseAnonKey
if ([string]::IsNullOrWhiteSpace($TestEmail)) {
  $TestEmail = "s9smoke-$(Get-Random -Maximum 99999999)@example.com"
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

$health = Wait-ApiReady
if (-not $health) {
  Exit-SmokeBootstrapFailure "API ready poll" "GET /api/health did not return 200 within timeout - start dev:api first"
}
Add-StepResult "API ready poll" "PASS" "GET /api/health OK"

try {
  $me = Invoke-Api -Path "/api/me" -Headers $auth
  if (-not $me.data.user.id) { throw "GET /api/me returned no user id" }
  $script:UserId = $me.data.user.id
  Add-StepResult "GET /api/me" "PASS" "userId=$($script:UserId)"
} catch {
  Add-StepResult "GET /api/me" "FAIL" (Get-SafeDetail $_.Exception.Message)
  Write-Host "Bootstrap aborted - GET /api/me failed." -ForegroundColor Red
  exit 1
}

$aiEnabled = [bool]$health.data.env.aiGenerationEnabled
$aiMock = [bool]$health.data.env.aiProviderMock
Add-StepResult "health AI flags" "PASS" "enabled=$aiEnabled mock=$aiMock"

try {
  $ctx = Initialize-WriteSmokeContext
  $projectId = $ctx.ProjectId
  $sessionId = $ctx.SessionId
  $beatId = $ctx.BeatId
} catch {
  Add-StepResult "bootstrap write context" "FAIL" (Get-SafeDetail $_.Exception.Message)
  Write-Host "Bootstrap aborted - write context setup failed." -ForegroundColor Red
  exit 1
}

$rewritePath = "/api/projects/$projectId/ai/rewrite-prose"
$rewriteBodyBase = New-RewriteProseBody -BeatId $beatId -SessionId $sessionId `
  -RewriteMode "improve_emotion" -IdempotencyKey "s9-base-$(Get-Random)"

Invoke-ApiExpectFailure -Name "POST rewrite-prose no token" -Method POST -Path $rewritePath -Body $rewriteBodyBase

$improvePath = "/api/projects/$projectId/ai/improve-publish-copy"
$improveBodyBase = New-ImprovePublishCopyBody -PackageId "00000000-0000-4000-8000-000000000099" `
  -Fields @("teaser") -IdempotencyKey "s9-pub-base-$(Get-Random)"

Invoke-ApiExpectFailure -Name "POST improve-publish-copy no token" -Method POST -Path $improvePath -Body $improveBodyBase

if (-not $aiEnabled) {
  Invoke-ApiExpectErrorCode -Name "AI disabled 503 rewrite" -Method POST -Path $rewritePath -Headers $auth -Body $rewriteBodyBase -ExpectedCode "AI_DISABLED"
  Invoke-ApiExpectErrorCode -Name "AI disabled 503 publish copy" -Method POST -Path $improvePath -Headers $auth -Body $improveBodyBase -ExpectedCode "AI_DISABLED"
} else {
  Add-StepResult "AI disabled 503 rewrite" "SKIP" "AI_GENERATION_ENABLED=true on server"
  Add-StepResult "AI disabled 503 publish copy" "SKIP" "AI_GENERATION_ENABLED=true on server"
}

$resolvedMockMode = $MockMode
if ($MockMode -eq "auto") {
  if ($aiEnabled -and $aiMock) { $resolvedMockMode = "success" } else { $resolvedMockMode = "skip_mock" }
}

if ($resolvedMockMode -eq "skip_mock" -or -not $aiEnabled -or -not $aiMock) {
  Add-StepResult "rewrite before prose NO_PROSE_TO_REWRITE" "NOT RUN" "requires AI enabled"
  Add-StepResult "POST user prose seed" "NOT RUN" "requires AI enabled"
  Add-StepResult "mock success path" "NOT RUN" "set AI_GENERATION_ENABLED=true AI_PROVIDER_MOCK=true and restart dev:api"
  Add-StepResult "insufficient credit 402" "NOT RUN" "requires AI enabled"
  Add-StepResult "mock fail_provider" "NOT RUN" "requires AI_PROVIDER_MOCK_MODE=fail_provider + restart"
  Add-StepResult "mock unsafe_output" "NOT RUN" "requires AI_PROVIDER_MOCK_MODE=unsafe_output + restart"
  Add-StepResult "cross-user rewrite 404" "NOT RUN" "requires AI enabled"
  Add-StepResult "invalid rewriteMode 400" "NOT RUN" "requires AI enabled"
  Add-StepResult "custom without instruction 400" "NOT RUN" "requires AI enabled"
  Add-StepResult "reject client model" "NOT RUN" "requires AI enabled"
  Add-StepResult "publish copy tests" "NOT RUN" "requires AI enabled"
} else {
  $foundationBefore = Invoke-Api -Path "/api/projects/$projectId/foundation" -Headers $auth
  $factsBefore = $foundationBefore.data.facts.Count
  $charsBefore = $foundationBefore.data.characters.Count
  $speechBefore = Get-SpeechRulesCount -ProjectId $projectId
  $openLoopsBefore = (Invoke-Api -Path "/api/projects/$projectId/outline/open-loops" -Headers $auth).data.openLoops.Count
  $revealsBefore = (Invoke-Api -Path "/api/projects/$projectId/outline/reveals" -Headers $auth).data.reveals.Count
  $propResBefore = Invoke-Api -Path "/api/projects/$projectId/proposals?includeResolved=true" -Headers $auth
  $proposalsBefore = if ($propResBefore.data -is [array]) { $propResBefore.data.Count } else { 0 }

  $noProseBody = New-RewriteProseBody -BeatId $beatId -SessionId $sessionId `
    -RewriteMode "improve_emotion" -IdempotencyKey "s9-noprose-$(Get-Random)"
  Invoke-ApiExpectErrorCode -Name "rewrite before prose NO_PROSE_TO_REWRITE" -Method POST -Path $rewritePath `
    -Headers $auth -Body $noProseBody -ExpectedCode "NO_PROSE_TO_REWRITE"

  $sourceProse = $null
  try {
    $sourceProse = Seed-UserProseForBeat -ProjectId $projectId -BeatId $beatId
    Add-StepResult "POST user prose seed" "PASS" "version=$($sourceProse.VersionId)"
  } catch {
    Add-StepResult "POST user prose seed" "FAIL" $_.Exception.Message.Substring(0, [Math]::Min(80, $_.Exception.Message.Length))
  }

  $signupB = Invoke-RestMethod -Uri "$SupabaseUrl/auth/v1/signup" -Method POST `
    -Headers @{ apikey = $anonKey; Authorization = "Bearer $anonKey" } -ContentType "application/json" `
    -Body (@{ email = "s9b-$(Get-Random)@example.com"; password = $TestPassword } | ConvertTo-Json)
  $authB = @{ Authorization = "Bearer $($signupB.access_token)" }
  $crossBody = New-RewriteProseBody -BeatId $beatId -SessionId $sessionId `
    -RewriteMode "improve_emotion" -IdempotencyKey "s9-cross-$(Get-Random)"
  Invoke-ApiExpectFailure -Name "cross-user rewrite 404" -Method POST -Headers $authB `
    -Path $rewritePath -Body $crossBody

  $badModeBody = New-RewriteProseBody -BeatId $beatId -SessionId $sessionId `
    -RewriteMode "evil_mode" -IdempotencyKey "s9-badmode-$(Get-Random)"
  Invoke-ApiExpectErrorCode -Name "invalid rewriteMode 400" -Method POST -Path $rewritePath `
    -Headers $auth -Body $badModeBody -ExpectedCode "BAD_REQUEST"

  $customNoInstrBody = New-RewriteProseBody -BeatId $beatId -SessionId $sessionId `
    -RewriteMode "custom" -IdempotencyKey "s9-custom-$(Get-Random)"
  Invoke-ApiExpectErrorCode -Name "custom without instruction 400" -Method POST -Path $rewritePath `
    -Headers $auth -Body $customNoInstrBody -ExpectedCode "BAD_REQUEST"

  $badModelBody = (@{
    beatId           = $beatId
    writingSessionId = $sessionId
    rewriteMode      = "improve_emotion"
    idempotencyKey   = "s9-badmodel-$(Get-Random)"
    model            = "evil/model"
  } | ConvertTo-Json -Compress)
  Invoke-ApiExpectErrorCode -Name "reject client model" -Method POST -Path $rewritePath `
    -Headers $auth -Body $badModelBody -ExpectedCode "BAD_REQUEST"

  if ($sourceProse) {
    $idemInsufficient = "s9-insuf-$(Get-Random)"
    $bodyInsufficient = New-RewriteProseBody -BeatId $beatId -SessionId $sessionId `
      -RewriteMode "improve_emotion" -IdempotencyKey $idemInsufficient
    Invoke-ApiExpectErrorCode -Name "insufficient credit 402" -Method POST -Path $rewritePath `
      -Headers $auth -Body $bodyInsufficient -ExpectedCode "INSUFFICIENT_CREDIT"

    try {
      Seed-CreditBalance -UserId $script:UserId -Balance 100 | Out-Null
      Add-StepResult "seed credit balance" "PASS" "balance=100"
    } catch {
      Add-StepResult "seed credit balance" "FAIL" $_.Exception.Message.Substring(0, [Math]::Min(80, $_.Exception.Message.Length))
    }
  } else {
    Add-StepResult "insufficient credit 402" "NOT RUN" "user prose seed failed"
    Add-StepResult "seed credit balance" "NOT RUN" "user prose seed failed"
  }

  $balanceBefore = $null
  if ($sourceProse) {
    try {
      $balanceBefore = (Invoke-Api -Path "/api/credits/balance" -Headers $auth).data.creditBalance.balance
    } catch {
      Add-StepResult "credit balance read" "FAIL" $_.Exception.Message.Substring(0, [Math]::Min(80, $_.Exception.Message.Length))
    }
  }
  $expectedCost = 6

  if ($resolvedMockMode -eq "success" -and $sourceProse -and $null -ne $balanceBefore) {
    $idemSuccess = "s9-ok-$(Get-Random)"
    $bodySuccess = New-RewriteProseBody -BeatId $beatId -SessionId $sessionId `
      -RewriteMode "improve_emotion" -IdempotencyKey $idemSuccess
    $versionsBeforeSuccess = (Invoke-Api -Path "/api/projects/$projectId/write/beats/$beatId/prose" -Headers $auth).data.versions.Count
    try {
      $rewriteRes = Invoke-Api -Method POST -Path $rewritePath -Headers $auth -Body $bodySuccess
      $json = $rewriteRes | ConvertTo-Json -Depth 12
      $safe = Test-RewriteResponseSafe $json
      $newVersionOk = ($rewriteRes.data.proseVersion.id -ne $sourceProse.VersionId)
      $currentOk = ($rewriteRes.data.proseVersion.isCurrent -eq $true)
      $genTypeOk = ($rewriteRes.data.generationAttempt.generationType -eq "prose_rewrite")
      $metaTypeOk = ($rewriteRes.data.proseVersion.metadata.generationType -eq "prose_rewrite")
      $attemptOk = ($rewriteRes.data.generationAttempt.status -eq "succeeded")
      $entityOk = ($rewriteRes.data.generationAttempt.outputEntityId -eq $rewriteRes.data.proseVersion.id)
      $balanceAfter = $rewriteRes.data.creditBalance.balance
      $debitOk = ($balanceAfter -eq ($balanceBefore - $expectedCost))
      $versionsAfterSuccess = (Invoke-Api -Path "/api/projects/$projectId/write/beats/$beatId/prose" -Headers $auth).data.versions.Count
      $newVersionCountOk = ($versionsAfterSuccess -eq ($versionsBeforeSuccess + 1))
      $allVersions = (Invoke-Api -Path "/api/projects/$projectId/write/beats/$beatId/prose" -Headers $auth).data.versions
      $sourceRow = $allVersions | Where-Object { $_.id -eq $sourceProse.VersionId } | Select-Object -First 1
      $sourceUnchangedOk = (
        $null -ne $sourceRow -and
        $sourceRow.proseText -eq $sourceProse.ProseText -and
        $sourceRow.isCurrent -eq $false
      )
      Add-StepResult "rewrite prose 200/201" $(if ($safe -and $newVersionOk -and $currentOk -and $genTypeOk -and $metaTypeOk -and $attemptOk -and $entityOk -and $newVersionCountOk) { "PASS" } else { "FAIL" }) "version=$($rewriteRes.data.proseVersion.id)"
      Add-StepResult "source prose unchanged" $(if ($sourceUnchangedOk) { "PASS" } else { "FAIL" }) "source=$($sourceProse.VersionId)"
      Add-StepResult "credit debited once (seimbang=6)" $(if ($debitOk) { "PASS" } else { "FAIL" }) "before=$balanceBefore after=$balanceAfter cost=$expectedCost"
      Add-StepResult "response leak guard" $(if ($safe) { "PASS" } else { "FAIL" }) "no packet/prompt/planningTruth"

      $versionsBeforeReplay = (Invoke-Api -Path "/api/projects/$projectId/write/beats/$beatId/prose" -Headers $auth).data.versions.Count
      $replay = Invoke-Api -Method POST -Path $rewritePath -Headers $auth -Body $bodySuccess
      $replayBalance = $replay.data.creditBalance.balance
      $versionsAfterReplay = (Invoke-Api -Path "/api/projects/$projectId/write/beats/$beatId/prose" -Headers $auth).data.versions.Count
      $replayOk = (
        $replay.data.idempotentReplay -eq $true -and
        $replayBalance -eq $balanceAfter -and
        $replay.data.proseVersion.id -eq $rewriteRes.data.proseVersion.id -and
        $versionsAfterReplay -eq $versionsBeforeReplay
      )
      Add-StepResult "idempotency replay no double debit" $(if ($replayOk) { "PASS" } else { "FAIL" }) "balance=$replayBalance versions=$versionsAfterReplay"

      Assert-AuditActionExists -Name "audit generation_attempt_created" -ProjectId $projectId -Action "generation_attempt_created" -AuthHeaders $auth -AnonKey $anonKey
      Assert-AuditActionExists -Name "audit generation_attempt_succeeded" -ProjectId $projectId -Action "generation_attempt_succeeded" -AuthHeaders $auth -AnonKey $anonKey
      Assert-AuditActionExists -Name "audit ai_output_persisted" -ProjectId $projectId -Action "ai_output_persisted" -AuthHeaders $auth -AnonKey $anonKey

      $canonOk = Test-CanonUnchanged -ProjectId $projectId -FactsBefore $factsBefore -CharsBefore $charsBefore `
        -SpeechBefore $speechBefore -OpenLoopsBefore $openLoopsBefore -RevealsBefore $revealsBefore -ProposalsBefore $proposalsBefore
      Add-StepResult "no canon mutation" $(if ($canonOk) { "PASS" } else { "FAIL" }) "facts=$factsBefore proposals=$proposalsBefore"

      try {
        $attemptRow = Get-GenerationAttemptRow -AttemptId $rewriteRes.data.generationAttempt.id
        if (-not $attemptRow) {
          Add-StepResult "estimated_cost_usd mock" "FAIL" "attempt row not found"
          Add-StepResult "attempt metadata leak guard" "NOT RUN" "no attempt row"
        } else {
          $provider = [string]$attemptRow.provider
          $estCost = $attemptRow.estimated_cost_usd
          $metaJson = ($attemptRow.metadata | ConvertTo-Json -Depth 8 -Compress)
          $metaSafe = Test-AttemptMetadataSafe $metaJson
          if ($provider -eq "mock") {
            $mockCostOk = ($null -ne $estCost) -and ([decimal]$estCost -eq 0)
            $approxOk = ($attemptRow.metadata.costEstimateApproximate -eq $true)
            Add-StepResult "estimated_cost_usd mock" $(if ($mockCostOk -and $approxOk) { "PASS" } else { "FAIL" }) "cost=$estCost approximate=$($attemptRow.metadata.costEstimateApproximate)"
          } else {
            Add-StepResult "estimated_cost_usd mock" "SKIP" "provider=$provider (not mock success path)"
          }
          Add-StepResult "attempt metadata leak guard" $(if ($metaSafe) { "PASS" } else { "FAIL" }) "no pricing table dump"
        }
      } catch {
        Add-StepResult "estimated_cost_usd mock" "FAIL" $_.Exception.Message.Substring(0, [Math]::Min(80, $_.Exception.Message.Length))
        Add-StepResult "attempt metadata leak guard" "NOT RUN" "lookup failed"
      }
    } catch {
      Add-StepResult "rewrite prose 200/201" "FAIL" $_.Exception.Message.Substring(0, [Math]::Min(100, $_.Exception.Message.Length))
      Add-StepResult "source prose unchanged" "NOT RUN" "rewrite failed"
      Add-StepResult "credit debited once (seimbang=6)" "NOT RUN" "rewrite failed"
      Add-StepResult "idempotency replay no double debit" "NOT RUN" "rewrite failed"
      Add-StepResult "response leak guard" "NOT RUN" "rewrite failed"
      Add-StepResult "no canon mutation" "NOT RUN" "rewrite failed"
    }
    Add-StepResult "mock fail_provider" "SKIP" "run with -MockMode fail_provider after env restart"
    Add-StepResult "mock unsafe_output" "SKIP" "run with -MockMode unsafe_output after env restart"
  }

  if ($resolvedMockMode -eq "fail_provider" -and $sourceProse) {
    Add-StepResult "rewrite prose 200/201" "SKIP" "fail_provider mode"
    Add-StepResult "idempotency replay no double debit" "SKIP" "fail_provider mode"
    $balanceBeforeFail = (Invoke-Api -Path "/api/credits/balance" -Headers $auth).data.creditBalance.balance
    $proseBeforeFail = (Invoke-Api -Path "/api/projects/$projectId/write/beats/$beatId/prose" -Headers $auth).data.versions.Count
    $idemFail = "s9-fail-$(Get-Random)"
    $bodyFail = New-RewriteProseBody -BeatId $beatId -SessionId $sessionId `
      -RewriteMode "improve_emotion" -IdempotencyKey $idemFail
    Invoke-ApiExpectErrorCode -Name "mock fail_provider" -Method POST -Path $rewritePath -Headers $auth -Body $bodyFail -ExpectedCode "AI_PROVIDER_ERROR"
    $balanceAfterFail = (Invoke-Api -Path "/api/credits/balance" -Headers $auth).data.creditBalance.balance
    $proseAfterFail = (Invoke-Api -Path "/api/projects/$projectId/write/beats/$beatId/prose" -Headers $auth).data.versions.Count
    $refundOk = ($balanceAfterFail -eq $balanceBeforeFail)
    $noProseFailOk = ($proseAfterFail -eq $proseBeforeFail)
    Add-StepResult "refund after fail_provider" $(if ($refundOk) { "PASS" } else { "FAIL" }) "before=$balanceBeforeFail after=$balanceAfterFail"
    Add-StepResult "no prose version on fail_provider" $(if ($noProseFailOk) { "PASS" } else { "FAIL" }) "versions before=$proseBeforeFail after=$proseAfterFail"
    $canonFailOk = Test-CanonUnchanged -ProjectId $projectId -FactsBefore $factsBefore -CharsBefore $charsBefore `
      -SpeechBefore $speechBefore -OpenLoopsBefore $openLoopsBefore -RevealsBefore $revealsBefore -ProposalsBefore $proposalsBefore
    Add-StepResult "no canon mutation fail_provider" $(if ($canonFailOk) { "PASS" } else { "FAIL" }) "facts=$factsBefore"
    Add-StepResult "mock unsafe_output" "SKIP" "wrong MockMode"
  }

  if ($resolvedMockMode -eq "unsafe_output" -and $sourceProse) {
    Add-StepResult "rewrite prose 200/201" "SKIP" "unsafe_output mode"
    Add-StepResult "idempotency replay no double debit" "SKIP" "unsafe_output mode"
    $balanceBeforeUnsafe = (Invoke-Api -Path "/api/credits/balance" -Headers $auth).data.creditBalance.balance
    $proseBefore = (Invoke-Api -Path "/api/projects/$projectId/write/beats/$beatId/prose" -Headers $auth).data.versions.Count
    $idemUnsafe = "s9-unsafe-$(Get-Random)"
    $bodyUnsafe = New-RewriteProseBody -BeatId $beatId -SessionId $sessionId `
      -RewriteMode "improve_emotion" -IdempotencyKey $idemUnsafe
    Invoke-ApiExpectErrorCode -Name "mock unsafe_output" -Method POST -Path $rewritePath -Headers $auth -Body $bodyUnsafe -ExpectedCode "AI_OUTPUT_UNSAFE"
    $balanceAfterUnsafe = (Invoke-Api -Path "/api/credits/balance" -Headers $auth).data.creditBalance.balance
    $proseAfter = (Invoke-Api -Path "/api/projects/$projectId/write/beats/$beatId/prose" -Headers $auth).data.versions.Count
    $refundOk = ($balanceAfterUnsafe -eq $balanceBeforeUnsafe)
    $noProseOk = ($proseAfter -eq $proseBefore)
    Add-StepResult "refund after unsafe_output" $(if ($refundOk) { "PASS" } else { "FAIL" }) "before=$balanceBeforeUnsafe after=$balanceAfterUnsafe"
    Add-StepResult "no prose version on unsafe" $(if ($noProseOk) { "PASS" } else { "FAIL" }) "versions before=$proseBefore after=$proseAfter"
    $canonUnsafeOk = Test-CanonUnchanged -ProjectId $projectId -FactsBefore $factsBefore -CharsBefore $charsBefore `
      -SpeechBefore $speechBefore -OpenLoopsBefore $openLoopsBefore -RevealsBefore $revealsBefore -ProposalsBefore $proposalsBefore
    Add-StepResult "no canon mutation unsafe_output" $(if ($canonUnsafeOk) { "PASS" } else { "FAIL" }) "facts=$factsBefore"
    Add-StepResult "mock fail_provider" "SKIP" "wrong MockMode"
  }

  # --- Publish copy AI (Task 9.5) ---
  try {
    $pubCtx = Initialize-PublishSmokeContext
    $pubProjectId = $pubCtx.ProjectId
    $packageId = $pubCtx.PackageId
    $improvePathPub = "/api/projects/$pubProjectId/ai/improve-publish-copy"

    $foundationPubBefore = Invoke-Api -Path "/api/projects/$pubProjectId/foundation" -Headers $auth
    $factsPubBefore = $foundationPubBefore.data.facts.Count
    $charsPubBefore = $foundationPubBefore.data.characters.Count
    $speechPubBefore = Get-SpeechRulesCount -ProjectId $pubProjectId
    $openLoopsPubBefore = (Invoke-Api -Path "/api/projects/$pubProjectId/outline/open-loops" -Headers $auth).data.openLoops.Count
    $revealsPubBefore = (Invoke-Api -Path "/api/projects/$pubProjectId/outline/reveals" -Headers $auth).data.reveals.Count
    $propPubBefore = Invoke-Api -Path "/api/projects/$pubProjectId/proposals?includeResolved=true" -Headers $auth
    $proposalsPubBefore = if ($propPubBefore.data -is [array]) { $propPubBefore.data.Count } else { 0 }

    Invoke-ApiExpectFailure -Name "publish copy package missing 404" -Method POST -Headers $auth `
      -Path "/api/projects/$pubProjectId/ai/improve-publish-copy" `
      -Body (New-ImprovePublishCopyBody -PackageId "00000000-0000-4000-8000-000000000088" -Fields @("teaser") -IdempotencyKey "s9-pub-miss-$(Get-Random)")

    $dupBody = (@{
      packageId      = $packageId
      fields         = @("teaser", "teaser")
      idempotencyKey = "s9-pub-dup-$(Get-Random)"
    } | ConvertTo-Json -Compress)
    Invoke-ApiExpectErrorCode -Name "publish copy duplicate fields 400" -Method POST -Path $improvePathPub `
      -Headers $auth -Body $dupBody -ExpectedCode "BAD_REQUEST"

    $badFieldBody = New-ImprovePublishCopyBody -PackageId $packageId -Fields @("evil_field") -IdempotencyKey "s9-pub-badfield-$(Get-Random)"
    Invoke-ApiExpectErrorCode -Name "publish copy invalid field 400" -Method POST -Path $improvePathPub `
      -Headers $auth -Body $badFieldBody -ExpectedCode "BAD_REQUEST"

    $badModelBody = (@{
      packageId      = $packageId
      fields         = @("teaser")
      idempotencyKey = "s9-pub-badmodel-$(Get-Random)"
      model          = "evil/model"
    } | ConvertTo-Json -Compress)
    Invoke-ApiExpectErrorCode -Name "publish copy reject client model" -Method POST -Path $improvePathPub `
      -Headers $auth -Body $badModelBody -ExpectedCode "BAD_REQUEST"

    $signupPubB = Invoke-RestMethod -Uri "$SupabaseUrl/auth/v1/signup" -Method POST `
      -Headers @{ apikey = $anonKey; Authorization = "Bearer $anonKey" } -ContentType "application/json" `
      -Body (@{ email = "s9pubb-$(Get-Random)@example.com"; password = $TestPassword } | ConvertTo-Json)
    $authPubB = @{ Authorization = "Bearer $($signupPubB.access_token)" }
    Invoke-ApiExpectFailure -Name "publish copy cross-user 404" -Method POST -Headers $authPubB `
      -Path $improvePathPub `
      -Body (New-ImprovePublishCopyBody -PackageId $packageId -Fields @("teaser") -IdempotencyKey "s9-pub-cross-$(Get-Random)")

    $exportPkg = Invoke-Api -Method POST -Path "/api/projects/$pubProjectId/publish/generate" -Headers $auth `
      -Body (@{ chapterOutlineId = $pubCtx.Ch1Id; regenerate = $true } | ConvertTo-Json)
    $exportPackageId = $exportPkg.data.publishPackage.id
    Invoke-Api -Method POST -Path "/api/projects/$pubProjectId/publish/$exportPackageId/mark-exported" -Headers $auth -Body '{}' | Out-Null
    Invoke-ApiExpectErrorCode -Name "publish copy exported package 409" -Method POST -Path $improvePathPub `
      -Headers $auth -Body (New-ImprovePublishCopyBody -PackageId $exportPackageId -Fields @("teaser") -IdempotencyKey "s9-pub-exp-$(Get-Random)") `
      -ExpectedCode "CONFLICT"

    if ($resolvedMockMode -eq "success") {
      try {
        Seed-CreditBalance -UserId $script:UserId -Balance 100 | Out-Null
      } catch { }

      $pkgBefore = Invoke-Api -Path "/api/projects/$pubProjectId/publish/$packageId" -Headers $auth
      $teaserBefore = $pkgBefore.data.publishPackage.teaser
      $captionBefore = $pkgBefore.data.publishPackage.caption

      $balanceBeforePub = (Invoke-Api -Path "/api/credits/balance" -Headers $auth).data.creditBalance.balance
      $idemPub = "s9-pub-ok-$(Get-Random)"
      $bodyPub = New-ImprovePublishCopyBody -PackageId $packageId -Fields @("teaser", "caption") -IdempotencyKey $idemPub

      $improveRes = Invoke-Api -Method POST -Path $improvePathPub -Headers $auth -Body $bodyPub
      $jsonPub = $improveRes | ConvertTo-Json -Depth 12
      $safePub = Test-PublishCopyResponseSafe $jsonPub
      $hasTeaser = [bool]$improveRes.data.suggestions.teaser
      $hasCaption = [bool]$improveRes.data.suggestions.caption
      $genTypeOk = ($improveRes.data.generationAttempt.generationType -eq "publish_copy")
      $attemptOk = ($improveRes.data.generationAttempt.status -eq "succeeded")
      $balanceAfterPub = $improveRes.data.creditBalance.balance
      $debitPubOk = ($balanceAfterPub -eq ($balanceBeforePub - 6))

      $pkgAfter = Invoke-Api -Path "/api/projects/$pubProjectId/publish/$packageId" -Headers $auth
      $noMutationOk = (
        $pkgAfter.data.publishPackage.teaser -eq $teaserBefore -and
        $pkgAfter.data.publishPackage.caption -eq $captionBefore
      )

      $overclaimOk = -not (
        $improveRes.data.suggestions.teaser -match 'dijamin\s+viral|pasti\s+viral' -or
        $improveRes.data.suggestions.caption -match 'dijamin\s+viral|pasti\s+viral'
      )

      Add-StepResult "publish copy mock success" $(if ($safePub -and $hasTeaser -and $hasCaption -and $genTypeOk -and $attemptOk) { "PASS" } else { "FAIL" }) "fields=teaser,caption"
      Add-StepResult "publish copy no package mutation" $(if ($noMutationOk) { "PASS" } else { "FAIL" }) "teaser unchanged"
      Add-StepResult "publish copy debit (seimbang=6)" $(if ($debitPubOk) { "PASS" } else { "FAIL" }) "before=$balanceBeforePub after=$balanceAfterPub"
      Add-StepResult "publish copy overclaim guard" $(if ($overclaimOk) { "PASS" } else { "FAIL" }) "no viral guarantee"
      Add-StepResult "publish copy response leak guard" $(if ($safePub) { "PASS" } else { "FAIL" }) "no prompt/packet leak"

      $replayPub = Invoke-Api -Method POST -Path $improvePathPub -Headers $auth -Body $bodyPub
      $replayPubOk = (
        $replayPub.data.idempotentReplay -eq $true -and
        $replayPub.data.creditBalance.balance -eq $balanceAfterPub -and
        $replayPub.data.suggestions.teaser -eq $improveRes.data.suggestions.teaser
      )
      Add-StepResult "publish copy idempotency replay" $(if ($replayPubOk) { "PASS" } else { "FAIL" }) "balance=$($replayPub.data.creditBalance.balance)"

      Assert-AuditActionExists -Name "publish copy audit generation_attempt_created" -ProjectId $pubProjectId -Action "generation_attempt_created" -AuthHeaders $auth -AnonKey $anonKey
      Assert-AuditActionExists -Name "publish copy audit generation_attempt_succeeded" -ProjectId $pubProjectId -Action "generation_attempt_succeeded" -AuthHeaders $auth -AnonKey $anonKey
      Assert-AuditActionExists -Name "publish copy audit ai_output_persisted" -ProjectId $pubProjectId -Action "ai_output_persisted" -AuthHeaders $auth -AnonKey $anonKey

      $canonPubOk = Test-CanonUnchanged -ProjectId $pubProjectId -FactsBefore $factsPubBefore -CharsBefore $charsPubBefore `
        -SpeechBefore $speechPubBefore -OpenLoopsBefore $openLoopsPubBefore -RevealsBefore $revealsPubBefore -ProposalsBefore $proposalsPubBefore
      Add-StepResult "publish copy no canon mutation" $(if ($canonPubOk) { "PASS" } else { "FAIL" }) "facts=$factsPubBefore"

      $propPubAfter = Invoke-Api -Path "/api/projects/$pubProjectId/proposals?includeResolved=true" -Headers $auth
      $proposalsPubAfter = if ($propPubAfter.data -is [array]) { $propPubAfter.data.Count } else { 0 }
      Add-StepResult "publish copy no new ai_proposals" $(if ($proposalsPubAfter -eq $proposalsPubBefore) { "PASS" } else { "FAIL" }) "before=$proposalsPubBefore after=$proposalsPubAfter"

      Add-StepResult "publish copy fail_provider" "SKIP" "run with -MockMode fail_provider after env restart"
      Add-StepResult "publish copy unsafe_output" "SKIP" "run with -MockMode unsafe_output after env restart"
    }

    if ($resolvedMockMode -eq "fail_provider") {
      Seed-CreditBalance -UserId $script:UserId -Balance 100 | Out-Null
      $balanceBeforeFailPub = (Invoke-Api -Path "/api/credits/balance" -Headers $auth).data.creditBalance.balance
      $pkgSnap = Invoke-Api -Path "/api/projects/$pubProjectId/publish/$packageId" -Headers $auth
      $teaserSnap = $pkgSnap.data.publishPackage.teaser
      $idemFailPub = "s9-pub-fail-$(Get-Random)"
      $bodyFailPub = New-ImprovePublishCopyBody -PackageId $packageId -Fields @("teaser") -IdempotencyKey $idemFailPub
      Invoke-ApiExpectErrorCode -Name "publish copy fail_provider" -Method POST -Path $improvePathPub `
        -Headers $auth -Body $bodyFailPub -ExpectedCode "AI_PROVIDER_ERROR"
      $balanceAfterFailPub = (Invoke-Api -Path "/api/credits/balance" -Headers $auth).data.creditBalance.balance
      $pkgAfterFail = Invoke-Api -Path "/api/projects/$pubProjectId/publish/$packageId" -Headers $auth
      $refundPubOk = ($balanceAfterFailPub -eq $balanceBeforeFailPub)
      $noMutFailOk = ($pkgAfterFail.data.publishPackage.teaser -eq $teaserSnap)
      Add-StepResult "publish copy refund fail_provider" $(if ($refundPubOk) { "PASS" } else { "FAIL" }) "before=$balanceBeforeFailPub after=$balanceAfterFailPub"
      Add-StepResult "publish copy no mutation fail_provider" $(if ($noMutFailOk) { "PASS" } else { "FAIL" }) "teaser unchanged"
      Add-StepResult "publish copy mock success" "SKIP" "fail_provider mode"
    }

    if ($resolvedMockMode -eq "unsafe_output") {
      Seed-CreditBalance -UserId $script:UserId -Balance 100 | Out-Null
      $balanceBeforeUnsafePub = (Invoke-Api -Path "/api/credits/balance" -Headers $auth).data.creditBalance.balance
      $idemUnsafePub = "s9-pub-unsafe-$(Get-Random)"
      $bodyUnsafePub = New-ImprovePublishCopyBody -PackageId $packageId -Fields @("caption") -IdempotencyKey $idemUnsafePub
      Invoke-ApiExpectErrorCode -Name "publish copy unsafe_output" -Method POST -Path $improvePathPub `
        -Headers $auth -Body $bodyUnsafePub -ExpectedCode "AI_OUTPUT_UNSAFE"
      $balanceAfterUnsafePub = (Invoke-Api -Path "/api/credits/balance" -Headers $auth).data.creditBalance.balance
      Add-StepResult "publish copy refund unsafe_output" $(if ($balanceAfterUnsafePub -eq $balanceBeforeUnsafePub) { "PASS" } else { "FAIL" }) "before=$balanceBeforeUnsafePub after=$balanceAfterUnsafePub"
      Add-StepResult "publish copy mock success" "SKIP" "unsafe_output mode"
    }
  } catch {
    Add-StepResult "publish copy bootstrap/tests" "FAIL" (Get-SafeDetail $_.Exception.Message)
  }
}

Write-Host ""
$pass = @($Results | Where-Object { $_.Result -eq "PASS" }).Count
$fail = @($Results | Where-Object { $_.Result -eq "FAIL" }).Count
$skip = @($Results | Where-Object { $_.Result -in @("SKIP", "NOT RUN") }).Count
Write-Host "Summary: PASS=$pass FAIL=$fail SKIP/NOT RUN=$skip TOTAL=$($Results.Count)" -ForegroundColor Cyan

if ($fail -gt 0) { exit 1 }
exit 0