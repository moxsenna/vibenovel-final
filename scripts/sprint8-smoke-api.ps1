<#
.SYNOPSIS
  Sprint 8 Prose Beat Generation API safety smoke (Task 8.4).

.DESCRIPTION
  Run from repo root:
    powershell -ExecutionPolicy Bypass -File scripts/sprint8-smoke-api.ps1

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
    npm run smoke:api:sprint8 -- -MockMode success

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
  $attempt = 0
  while ((Get-Date) -lt $deadline) {
    $attempt++
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

function Test-GenerateProseResponseSafe {
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
  $created = Invoke-Api -Method POST -Path "/api/projects" -Headers $auth -Body '{"title":"S8 Smoke","entryPath":"rough_idea"}'
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

function New-GenerateProseBody {
  param(
    [string]$ChapterOutlineId,
    [string]$BeatId,
    [string]$SessionId,
    [string]$IdempotencyKey,
    [string]$QualityMode = "hemat"
  )
  return (@{
    chapterOutlineId = $ChapterOutlineId
    beatId           = $BeatId
    writingSessionId = $SessionId
    qualityMode      = $QualityMode
    idempotencyKey   = $IdempotencyKey
  } | ConvertTo-Json -Compress)
}

Write-Host "`nVibeNovel Sprint 8 Prose Beat Generation API Smoke Test" -ForegroundColor Cyan

$anonKey = Resolve-SupabaseAnonKey
if ([string]::IsNullOrWhiteSpace($TestEmail)) {
  $TestEmail = "s8smoke-$(Get-Random -Maximum 99999999)@example.com"
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
  $ch1Id = $ctx.Ch1Id
  $sessionId = $ctx.SessionId
  $beatId = $ctx.BeatId
} catch {
  Add-StepResult "bootstrap write context" "FAIL" (Get-SafeDetail $_.Exception.Message)
  Write-Host "Bootstrap aborted - write context setup failed." -ForegroundColor Red
  exit 1
}

$genPath = "/api/projects/$projectId/ai/generate-prose"
$genBody = New-GenerateProseBody -ChapterOutlineId $ch1Id -BeatId $beatId -SessionId $sessionId -IdempotencyKey "s8-base-$(Get-Random)"

Invoke-ApiExpectFailure -Name "POST generate-prose no token" -Method POST -Path $genPath -Body $genBody

if (-not $aiEnabled) {
  Invoke-ApiExpectErrorCode -Name "AI disabled 503" -Method POST -Path $genPath -Headers $auth -Body $genBody -ExpectedCode "AI_DISABLED"
} else {
  Add-StepResult "AI disabled 503" "SKIP" "AI_GENERATION_ENABLED=true on server"
}

$resolvedMockMode = $MockMode
if ($MockMode -eq "auto") {
  if ($aiEnabled -and $aiMock) { $resolvedMockMode = "success" } else { $resolvedMockMode = "skip_mock" }
}

if ($resolvedMockMode -eq "skip_mock" -or -not $aiEnabled -or -not $aiMock) {
  Add-StepResult "mock success path" "NOT RUN" "set AI_GENERATION_ENABLED=true AI_PROVIDER_MOCK=true and restart dev:api"
  Add-StepResult "insufficient credit" "NOT RUN" "requires AI enabled"
  Add-StepResult "mock fail_provider" "NOT RUN" "requires AI_PROVIDER_MOCK_MODE=fail_provider + restart"
  Add-StepResult "mock unsafe_output" "NOT RUN" "requires AI_PROVIDER_MOCK_MODE=unsafe_output + restart"
} else {
  $foundationBefore = Invoke-Api -Path "/api/projects/$projectId/foundation" -Headers $auth
  $factsBefore = $foundationBefore.data.facts.Count
  $charsBefore = $foundationBefore.data.characters.Count
  $speechBefore = Get-SpeechRulesCount -ProjectId $projectId
  $openLoopsBefore = (Invoke-Api -Path "/api/projects/$projectId/outline/open-loops" -Headers $auth).data.openLoops.Count
  $revealsBefore = (Invoke-Api -Path "/api/projects/$projectId/outline/reveals" -Headers $auth).data.reveals.Count
  $propResBefore = Invoke-Api -Path "/api/projects/$projectId/proposals?includeResolved=true" -Headers $auth
  $proposalsBefore = if ($propResBefore.data -is [array]) { $propResBefore.data.Count } else { 0 }

  $idemInsufficient = "s8-insuf-$(Get-Random)"
  $bodyInsufficient = New-GenerateProseBody -ChapterOutlineId $ch1Id -BeatId $beatId -SessionId $sessionId -IdempotencyKey $idemInsufficient
  Invoke-ApiExpectErrorCode -Name "insufficient credit 402" -Method POST -Path $genPath -Headers $auth -Body $bodyInsufficient -ExpectedCode "INSUFFICIENT_CREDIT"

  try {
    Seed-CreditBalance -UserId $script:UserId -Balance 100 | Out-Null
    Add-StepResult "seed credit balance" "PASS" "balance=100"
  } catch {
    Add-StepResult "seed credit balance" "FAIL" $_.Exception.Message.Substring(0, [Math]::Min(80, $_.Exception.Message.Length))
  }

  $balanceBefore = (Invoke-Api -Path "/api/credits/balance" -Headers $auth).data.creditBalance.balance
  $expectedCost = 5

  if ($resolvedMockMode -eq "success") {
    $idemSuccess = "s8-ok-$(Get-Random)"
    $bodySuccess = New-GenerateProseBody -ChapterOutlineId $ch1Id -BeatId $beatId -SessionId $sessionId -IdempotencyKey $idemSuccess
    try {
      $genRes = Invoke-Api -Method POST -Path $genPath -Headers $auth -Body $bodySuccess
      $json = $genRes | ConvertTo-Json -Depth 12
      $safe = Test-GenerateProseResponseSafe $json
      $sourceOk = ($genRes.data.version.source -eq "ai_generated")
      $attemptOk = ($genRes.data.generationAttempt.status -eq "succeeded")
      $entityOk = ($genRes.data.generationAttempt.outputEntityId -eq $genRes.data.version.id)
      $balanceAfter = $genRes.data.creditBalance.balance
      $debitOk = ($balanceAfter -eq ($balanceBefore - $expectedCost))
      Add-StepResult "generate prose 200/201" $(if ($safe -and $sourceOk -and $attemptOk -and $entityOk) { "PASS" } else { "FAIL" }) "source=$($genRes.data.version.source)"
      Add-StepResult "credit debited once" $(if ($debitOk) { "PASS" } else { "FAIL" }) "before=$balanceBefore after=$balanceAfter cost=$expectedCost"
      Add-StepResult "response leak guard" $(if ($safe) { "PASS" } else { "FAIL" }) "no packet/prompt/planningTruth"

      $replay = Invoke-Api -Method POST -Path $genPath -Headers $auth -Body $bodySuccess
      $replayBalance = $replay.data.creditBalance.balance
      $replayOk = ($replay.data.idempotentReplay -eq $true) -and ($replayBalance -eq $balanceAfter)
      Add-StepResult "idempotency replay no double debit" $(if ($replayOk) { "PASS" } else { "FAIL" }) "balance=$replayBalance"

      Assert-AuditActionExists -Name "audit generation_attempt_created" -ProjectId $projectId -Action "generation_attempt_created" -AuthHeaders $auth -AnonKey $anonKey
      Assert-AuditActionExists -Name "audit generation_attempt_succeeded" -ProjectId $projectId -Action "generation_attempt_succeeded" -AuthHeaders $auth -AnonKey $anonKey
      Assert-AuditActionExists -Name "audit ai_output_persisted" -ProjectId $projectId -Action "ai_output_persisted" -AuthHeaders $auth -AnonKey $anonKey

      $canonOk = Test-CanonUnchanged -ProjectId $projectId -FactsBefore $factsBefore -CharsBefore $charsBefore `
        -SpeechBefore $speechBefore -OpenLoopsBefore $openLoopsBefore -RevealsBefore $revealsBefore -ProposalsBefore $proposalsBefore
      Add-StepResult "no canon mutation" $(if ($canonOk) { "PASS" } else { "FAIL" }) "facts=$factsBefore proposals=$proposalsBefore"

      try {
        $attemptRow = Get-GenerationAttemptRow -AttemptId $genRes.data.generationAttempt.id
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
          } elseif ($provider -eq "openrouter" -and $attemptRow.model -eq "google/gemini-2.5-flash" -and $attemptRow.input_tokens -and $attemptRow.output_tokens) {
            $liveCostOk = ($null -ne $estCost) -and ([decimal]$estCost -gt 0)
            Add-StepResult "estimated_cost_usd live" $(if ($liveCostOk) { "PASS" } else { "FAIL" }) "cost=$estCost model=$($attemptRow.model)"
          } else {
            Add-StepResult "estimated_cost_usd mock" "SKIP" "provider=$provider (not mock success path)"
            Add-StepResult "estimated_cost_usd live" "SKIP" "provider=$provider model=$($attemptRow.model)"
          }
          Add-StepResult "attempt metadata leak guard" $(if ($metaSafe) { "PASS" } else { "FAIL" }) "no pricing table dump"
        }
      } catch {
        Add-StepResult "estimated_cost_usd mock" "FAIL" $_.Exception.Message.Substring(0, [Math]::Min(80, $_.Exception.Message.Length))
        Add-StepResult "attempt metadata leak guard" "NOT RUN" "lookup failed"
      }
    } catch {
      Add-StepResult "generate prose 200/201" "FAIL" $_.Exception.Message.Substring(0, [Math]::Min(100, $_.Exception.Message.Length))
      Add-StepResult "credit debited once" "NOT RUN" "generation failed"
      Add-StepResult "idempotency replay no double debit" "NOT RUN" "generation failed"
      Add-StepResult "response leak guard" "NOT RUN" "generation failed"
      Add-StepResult "no canon mutation" "NOT RUN" "generation failed"
    }
    Add-StepResult "mock fail_provider" "SKIP" "run with -MockMode fail_provider after env restart"
    Add-StepResult "mock unsafe_output" "SKIP" "run with -MockMode unsafe_output after env restart"
  }

  if ($resolvedMockMode -eq "fail_provider") {
    Add-StepResult "generate prose 200/201" "SKIP" "fail_provider mode"
    Add-StepResult "idempotency replay no double debit" "SKIP" "fail_provider mode"
    $balanceBeforeFail = (Invoke-Api -Path "/api/credits/balance" -Headers $auth).data.creditBalance.balance
    $proseBeforeFail = (Invoke-Api -Path "/api/projects/$projectId/write/beats/$beatId/prose" -Headers $auth).data.versions.Count
    $idemFail = "s8-fail-$(Get-Random)"
    $bodyFail = New-GenerateProseBody -ChapterOutlineId $ch1Id -BeatId $beatId -SessionId $sessionId -IdempotencyKey $idemFail
    Invoke-ApiExpectErrorCode -Name "mock fail_provider" -Method POST -Path $genPath -Headers $auth -Body $bodyFail -ExpectedCode "AI_PROVIDER_ERROR"
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

  if ($resolvedMockMode -eq "unsafe_output") {
    Add-StepResult "generate prose 200/201" "SKIP" "unsafe_output mode"
    Add-StepResult "idempotency replay no double debit" "SKIP" "unsafe_output mode"
    $balanceBeforeUnsafe = (Invoke-Api -Path "/api/credits/balance" -Headers $auth).data.creditBalance.balance
    $proseBefore = (Invoke-Api -Path "/api/projects/$projectId/write/beats/$beatId/prose" -Headers $auth).data.versions.Count
    $idemUnsafe = "s8-unsafe-$(Get-Random)"
    $bodyUnsafe = New-GenerateProseBody -ChapterOutlineId $ch1Id -BeatId $beatId -SessionId $sessionId -IdempotencyKey $idemUnsafe
    Invoke-ApiExpectErrorCode -Name "mock unsafe_output" -Method POST -Path $genPath -Headers $auth -Body $bodyUnsafe -ExpectedCode "AI_OUTPUT_UNSAFE"
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
}

# Reject client-supplied model/provider
if ($aiEnabled) {
  $badBody = (@{
    chapterOutlineId = $ch1Id
    beatId           = $beatId
    writingSessionId = $sessionId
    qualityMode      = "hemat"
    idempotencyKey   = "s8-bad-$(Get-Random)"
    model            = "evil/model"
  } | ConvertTo-Json -Compress)
  Invoke-ApiExpectErrorCode -Name "reject client model" -Method POST -Path $genPath -Headers $auth -Body $badBody -ExpectedCode "BAD_REQUEST"
} else {
  Add-StepResult "reject client model" "NOT RUN" "AI disabled"
}

Write-Host ""
$pass = @($Results | Where-Object { $_.Result -eq "PASS" }).Count
$fail = @($Results | Where-Object { $_.Result -eq "FAIL" }).Count
$skip = @($Results | Where-Object { $_.Result -in @("SKIP", "NOT RUN") }).Count
Write-Host "Summary: PASS=$pass FAIL=$fail SKIP/NOT RUN=$skip TOTAL=$($Results.Count)" -ForegroundColor Cyan

if ($fail -gt 0) { exit 1 }
exit 0