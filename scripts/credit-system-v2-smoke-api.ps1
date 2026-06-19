<#
.SYNOPSIS
  Database-backed Credit System v2 smoke against local Supabase.

.DESCRIPTION
  Starts the Node API in mock success and mock failure modes, creates isolated
  auth/project fixtures, and verifies debit, refund, replay idempotency,
  server-authoritative metadata, client override rejection, and top-up catalog
  integrity. Non-local targets are rejected unless -AllowHosted is explicit.
#>
[CmdletBinding()]
param(
  [string]$ApiBaseUrl = "http://127.0.0.1:8799",
  [string]$SupabaseUrl = "http://127.0.0.1:54321",
  [switch]$AllowHosted
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$script:ApiProcess = $null
$script:AnonKey = ""
$script:ServiceRoleKey = ""
$script:Token = ""
$script:UserId = ""
$script:ProjectId = ""
$script:LegacyProductId = ""
$script:PassCount = 0

function Write-Pass {
  param([string]$Name, [string]$Detail = "")
  $script:PassCount++
  Write-Host ("[PASS] {0}{1}" -f $Name, $(if ($Detail) { " - $Detail" } else { "" })) -ForegroundColor Green
}

function Assert-True {
  param([bool]$Condition, [string]$Message)
  if (-not $Condition) { throw $Message }
}

function Assert-Equal {
  param($Actual, $Expected, [string]$Message)
  if ($Actual -ne $Expected) {
    throw "$Message (expected=$Expected actual=$Actual)"
  }
}

function Test-LocalUrl {
  param([string]$Value)
  $uri = [Uri]$Value
  return $uri.Host -in @("localhost", "127.0.0.1", "::1")
}

function Resolve-LocalSupabaseKeys {
  Push-Location $RepoRoot
  try {
    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
      $statusOutput = & supabase status -o env 2>$null
      $statusExitCode = $LASTEXITCODE
    } finally {
      $ErrorActionPreference = $previousErrorActionPreference
    }
    if ($statusExitCode -ne 0) {
      throw "Local Supabase status failed (exit=$statusExitCode)"
    }
    foreach ($line in $statusOutput) {
      if ($line -match '^ANON_KEY="(.+)"\s*$') {
        $script:AnonKey = $Matches[1]
      } elseif ($line -match '^SERVICE_ROLE_KEY="(.+)"\s*$') {
        $script:ServiceRoleKey = $Matches[1]
      }
    }
  } finally {
    Pop-Location
  }
  Assert-True (-not [string]::IsNullOrWhiteSpace($script:AnonKey)) "Local Supabase anon key was not found"
  Assert-True (-not [string]::IsNullOrWhiteSpace($script:ServiceRoleKey)) "Local Supabase service role key was not found"
}

function Get-AdminHeaders {
  return @{
    apikey = $script:ServiceRoleKey
    Authorization = "Bearer $($script:ServiceRoleKey)"
    "Content-Type" = "application/json"
  }
}

function Invoke-AdminRest {
  param(
    [ValidateSet("GET", "POST", "PATCH", "DELETE")][string]$Method,
    [string]$Path,
    $Body = $null,
    [string]$Prefer = ""
  )
  $headers = Get-AdminHeaders
  if ($Prefer) { $headers.Prefer = $Prefer }
  $params = @{
    Uri = "$SupabaseUrl/rest/v1/$Path"
    Method = $Method
    Headers = $headers
    ErrorAction = "Stop"
  }
  if ($null -ne $Body) {
    $params.Body = ($Body | ConvertTo-Json -Depth 20 -Compress)
  }
  return Invoke-RestMethod @params
}

function Invoke-Api {
  param(
    [ValidateSet("GET", "POST", "PATCH", "DELETE")][string]$Method = "GET",
    [string]$Path,
    $Body = $null
  )
  $headers = @{ Authorization = "Bearer $($script:Token)" }
  $params = @{
    Uri = "$ApiBaseUrl$Path"
    Method = $Method
    Headers = $headers
    ErrorAction = "Stop"
  }
  if ($null -ne $Body) {
    $params.ContentType = "application/json"
    $params.Body = ($Body | ConvertTo-Json -Depth 20 -Compress)
  }
  return Invoke-RestMethod @params
}

function Get-ApiErrorCode {
  param($ErrorRecord)
  try {
    return (($ErrorRecord.ErrorDetails.Message | ConvertFrom-Json).error.code)
  } catch {
    return "UNKNOWN"
  }
}

function Wait-ApiReady {
  $deadline = (Get-Date).AddSeconds(45)
  while ((Get-Date) -lt $deadline) {
    try {
      $health = Invoke-RestMethod -Uri "$ApiBaseUrl/api/health" -TimeoutSec 3
      if ($health.ok -eq $true) { return $health }
    } catch { }
    Start-Sleep -Milliseconds 500
  }
  throw "API did not become ready at $ApiBaseUrl"
}

function Stop-ApiServer {
  if ($script:ApiProcess -and -not $script:ApiProcess.HasExited) {
    Stop-Process -Id $script:ApiProcess.Id -Force -ErrorAction SilentlyContinue
    $script:ApiProcess.WaitForExit(5000) | Out-Null
  }
  $script:ApiProcess = $null
}

function Start-ApiServer {
  param(
    [ValidateSet("success", "fail_provider", "disabled")]
    [string]$Mode
  )
  Stop-ApiServer
  $port = ([Uri]$ApiBaseUrl).Port
  $env:PORT = [string]$port
  $env:SUPABASE_URL = $SupabaseUrl
  $env:SUPABASE_ANON_KEY = $script:AnonKey
  $env:SUPABASE_SERVICE_ROLE_KEY = $script:ServiceRoleKey
  $env:APP_ENV = "development"
  $env:ALLOWED_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173"
  $env:AI_GENERATION_ENABLED = $(if ($Mode -eq "disabled") { "false" } else { "true" })
  $env:AI_PROVIDER_MOCK = "true"
  $env:AI_PROVIDER_MOCK_MODE = $(if ($Mode -eq "fail_provider") { "fail_provider" } else { "success" })
  $env:CREDIT_TOPUP_ENABLED = "false"
  $env:PAYMENT_PROVIDER_MOCK = "true"

  $logBase = Join-Path $env:TEMP "credit-v2-api-$Mode-$PID"
  $script:ApiProcess = Start-Process `
    -FilePath "node.exe" `
    -ArgumentList "apps/api/dist-node/node-server.js" `
    -WorkingDirectory $RepoRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput "$logBase.out.log" `
    -RedirectStandardError "$logBase.err.log" `
    -PassThru

  $health = Wait-ApiReady
  Assert-Equal ([bool]$health.data.env.aiGenerationEnabled) ($Mode -ne "disabled") "Unexpected AI generation flag"
  Assert-Equal ([bool]$health.data.env.aiProviderMock) $true "Mock provider must be enabled"
  Assert-Equal ([bool]$health.data.env.creditTopupEnabled) $false "Public payment must remain disabled"
  Write-Pass "API mode $Mode ready" "payment OFF"
}

function Get-Balance {
  return [int](Invoke-Api -Path "/api/credits/balance").data.creditBalance.balance
}

function Get-AttemptByKey {
  param([string]$Key)
  $encoded = [Uri]::EscapeDataString($Key)
  $rows = @(Invoke-AdminRest -Method GET -Path "generation_attempts?user_id=eq.$($script:UserId)&idempotency_key=eq.$encoded&select=id,status,generation_type,provider,model,credit_cost,output_entity_id,metadata")
  if ($rows.Count -eq 0) { return $null }
  return $rows[0]
}

function Get-LedgerForAttempt {
  param([string]$AttemptId)
  return @(Invoke-AdminRest -Method GET -Path "credit_ledger?attempt_id=eq.$AttemptId&select=id,direction,reason,amount,balance_after,metadata&order=created_at.asc")
}

function Assert-AttemptAndDebit {
  param(
    [string]$Name,
    [string]$IdempotencyKey,
    [string]$GenerationType,
    [int]$ExpectedCost
  )
  $attempt = Get-AttemptByKey $IdempotencyKey
  Assert-True ($null -ne $attempt) "$Name attempt was not persisted"
  Assert-Equal $attempt.status "succeeded" "$Name attempt did not succeed"
  Assert-Equal $attempt.generation_type $GenerationType "$Name generation type mismatch"
  Assert-Equal ([int]$attempt.credit_cost) $ExpectedCost "$Name attempt credit cost mismatch"
  Assert-True (-not [string]::IsNullOrWhiteSpace([string]$attempt.provider)) "$Name provider missing"
  Assert-True (-not [string]::IsNullOrWhiteSpace([string]$attempt.model)) "$Name model missing"

  $ledger = Get-LedgerForAttempt $attempt.id
  $debits = @($ledger | Where-Object { $_.direction -eq "debit" -and $_.reason -eq "generation_debit" })
  Assert-Equal $debits.Count 1 "$Name must have exactly one debit ledger row"
  Assert-Equal ([int]$debits[0].amount) $ExpectedCost "$Name debit amount mismatch"
  $meta = $debits[0].metadata
  Assert-Equal $meta.creditPricingVersion "v2" "$Name pricing version missing"
  Assert-Equal ([int]$meta.creditCost) $ExpectedCost "$Name ledger credit cost mismatch"
  Assert-Equal $meta.generationAttemptId $attempt.id "$Name attempt metadata mismatch"
  Assert-Equal $meta.idempotencyKey $IdempotencyKey "$Name idempotency metadata mismatch"
  Assert-True (-not [string]::IsNullOrWhiteSpace([string]$meta.featureKey)) "$Name featureKey missing"
  return $attempt
}

function Invoke-PaidAction {
  param(
    [string]$Name,
    [string]$Path,
    $Body,
    [string]$IdempotencyKey,
    [string]$GenerationType,
    [int]$ExpectedCost
  )
  $before = Get-Balance
  $response = Invoke-Api -Method POST -Path $Path -Body $Body
  $after = Get-Balance
  Assert-Equal ($before - $after) $ExpectedCost "$Name balance delta mismatch"
  Assert-AttemptAndDebit $Name $IdempotencyKey $GenerationType $ExpectedCost | Out-Null
  Write-Pass $Name "debit=$ExpectedCost balance=$after"
  return $response
}

function Assert-Replay {
  param(
    [string]$Name,
    [string]$Path,
    $Body,
    [string]$IdempotencyKey
  )
  $before = Get-Balance
  $response = Invoke-Api -Method POST -Path $Path -Body $Body
  $after = Get-Balance
  Assert-Equal $after $before "$Name replay changed the balance"
  Assert-Equal ([bool]$response.data.idempotentReplay) $true "$Name replay flag missing"
  $attempt = Get-AttemptByKey $IdempotencyKey
  $ledger = Get-LedgerForAttempt $attempt.id
  Assert-Equal @($ledger | Where-Object { $_.direction -eq "debit" }).Count 1 "$Name replay wrote a second debit"
  Write-Pass "$Name replay" "balance unchanged"
}

function New-Fixture {
  $runId = "credit-v2-$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())-$PID"
  $email = "$runId@example.test"
  $password = "CreditV2-Local-Smoke-Only!"
  $created = Invoke-RestMethod `
    -Uri "$SupabaseUrl/auth/v1/admin/users" `
    -Method POST `
    -Headers (Get-AdminHeaders) `
    -Body (@{ email = $email; password = $password; email_confirm = $true } | ConvertTo-Json -Compress)
  $script:UserId = if (
    $null -ne $created.PSObject.Properties["user"] -and
    $null -ne $created.user -and
    $null -ne $created.user.PSObject.Properties["id"]
  ) {
    $created.user.id
  } else {
    $created.id
  }
  Assert-True (-not [string]::IsNullOrWhiteSpace($script:UserId)) "Auth fixture user id missing"

  $signin = Invoke-RestMethod `
    -Uri "$SupabaseUrl/auth/v1/token?grant_type=password" `
    -Method POST `
    -Headers @{ apikey = $script:AnonKey; Authorization = "Bearer $($script:AnonKey)" } `
    -ContentType "application/json" `
    -Body (@{ email = $email; password = $password } | ConvertTo-Json -Compress)
  $script:Token = $signin.access_token
  Assert-True (-not [string]::IsNullOrWhiteSpace($script:Token)) "Auth fixture access token missing"

  $project = Invoke-Api -Method POST -Path "/api/projects" -Body @{
    title = "ZZ-TEST Credit v2 $runId"
    entryPath = "rough_idea"
  }
  $script:ProjectId = $project.data.id
  Assert-True (-not [string]::IsNullOrWhiteSpace($script:ProjectId)) "Project fixture id missing"

  Invoke-AdminRest -Method POST -Path "credit_balances?on_conflict=user_id" -Prefer "resolution=merge-duplicates,return=minimal" -Body @{
    user_id = $script:UserId
    balance = 100000
    monthly_quota = 100000
    monthly_used = 0
    source = "admin_grant"
  } | Out-Null
  Invoke-AdminRest -Method POST -Path "credit_ledger" -Prefer "return=minimal" -Body @{
    user_id = $script:UserId
    project_id = $script:ProjectId
    amount = 100000
    direction = "credit"
    reason = "smoke_fixture_grant"
    balance_after = 100000
    metadata = @{
      fixture = "credit-v2-smoke"
      fixtureRunId = $runId
      grantSource = "service_role"
    }
  } | Out-Null
  $grantLedgerResponse = Invoke-AdminRest -Method GET -Path "credit_ledger?user_id=eq.$($script:UserId)&reason=eq.smoke_fixture_grant&select=id,amount,direction,balance_after,metadata"
  $grantLedgerRows = @($grantLedgerResponse)
  Assert-Equal $grantLedgerRows.Count 1 "Fixture grant audit ledger row missing"
  Assert-Equal $grantLedgerRows[0].metadata.fixtureRunId $runId "Fixture grant audit metadata mismatch"
  Invoke-AdminRest -Method POST -Path "ai_usage_daily_caps?on_conflict=user_id,project_id" -Prefer "resolution=merge-duplicates,return=minimal" -Body @{
    user_id = $script:UserId
    project_id = $script:ProjectId
    daily_credit_cap = 100000
  } | Out-Null
  Write-Pass "Fixture created" "project=$($script:ProjectId)"
}

function Test-TopupIntegrity {
  $productsResponse = Invoke-AdminRest -Method GET -Path "credit_topup_products?is_active=eq.true&select=id,slug,credits,bonus_credits,is_active"
  $products = if ($productsResponse -is [System.Array]) {
    $productsResponse
  } else {
    @($productsResponse)
  }
  $expected = @{
    starter = @(20000, 0)
    creator = @(50000, 5000)
    pro = @(120000, 10000)
    studio = @(270000, 30000)
  }
  foreach ($slug in $expected.Keys) {
    $row = $products | Where-Object { $_.slug -eq $slug } | Select-Object -First 1
    Assert-True ($null -ne $row) "Active top-up product missing: $slug"
    Assert-Equal ([int]$row.credits) $expected[$slug][0] "$slug base credits mismatch"
    Assert-Equal ([int]$row.bonus_credits) $expected[$slug][1] "$slug bonus credits mismatch"
  }

  $legacySlug = "legacy-$PID-$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"
  $legacyResponse = Invoke-AdminRest -Method POST -Path "credit_topup_products" -Prefer "return=representation" -Body @{
    slug = $legacySlug
    name = "Legacy smoke fixture"
    description = "Historical order integrity fixture"
    price_idr = 10000
    credits = 1000
    bonus_credits = 0
    is_active = $false
    sort_order = 999
    metadata = @{ fixture = "credit-v2-smoke" }
  }
  $legacy = if ($legacyResponse -is [System.Array]) { $legacyResponse[0] } else { $legacyResponse }
  $script:LegacyProductId = $legacy.id

  $orderKey = "legacy-order-$PID"
  $orderResponse = Invoke-AdminRest -Method POST -Path "credit_topup_orders" -Prefer "return=representation" -Body @{
    user_id = $script:UserId
    product_id = $script:LegacyProductId
    provider = "mock"
    amount_idr = 10000
    credits_to_grant = 1000
    status = "pending"
    idempotency_key = $orderKey
    metadata = @{ fixture = "credit-v2-smoke" }
  }
  $order = if ($orderResponse -is [System.Array]) { $orderResponse[0] } else { $orderResponse }
  $readbackResponse = Invoke-AdminRest -Method GET -Path "credit_topup_orders?id=eq.$($order.id)&select=id,product_id,credits_to_grant"
  $readback = if ($readbackResponse -is [System.Array]) {
    $readbackResponse
  } else {
    @($readbackResponse)
  }
  Assert-Equal @($readback).Count 1 "Historical order fixture was not readable"
  Assert-Equal @($readback)[0].product_id $script:LegacyProductId "Historical order product FK changed"
  Write-Pass "Top-up v2 and historical order integrity" "4 products + FK preserved"
}

function Cleanup-Fixture {
  Stop-ApiServer
  if ($script:UserId) {
    try {
      Invoke-RestMethod `
        -Uri "$SupabaseUrl/auth/v1/admin/users/$($script:UserId)" `
        -Method DELETE `
        -Headers (Get-AdminHeaders) | Out-Null
    } catch {
      Write-Warning "Could not delete auth fixture user"
    }
  }
  if ($script:LegacyProductId) {
    try {
      Invoke-AdminRest -Method DELETE -Path "credit_topup_products?id=eq.$($script:LegacyProductId)" | Out-Null
    } catch {
      Write-Warning "Could not delete legacy product fixture"
    }
  }
}

if ((-not (Test-LocalUrl $ApiBaseUrl) -or -not (Test-LocalUrl $SupabaseUrl)) -and -not $AllowHosted) {
  throw "Refusing non-local target. Pass -AllowHosted only for an explicitly approved hosted smoke."
}

Push-Location $RepoRoot
try {
  Resolve-LocalSupabaseKeys
  npm run build:api:node
  if ($LASTEXITCODE -ne 0) { throw "Node API build failed" }

  Start-ApiServer -Mode success
  New-Fixture

  $intakeKey = "intake-$PID"
  $intakeBody = @{
    content = "Laras menemukan surat keluarga lama dan ingin melindungi adiknya dari rahasia masa lalu."
    idempotencyKey = $intakeKey
  }
  Invoke-PaidAction "Intake reply" "/api/projects/$($script:ProjectId)/intake/messages" $intakeBody $intakeKey "intake_assistant" 100 | Out-Null
  Assert-Replay "Intake reply" "/api/projects/$($script:ProjectId)/intake/messages" $intakeBody $intakeKey

  $conceptKey = "concept-$PID"
  $conceptBody = @{ idempotencyKey = $conceptKey; basedOnSignals = $true }
  $concepts = Invoke-PaidAction "Concept generate 3" "/api/projects/$($script:ProjectId)/concepts/generate" $conceptBody $conceptKey "concept_generation" 1000
  Assert-Replay "Concept generate 3" "/api/projects/$($script:ProjectId)/concepts/generate" $conceptBody $conceptKey
  $conceptId = $concepts.data.concepts[0].id
  Invoke-Api -Method POST -Path "/api/projects/$($script:ProjectId)/concepts/$conceptId/select" -Body @{} | Out-Null

  $foundationKey = "foundation-$PID"
  $foundationBody = @{ idempotencyKey = $foundationKey }
  $foundation = Invoke-PaidAction "Foundation setup" "/api/projects/$($script:ProjectId)/foundation/proposals/generate" $foundationBody $foundationKey "foundation_proposal" 2000
  Assert-Replay "Foundation setup" "/api/projects/$($script:ProjectId)/foundation/proposals/generate" $foundationBody $foundationKey
  foreach ($proposal in $foundation.data.proposals) {
    if ($proposal.proposalType -in @("foundation", "character", "fact", "relationship_speech_rule", "style")) {
      Invoke-Api -Method POST -Path "/api/projects/$($script:ProjectId)/foundation/proposals/$($proposal.id)/accept" -Body @{} | Out-Null
    }
  }
  $foundationReadiness = (Invoke-Api -Path "/api/projects/$($script:ProjectId)/foundation/readiness").data
  $incompleteFoundationChecks = @(
    $foundationReadiness.checks |
      Where-Object { $_.status -ne "pass" } |
      ForEach-Object { "$($_.key):$($_.status)" }
  )
  Assert-True (
    [bool]$foundationReadiness.canLock
  ) "Foundation readiness blocked lock (score=$($foundationReadiness.readinessScore); checks=$($incompleteFoundationChecks -join ','))"
  Invoke-Api -Method POST -Path "/api/projects/$($script:ProjectId)/foundation/lock" -Body @{} | Out-Null

  $outlineKey = "outline-$PID"
  $outlineBody = @{ idempotencyKey = $outlineKey; targetChapterCount = 10 }
  Invoke-PaidAction "Outline 10 chapters" "/api/projects/$($script:ProjectId)/outline/generate" $outlineBody $outlineKey "outline_generation" 2500 | Out-Null
  Assert-Replay "Outline 10 chapters" "/api/projects/$($script:ProjectId)/outline/generate" $outlineBody $outlineKey
  Invoke-Api -Method POST -Path "/api/projects/$($script:ProjectId)/outline/approve" -Body @{} | Out-Null
  Invoke-Api -Method POST -Path "/api/projects/$($script:ProjectId)/outline/lock" -Body @{} | Out-Null

  $chapters = (Invoke-Api -Path "/api/projects/$($script:ProjectId)/outline/chapters").data.chapters
  $chapterId = ($chapters | Where-Object { $_.chapterNumber -eq 1 } | Select-Object -First 1).id
  $session = Invoke-Api -Method POST -Path "/api/projects/$($script:ProjectId)/write/sessions" -Body @{ chapterOutlineId = $chapterId }
  $sessionId = $session.data.session.id

  $beforeBeats = Get-Balance
  $beatsResult = Invoke-Api -Method POST -Path "/api/projects/$($script:ProjectId)/write/sessions/$sessionId/beats/generate" -Body @{}
  $afterBeats = Get-Balance
  Assert-Equal ($beforeBeats - $afterBeats) 3 "Chapter beats balance delta mismatch"
  Assert-AttemptAndDebit "Chapter beats" "beat:$sessionId`:0" "beat_generation" 3 | Out-Null
  Write-Pass "Chapter beats" "debit=3"
  $beatId = $beatsResult.data.beats[0].id

  $latestVersionId = ""
  foreach ($mode in @(
    @{ Name = "hemat"; Cost = 800 },
    @{ Name = "seimbang"; Cost = 1500 },
    @{ Name = "terbaik"; Cost = 7500 }
  )) {
    $key = "prose-$($mode.Name)-$PID"
    $body = @{
      chapterOutlineId = $chapterId
      beatId = $beatId
      writingSessionId = $sessionId
      qualityMode = $mode.Name
      idempotencyKey = $key
    }
    $prose = Invoke-PaidAction "Prose $($mode.Name)" "/api/projects/$($script:ProjectId)/ai/generate-prose" $body $key "prose_beat" $mode.Cost
    if ($mode.Name -eq "hemat") {
      Assert-Replay "Prose hemat" "/api/projects/$($script:ProjectId)/ai/generate-prose" $body $key
    }
    $latestVersionId = $prose.data.version.id
  }

  $rewriteKey = "rewrite-$PID"
  $rewriteBody = @{
    proseVersionId = $latestVersionId
    writingSessionId = $sessionId
    rewriteMode = "improve_emotion"
    qualityMode = "hemat"
    idempotencyKey = $rewriteKey
  }
  Invoke-PaidAction "Rewrite hemat" "/api/projects/$($script:ProjectId)/ai/rewrite-prose" $rewriteBody $rewriteKey "prose_rewrite" 500 | Out-Null

  try {
    Invoke-Api -Method POST -Path "/api/projects/$($script:ProjectId)/ai/generate-prose" -Body @{
      chapterOutlineId = $chapterId
      beatId = $beatId
      writingSessionId = $sessionId
      qualityMode = "hemat"
      idempotencyKey = "override-$PID"
      creditCost = 1
      model = "client/model"
      provider = "client"
    } | Out-Null
    throw "Client authority override request unexpectedly succeeded"
  } catch {
    Assert-Equal (Get-ApiErrorCode $_) "BAD_REQUEST" "Client authority override must be rejected"
  }
  Write-Pass "Client model/provider/creditCost override rejected"

  Start-ApiServer -Mode fail_provider
  $failureKey = "failure-$PID"
  $failureBefore = Get-Balance
  try {
    Invoke-Api -Method POST -Path "/api/projects/$($script:ProjectId)/ai/generate-prose" -Body @{
      chapterOutlineId = $chapterId
      beatId = $beatId
      writingSessionId = $sessionId
      qualityMode = "hemat"
      idempotencyKey = $failureKey
    } | Out-Null
    throw "Mock provider failure unexpectedly succeeded"
  } catch {
    Assert-Equal (Get-ApiErrorCode $_) "AI_PROVIDER_ERROR" "Provider failure error code mismatch"
    $publicErrorBody = [string]$_.ErrorDetails.Message
    Assert-True (
      $publicErrorBody -notmatch "(?i)authorization|bearer\s+|api[_ -]?key|service[_ -]?role|raw prompt"
    ) "Provider failure response leaked sensitive provider details"
  }
  $failureAfter = Get-Balance
  Assert-Equal $failureAfter $failureBefore "Provider failure did not restore the balance"
  $failedAttempt = Get-AttemptByKey $failureKey
  Assert-Equal $failedAttempt.status "failed" "Failure attempt status mismatch"
  $failureLedger = Get-LedgerForAttempt $failedAttempt.id
  $failureDebits = @($failureLedger | Where-Object { $_.direction -eq "debit" })
  $failureRefunds = @($failureLedger | Where-Object { $_.direction -eq "refund" })
  Assert-Equal $failureDebits.Count 1 "Failure debit missing"
  Assert-Equal $failureRefunds.Count 1 "Failure refund missing"
  Assert-Equal ([int]$failureDebits[0].amount) ([int]$failureRefunds[0].amount) "Refund amount mismatch"
  Write-Pass "Failure refund lifecycle" "balance restored"

  Start-ApiServer -Mode success
  Invoke-Api -Method POST -Path "/api/projects/$($script:ProjectId)/write/sessions/$sessionId/ready-for-summary" -Body @{} | Out-Null
  $summaryKey = "chapter-summary-generation-$($script:ProjectId)-smoke-$PID"
  $summaryBefore = Get-Balance
  $summary = Invoke-Api -Method POST -Path "/api/projects/$($script:ProjectId)/summary/generate" -Body @{
    chapterOutlineId = $chapterId
    writingSessionId = $sessionId
  }
  $summaryAfter = Get-Balance
  Assert-Equal ($summaryBefore - $summaryAfter) 500 "Chapter summary balance delta mismatch"
  $summaryAttempt = @(Invoke-AdminRest -Method GET -Path "generation_attempts?user_id=eq.$($script:UserId)&generation_type=eq.chapter_summary_generation&order=created_at.desc&limit=1&select=id,idempotency_key")[0]
  Assert-AttemptAndDebit "Chapter summary" $summaryAttempt.idempotency_key "chapter_summary_generation" 500 | Out-Null
  Write-Pass "Chapter summary" "debit=500"
  $summaryId = $summary.data.summary.id
  Invoke-Api -Method POST -Path "/api/projects/$($script:ProjectId)/summary/$summaryId/approve" -Body @{} | Out-Null

  $package = Invoke-Api -Method POST -Path "/api/projects/$($script:ProjectId)/publish/generate" -Body @{
    chapterOutlineId = $chapterId
    chapterSummaryId = $summaryId
  }
  $packageId = $package.data.publishPackage.id
  $publishKey = "publish-$PID"
  $publishBody = @{
    packageId = $packageId
    fields = @("teaser", "caption")
    idempotencyKey = $publishKey
  }
  Invoke-PaidAction "Publish package copy" "/api/projects/$($script:ProjectId)/ai/improve-publish-copy" $publishBody $publishKey "publish_copy" 400 | Out-Null
  Assert-Replay "Publish package copy" "/api/projects/$($script:ProjectId)/ai/improve-publish-copy" $publishBody $publishKey

  Test-TopupIntegrity

  Start-ApiServer -Mode disabled
  $freeKey = "free-user-message-$PID"
  $freeBefore = Get-Balance
  $free = Invoke-Api -Method POST -Path "/api/projects/$($script:ProjectId)/intake/messages" -Body @{
    content = "Catatan tambahan tanpa balasan AI."
    idempotencyKey = $freeKey
  }
  $freeAfter = Get-Balance
  Assert-Equal $freeAfter $freeBefore "AI-disabled user message changed the balance"
  Assert-Equal ([int]$free.data.creditCost) 0 "AI-disabled user message must report zero cost"
  Assert-True ($null -eq (Get-AttemptByKey $freeKey)) "AI-disabled user message created a generation attempt"
  Write-Pass "AI-disabled user message is free"

  Write-Host ""
  Write-Host "Credit System v2 smoke complete: PASS=$($script:PassCount)" -ForegroundColor Cyan
} finally {
  Cleanup-Fixture
  Pop-Location
}
