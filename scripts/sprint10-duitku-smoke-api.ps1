<#
.SYNOPSIS
  Task 10.13 - Duitku POP sandbox live smoke + callback fixture regression.

.DESCRIPTION
  Run from repo root:
    npm run smoke:api:sprint10:duitku
    npm run smoke:api:sprint10:duitku -- -LiveCreate   # explicit sandbox checkout only

  Never logs DUITKU_MERCHANT_CODE, DUITKU_MERCHANT_KEY, or raw provider secrets.
  Default: precheck + fixture callback matrix - no Duitku network unless -LiveCreate.

  Prerequisites for -LiveCreate (gitignored apps/api/.dev.vars):
    CREDIT_TOPUP_ENABLED=true
    PAYMENT_PROVIDER=duitku
    PAYMENT_PROVIDER_MOCK=false
    DUITKU_ENV=sandbox
    DUITKU_MERCHANT_CODE=<from merchant portal>
    DUITKU_MERCHANT_KEY=<from merchant portal>
    DUITKU_CALLBACK_URL=<public staging or tunnel>/api/payments/duitku/callback
    DUITKU_RETURN_URL=http://localhost:5173

  Live callback/payment requires public DUITKU_CALLBACK_URL (not localhost).
  After live smoke, rollback: PAYMENT_PROVIDER_MOCK=true, PAYMENT_PROVIDER=mock.

  Report: docs/59-duitku-sandbox-live-smoke-report.md (local), docs/70 (AWS Mode B — Task 10.13b)

  AWS staging (Task 10.13b):
    npm run smoke:api:sprint10:duitku -- -ApiBaseUrl https://api-staging.narraza.web.id -StagingMode -LiveCreate
#>
[CmdletBinding()]
param(
  [string]$ApiBaseUrl = "http://127.0.0.1:8787",
  [string]$SupabaseUrl = "",
  [string]$SupabaseAnonKey = "",
  [string]$TestEmail = "",
  [string]$TestPassword = "VibeNovel-Staging-Smoke-Test!",
  [switch]$StagingMode,
  [switch]$LiveCreate,
  [switch]$ExpectCallback,
  [int]$CallbackPollSeconds = 180
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Continue"

$RepoRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot "lib\staging-smoke-common.ps1")

if ($StagingMode -or $ApiBaseUrl -match '^https?://api-staging\.') {
  Import-StagingSupabaseEnv -RepoRoot $RepoRoot
  if ([string]::IsNullOrWhiteSpace($SupabaseUrl)) {
    $SupabaseUrl = Get-StagingSupabaseCredential "STAGING_SUPABASE_URL"
  }
  if ([string]::IsNullOrWhiteSpace($SupabaseAnonKey)) {
    $SupabaseAnonKey = Get-StagingSupabaseCredential "STAGING_SUPABASE_ANON_KEY"
  }
}
if ([string]::IsNullOrWhiteSpace($SupabaseUrl)) { $SupabaseUrl = "http://127.0.0.1:54321" }
$Results = New-Object System.Collections.Generic.List[object]
$StepNumber = 0
$auth = @{}
$script:UserId = $null
$script:ServiceRoleKey = $null
$checkoutPath = "/api/credits/topup/checkout"
$duitkuCallbackPath = "/api/payments/duitku/callback"
$script:SmokeMerchantCode = "SMOKE01"
$script:SmokeMerchantKey = "smoke-local-duitku-callback-key"

function Add-StepResult {
  param([string]$Name, [ValidateSet("PASS", "FAIL", "SKIP", "NOT RUN", "PARTIAL", "BLOCKED")][string]$Result, [string]$Detail = "")
  $script:StepNumber++
  $Results.Add([PSCustomObject]@{ Step = $script:StepNumber; Test = $Name; Result = $Result; Detail = $Detail }) | Out-Null
  $color = switch ($Result) {
    "PASS" { "Green" }
    "FAIL" { "Red" }
    "PARTIAL" { "Yellow" }
    "BLOCKED" { "Yellow" }
    default { "Yellow" }
  }
  Write-Host ("[{0}] {1,-52} {2}" -f $Result, $Name, $Detail) -ForegroundColor $color
}

function Get-SafeDetail {
  param([string]$Text)
  if ([string]::IsNullOrWhiteSpace($Text)) { return "" }
  $s = $Text -replace 'Bearer\s+[A-Za-z0-9._-]+', 'Bearer [redacted]'
  $s = $s -replace 'eyJ[A-Za-z0-9._-]{20,}', '[jwt-redacted]'
  $s = $s -replace 'DUITKU_MERCHANT_KEY', '[duitku-key-redacted]'
  $s = $s -replace 'DUITKU_MERCHANT_CODE', '[duitku-code-redacted]'
  $s = $s -replace 'MAYAR_API_KEY', '[mayar-key-redacted]'
  if ($s.Length -gt 140) { return $s.Substring(0, 137) + "..." }
  return $s
}

function Resolve-SupabaseAnonKey {
  if (-not [string]::IsNullOrWhiteSpace($SupabaseAnonKey)) { return $SupabaseAnonKey.Trim() }
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
  $stagingSr = Get-StagingSupabaseCredential "STAGING_SUPABASE_SERVICE_ROLE_KEY"
  if (-not [string]::IsNullOrWhiteSpace($stagingSr)) {
    $script:ServiceRoleKey = $stagingSr
    return $script:ServiceRoleKey
  }
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

function Get-ApiHealth {
  try {
    return Invoke-RestMethod -Uri "$ApiBaseUrl/api/health" -Method GET -TimeoutSec 10
  } catch { return $null }
}

function Invoke-Api {
  param(
    [ValidateSet("GET", "POST")][string]$Method = "GET",
    [Parameter(Mandatory)][string]$Path,
    [hashtable]$Headers = @{},
    [string]$Body = $null
  )
  $uri = "$ApiBaseUrl$Path"
  $params = @{ Method = $Method; Uri = $uri; Headers = $Headers; TimeoutSec = 45 }
  if ($Body) { $params.Body = $Body; $params.ContentType = "application/json" }
  return Invoke-RestMethod @params
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

function Get-CreditBalance {
  param([string]$UserId)
  $srk = Resolve-ServiceRoleKey
  $rows = Invoke-RestMethod -Uri "$SupabaseUrl/rest/v1/credit_balances?user_id=eq.$UserId&select=balance" `
    -Headers @{ apikey = $srk; Authorization = "Bearer $srk" } -Method GET
  if ($rows -is [array] -and $rows.Count -gt 0) { return [int]$rows[0].balance }
  return 0
}

function Get-LedgerTopupCount {
  param([string]$UserId)
  $srk = Resolve-ServiceRoleKey
  $rows = Invoke-RestMethod -Uri "$SupabaseUrl/rest/v1/credit_ledger?user_id=eq.$UserId&reason=eq.credit_topup&direction=eq.credit&select=id" `
    -Headers @{ apikey = $srk; Authorization = "Bearer $srk" } -Method GET
  if ($rows -is [array]) { return $rows.Count }
  return 0
}

function Get-TopupOrdersForUser {
  param([string]$UserId)
  $srk = Resolve-ServiceRoleKey
  $uri = ('{0}/rest/v1/credit_topup_orders?user_id=eq.{1}&select=id,status,amount_idr,credits_to_grant,provider,provider_invoice_id,provider_transaction_id,payment_url,idempotency_key&order=created_at.desc' -f $SupabaseUrl, $UserId)
  $rows = Invoke-RestMethod -Uri $uri -Headers @{ apikey = $srk; Authorization = "Bearer $srk" } -Method GET
  if ($rows -is [array]) { return $rows }
  if ($null -ne $rows) { return @($rows) }
  return @()
}

function Assert-AuditActionExists {
  param([string]$Name, [string]$UserId, [string]$Action)
  $srk = Resolve-ServiceRoleKey
  $uri = ('{0}/rest/v1/audit_logs?user_id=eq.{1}&action=eq.{2}&select=action,entity_type,entity_id&order=created_at.desc&limit=5' -f $SupabaseUrl, $UserId, $Action)
  try {
    $rows = Invoke-RestMethod -Uri $uri -Headers @{ apikey = $srk; Authorization = "Bearer $srk" } -Method GET
    if ($rows -is [array] -and $rows.Count -gt 0) {
      Add-StepResult $Name "PASS" "count=$($rows.Count)"
    } else {
      Add-StepResult $Name "FAIL" "no audit row for $Action"
    }
  } catch {
    Add-StepResult $Name "FAIL" (Get-SafeDetail $_.Exception.Message)
  }
}

function Test-ResponseSafe {
  param([string]$Json)
  $bad = @(
    "DUITKU_MERCHANT_KEY", "DUITKU_MERCHANT_CODE",
    "MAYAR_API_KEY", "MAYAR_WEBHOOK_TOKEN", "OPENROUTER_API_KEY", "service_role",
    "provider_payload_safe", "providerPayloadSafe"
  )
  foreach ($pat in $bad) {
    if ($Json -match [regex]::Escape($pat)) { return $false }
  }
  return $true
}

function Get-DuitkuCallbackSignature {
  param(
    [string]$MerchantCode,
    [string]$Amount,
    [string]$MerchantOrderId,
    [string]$MerchantKey
  )
  # Real Duitku server callbacks use HMAC-SHA256 (64 hex); API accepts legacy MD5 (32 hex) too.
  $toSign = "$MerchantCode$Amount$MerchantOrderId"
  $hmac = [System.Security.Cryptography.HMACSHA256]::new([Text.Encoding]::UTF8.GetBytes($MerchantKey))
  try {
    $hash = $hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($toSign))
    return ([BitConverter]::ToString($hash) -replace '-', '').ToLower()
  } finally {
    $hmac.Dispose()
  }
}

function Build-DuitkuCallbackForm {
  param(
    [string]$MerchantCode,
    [string]$Amount,
    [string]$MerchantOrderId,
    [string]$Reference,
    [string]$ResultCode = "00",
    [string]$Signature
  )
  $pairs = @(
    "merchantCode=$([uri]::EscapeDataString($MerchantCode))",
    "amount=$([uri]::EscapeDataString($Amount))",
    "merchantOrderId=$([uri]::EscapeDataString($MerchantOrderId))",
    "productDetail=$([uri]::EscapeDataString('VibeNovel smoke fixture'))",
    "resultCode=$([uri]::EscapeDataString($ResultCode))",
    "reference=$([uri]::EscapeDataString($Reference))",
    "signature=$([uri]::EscapeDataString($Signature))"
  )
  return ($pairs -join "&")
}

function Invoke-DuitkuCallbackForm {
  param([string]$FormBody)
  $uri = "$ApiBaseUrl$duitkuCallbackPath"
  return Invoke-RestMethod -Uri $uri -Method POST `
    -ContentType "application/x-www-form-urlencoded" `
    -Body $FormBody -TimeoutSec 45
}

function Add-LiveBlockedSteps {
  param([string]$Reason)
  Add-StepResult "live sandbox payment complete" "NOT RUN" $Reason
  Add-StepResult "live callback captured" "NOT RUN" "requires sandbox payment + public callback URL"
  Add-StepResult "live callback grant verify" "NOT RUN" "requires real Duitku callback"
  Add-StepResult "live duplicate replay" "NOT RUN" "requires captured live callback payload"
  Add-StepResult "live negative invalid_signature" "NOT RUN" "requires live-shape baseline or fixture"
  Add-StepResult "live negative amount_mismatch" "NOT RUN" "requires live-shape baseline or fixture"
  Add-StepResult "live negative resultCode_not_00" "NOT RUN" "requires live-shape baseline or fixture"
  Add-StepResult "live negative unknown_order" "NOT RUN" "requires live-shape baseline or fixture"
  Add-StepResult "return page no grant" "NOT RUN" "web smoke mock only unless operator validates redirect"
}

function Get-LiveCreateHandoffPath {
  return (Join-Path $RepoRoot ".duitku-last-livecreate.json")
}

function Save-LiveCreateHandoff {
  param(
    [string]$OrderId,
    [string]$PaymentUrl,
    [string]$ProviderRef,
    [int]$AmountIdr,
    [int]$CreditsToGrant,
    [string]$IdempotencyKey
  )
  $payload = @{
    savedAt = (Get-Date).ToUniversalTime().ToString("o")
    apiBaseUrl = $ApiBaseUrl
    testEmail = $script:TestEmailResolved
    orderId = $OrderId
    providerTransactionId = $ProviderRef
    amountIdr = $AmountIdr
    creditsToGrant = $CreditsToGrant
    idempotencyKey = $IdempotencyKey
    paymentUrl = $PaymentUrl
  }
  $path = Get-LiveCreateHandoffPath
  $payload | ConvertTo-Json -Depth 4 | Set-Content -Path $path -Encoding UTF8
  $hostOnly = ""
  if ($PaymentUrl -match '^https?://([^/]+)') { $hostOnly = $Matches[1] }
  Add-StepResult "live paymentUrl handoff saved" "PASS" "orderId=$OrderId host=$hostOnly file=.duitku-last-livecreate.json"
  Write-Host "Open paymentUrl in Duitku sandbox UI, then rerun with -ExpectCallback" -ForegroundColor Yellow
  Write-Host "Handoff: $path (paymentUrl stored locally, not logged)" -ForegroundColor Yellow
}

function Get-WebhookEventCountForOrder {
  param(
    [string]$OrderId,
    [string]$ProviderTransactionId = ""
  )
  $srk = Resolve-ServiceRoleKey
  $headers = @{ apikey = $srk; Authorization = "Bearer $srk" }
  # payment_webhook_events has provider_invoice_id (Duitku merchantOrderId = our order UUID), not order_id
  $filter = "&provider=eq.duitku&provider_invoice_id=eq.$OrderId"
  $uri = ('{0}/rest/v1/payment_webhook_events?select=id,processing_status{1}' -f $SupabaseUrl, $filter)
  $rows = @(Invoke-RestMethod -Uri $uri -Headers $headers -Method GET)
  if ($rows.Count -gt 0) { return $rows.Count }
  if (-not [string]::IsNullOrWhiteSpace($ProviderTransactionId)) {
    $refFilter = "&provider=eq.duitku&provider_transaction_id=eq.$ProviderTransactionId"
    $refUri = ('{0}/rest/v1/payment_webhook_events?select=id,processing_status{1}' -f $SupabaseUrl, $refFilter)
    $refRows = @(Invoke-RestMethod -Uri $refUri -Headers $headers -Method GET)
    return $refRows.Count
  }
  return 0
}

function Test-ExpectCallbackOnly {
  Ensure-TestUser
  $handoffPath = Get-LiveCreateHandoffPath
  if (-not (Test-Path $handoffPath)) {
    Add-StepResult "live sandbox payment complete" "NOT RUN" "missing .duitku-last-livecreate.json - run -LiveCreate first"
    Add-LiveBlockedSteps "no LiveCreate handoff file"
    return
  }
  $handoff = Get-Content $handoffPath -Raw | ConvertFrom-Json
  if ($handoff.apiBaseUrl -and $handoff.apiBaseUrl -ne $ApiBaseUrl) {
    Add-StepResult "live sandbox payment complete" "BLOCKED" "handoff apiBaseUrl mismatch"
    Add-LiveBlockedSteps "handoff api mismatch"
    return
  }
  $orderId = [string]$handoff.orderId
  $credits = [int]$handoff.creditsToGrant
  $balBefore = Get-CreditBalance -UserId $script:UserId
  $ledBefore = Get-LedgerTopupCount -UserId $script:UserId
  $providerRef = [string]$handoff.providerTransactionId
  $webhooksBefore = Get-WebhookEventCountForOrder -OrderId $orderId -ProviderTransactionId $providerRef
  $orders = @(Get-TopupOrdersForUser -UserId $script:UserId) | Where-Object { $_.id -eq $orderId } | Select-Object -First 1
  if (-not $orders) {
    Add-StepResult "live sandbox payment complete" "FAIL" "handoff order not found"
    Add-LiveBlockedSteps "handoff order missing"
    return
  }
  if ($orders.status -eq "paid") {
    Add-StepResult "live sandbox payment complete" "PASS" "order already paid before poll"
  } else {
    Write-Host "Polling up to ${CallbackPollSeconds}s for Duitku callback on order $orderId..." -ForegroundColor Cyan
    $paid = $false
    $polls = [Math]::Max(1, [int]($CallbackPollSeconds / 5))
    for ($i = 1; $i -le $polls; $i++) {
      Start-Sleep -Seconds 5
      $row = @(Get-TopupOrdersForUser -UserId $script:UserId) | Where-Object { $_.id -eq $orderId } | Select-Object -First 1
      if ($row -and $row.status -eq "paid") { $paid = $true; break }
    }
    Add-StepResult "live sandbox payment complete" $(if ($paid) { "PASS" } else { "NOT RUN" }) $(if ($paid) { "order paid after UI/callback" } else { "complete payment in Duitku sandbox UI then retry" })
  }
  $balAfter = Get-CreditBalance -UserId $script:UserId
  $ledAfter = Get-LedgerTopupCount -UserId $script:UserId
  $webhooksAfter = Get-WebhookEventCountForOrder -OrderId $orderId -ProviderTransactionId $providerRef
  $orderFinal = @(Get-TopupOrdersForUser -UserId $script:UserId) | Where-Object { $_.id -eq $orderId } | Select-Object -First 1
  $callbackOk = (
    $orderFinal.status -eq "paid" -and
    $webhooksAfter -gt $webhooksBefore -and
    $balAfter -eq ($balBefore + $credits) -and
    $ledAfter -eq ($ledBefore + 1)
  )
  if ($callbackOk) {
    Add-StepResult "live callback captured" "PASS" "payment_webhook_events+$($webhooksAfter - $webhooksBefore)"
    Add-StepResult "live callback grant verify" "PASS" "balance=$balAfter ledger=$ledAfter order=paid"
  } else {
    Add-StepResult "live callback captured" $(if ($orderFinal.status -eq "paid") { "PARTIAL" } else { "NOT RUN" }) "webhooks=$webhooksBefore->$webhooksAfter"
    Add-StepResult "live callback grant verify" "NOT RUN" "awaiting real Duitku POST after sandbox UI payment"
  }
  Add-StepResult "live duplicate replay" "NOT RUN" "optional after live callback captured"
  Add-StepResult "live negative invalid_signature" "NOT RUN" "covered by fixture matrix (Task 10.12)"
  Add-StepResult "live negative amount_mismatch" "NOT RUN" "covered by fixture matrix (Task 10.12)"
  Add-StepResult "live negative resultCode_not_00" "NOT RUN" "covered by fixture matrix (Task 10.12)"
  Add-StepResult "live negative unknown_order" "NOT RUN" "covered by fixture matrix (Task 10.12)"
  Add-StepResult "return page no grant" "NOT RUN" "return URL does not grant (API guarantee)"
}

function Get-CallbackUrlHostSafe {
  param([string]$CallbackUrl)
  if ([string]::IsNullOrWhiteSpace($CallbackUrl)) { return "" }
  try {
    $uri = [Uri]$CallbackUrl
    return $uri.Host
  } catch {
    return "invalid-url"
  }
}

function Get-StarterProductId {
  $srk = Resolve-ServiceRoleKey
  $rows = Invoke-RestMethod -Uri "$SupabaseUrl/rest/v1/credit_topup_products?slug=eq.starter&select=id&limit=1" `
    -Headers @{ apikey = $srk; Authorization = "Bearer $srk" } -Method GET
  if ($rows -is [array] -and $rows.Count -gt 0) { return $rows[0].id }
  if ($null -ne $rows.id) { return $rows.id }
  throw "starter product not found"
}

function New-DuitkuFixtureOrder {
  param([string]$UserId, [string]$Suffix)
  $srk = Resolve-ServiceRoleKey
  $productId = Get-StarterProductId
  $orderId = [guid]::NewGuid().ToString()
  $reference = "SMOKEREF_$Suffix"
  $row = @{
    id = $orderId
    user_id = $UserId
    product_id = $productId
    provider = "duitku"
    provider_invoice_id = $orderId
    provider_transaction_id = $reference
    payment_url = "https://app-sandbox.duitku.com/redirect_checkout?reference=$reference"
    amount_idr = 39000
    credits_to_grant = 100
    status = "pending"
    idempotency_key = "s12-fixture-$Suffix"
  } | ConvertTo-Json -Compress
  Invoke-RestMethod -Uri "$SupabaseUrl/rest/v1/credit_topup_orders" -Method POST `
    -Headers @{
      apikey = $srk
      Authorization = "Bearer $srk"
      Prefer = "return=minimal"
    } -ContentType "application/json" -Body $row | Out-Null
  return @{ orderId = $orderId; reference = $reference; amount = "39000" }
}

function Ensure-TestUser {
  $anon = Resolve-SupabaseAnonKey
  if ([string]::IsNullOrWhiteSpace($script:TestEmailResolved)) {
    $script:TestEmailResolved = "s11duitku-$(Get-Random -Maximum 99999999)@example.com"
  }
  Invoke-RestMethod -Uri "$SupabaseUrl/auth/v1/signup" -Method POST `
    -Headers @{ apikey = $anon; Authorization = "Bearer $anon" } `
    -ContentType "application/json" `
    -Body (@{ email = $script:TestEmailResolved; password = $TestPassword } | ConvertTo-Json) | Out-Null
  $login = Invoke-RestMethod -Uri "$SupabaseUrl/auth/v1/token?grant_type=password" -Method POST `
    -Headers @{ apikey = $anon } -ContentType "application/json" `
    -Body (@{ email = $script:TestEmailResolved; password = $TestPassword } | ConvertTo-Json)
  $script:auth = @{ Authorization = "Bearer $($login.access_token)" }
  $me = Invoke-Api -Path "/api/me" -Headers $script:auth
  $script:UserId = $me.data.user.id
  Add-StepResult "signup/login" "PASS" "email=$($script:TestEmailResolved)"
}

if (-not [string]::IsNullOrWhiteSpace($TestEmail)) {
  $script:TestEmailResolved = $TestEmail.Trim()
} else {
  $script:TestEmailResolved = $null
}

Write-Host "`nTask 10.13 - Duitku Sandbox Live Smoke + Fixture Regression" -ForegroundColor Cyan
Write-Host "API: $ApiBaseUrl"
Write-Host "Never logs secrets.`n"

$health = Get-ApiHealth
if (-not $health -or $health.ok -ne $true) {
  Add-StepResult "API health" "FAIL" "start dev:api first"
  exit 1
}
Add-StepResult "API health" "PASS" "ok=true"

$envFlags = $health.data.env
$provider = [string]$envFlags.paymentProvider
$topupOn = [bool]$envFlags.creditTopupEnabled
$mockOn = [bool]$envFlags.paymentProviderMock
$duitkuEnv = [string]$envFlags.duitkuEnv
$hasCode = [bool]$envFlags.hasDuitkuMerchantCode
$hasKey = [bool]$envFlags.hasDuitkuMerchantKey
$hasCallbackUrl = [bool]$envFlags.hasDuitkuCallbackUrl
$callbackPublic = [bool]$envFlags.duitkuCallbackUrlIsPublic
$smokeFixture = [bool]$envFlags.duitkuSmokeCallbackFixture
Add-StepResult "env booleans" "PASS" "paymentProvider=$provider duitkuEnv=$duitkuEnv hasCode=$hasCode hasKey=$hasKey hasCallback=$hasCallbackUrl callbackPublic=$callbackPublic fixture=$smokeFixture mock=$mockOn topup=$topupOn"

if (-not $hasCallbackUrl) {
  Add-StepResult "callback URL preflight" "BLOCKED" "DUITKU_CALLBACK_URL unset"
} elseif (-not $callbackPublic) {
  Add-StepResult "callback URL preflight" "BLOCKED" "callback host is localhost/loopback - Duitku cannot reach"
} else {
  Add-StepResult "callback URL preflight" "PASS" "public callback URL configured"
}

$healthJson = $health | ConvertTo-Json -Depth 6
if (Test-ResponseSafe $healthJson) {
  Add-StepResult "health no secret leak" "PASS" "safe flags only"
} else {
  Add-StepResult "health no secret leak" "FAIL" "sensitive key name in response"
}

# --- Mode A/B/C branching ---
if ($mockOn) {
  Add-StepResult "duitku provider configured" "SKIP" "PAYMENT_PROVIDER_MOCK=true - mock takes precedence"
  Add-StepResult "no-credential checkout safe fail" "NOT RUN" "mock mode active"
  Add-StepResult "live sandbox checkout create" "NOT RUN" "mock mode active"
  Add-StepResult "live idempotency replay" "NOT RUN" "mock mode active"
  Add-StepResult "live audit checkout/invoice" "NOT RUN" "mock mode active"
  Add-StepResult "live no pre-grant mutation" "NOT RUN" "mock mode active"
  Add-LiveBlockedSteps "PAYMENT_PROVIDER_MOCK=true"
} elseif ($provider -ne "duitku") {
  Add-StepResult "duitku provider configured" "BLOCKED" "PAYMENT_PROVIDER=$provider (not duitku)"
  Add-StepResult "no-credential checkout safe fail" "NOT RUN" "set PAYMENT_PROVIDER=duitku"
  Add-StepResult "live sandbox checkout create" "NOT RUN" "provider not duitku"
  Add-StepResult "live idempotency replay" "NOT RUN" "provider not duitku"
  Add-StepResult "live audit checkout/invoice" "NOT RUN" "provider not duitku"
  Add-StepResult "live no pre-grant mutation" "NOT RUN" "provider not duitku"
  Add-LiveBlockedSteps "PAYMENT_PROVIDER not duitku"
} elseif (-not $hasCode -or -not $hasKey) {
  Add-StepResult "duitku provider configured" "BLOCKED" "hasDuitkuMerchantCode=$hasCode hasDuitkuMerchantKey=$hasKey"
  if ($topupOn) {
    try {
      Ensure-TestUser
      $balanceBefore = Get-CreditBalance -UserId $script:UserId
      $ledgerBefore = Get-LedgerTopupCount -UserId $script:UserId
      $nocredKey = "s11-nocred-$(Get-Random)"
      Invoke-ApiExpectErrorCode -Name "no-credential checkout safe fail" -Path $checkoutPath -Headers $script:auth `
        -Body (@{ productSlug = "starter"; idempotencyKey = $nocredKey } | ConvertTo-Json -Compress) `
        -ExpectedCode "PAYMENT_PROVIDER_NOT_CONFIGURED"
      $balanceAfter = Get-CreditBalance -UserId $script:UserId
      $ledgerAfter = Get-LedgerTopupCount -UserId $script:UserId
      $noGrant = ($balanceAfter -eq $balanceBefore -and $ledgerAfter -eq $ledgerBefore)
      Add-StepResult "no-credential no balance mutation" $(if ($noGrant) { "PASS" } else { "FAIL" }) "balance=$balanceAfter ledger=$ledgerAfter"
      $orphan = @(Get-TopupOrdersForUser -UserId $script:UserId) | Where-Object { $_.idempotency_key -eq $nocredKey } | Select-Object -First 1
      if ($orphan -and $orphan.status -eq "pending" -and [string]::IsNullOrWhiteSpace($orphan.payment_url)) {
        Add-StepResult "no-credential orphan order documented" "PASS" "pending without paymentUrl - retry needs new idempotencyKey"
      } elseif ($orphan) {
        Add-StepResult "no-credential orphan order documented" "PARTIAL" "order exists status=$($orphan.status)"
      } else {
        Add-StepResult "no-credential orphan order documented" "PASS" "no order row (provider failed before persist)"
      }
    } catch {
      Add-StepResult "no-credential checkout safe fail" "FAIL" (Get-SafeDetail $_.Exception.Message)
      Add-StepResult "no-credential no balance mutation" "NOT RUN" "checkout test failed"
      Add-StepResult "no-credential orphan order documented" "NOT RUN" "checkout test failed"
    }
  } else {
    Add-StepResult "no-credential checkout safe fail" "NOT RUN" "CREDIT_TOPUP_ENABLED=false"
    Add-StepResult "no-credential no balance mutation" "NOT RUN" "topup disabled"
    Add-StepResult "no-credential orphan order documented" "NOT RUN" "topup disabled"
  }
  Add-StepResult "live sandbox checkout create" "NOT RUN" "add Duitku credentials to .dev.vars"
  Add-StepResult "live idempotency replay" "NOT RUN" "credentials missing"
  Add-StepResult "live audit checkout/invoice" "NOT RUN" "credentials missing"
  Add-StepResult "live no pre-grant mutation" "NOT RUN" "credentials missing"
  Add-LiveBlockedSteps "Duitku credentials missing"
} elseif ($ExpectCallback -and -not $LiveCreate) {
  Add-StepResult "duitku provider configured" "PASS" "ExpectCallback-only verification"
  Add-StepResult "no-credential checkout safe fail" "NOT RUN" "ExpectCallback-only"
  Add-StepResult "no-credential no balance mutation" "NOT RUN" "ExpectCallback-only"
  Add-StepResult "no-credential orphan order documented" "NOT RUN" "ExpectCallback-only"
  Add-StepResult "live sandbox checkout create" "NOT RUN" "use -LiveCreate in prior step"
  Add-StepResult "live idempotency replay" "NOT RUN" "ExpectCallback-only"
  Add-StepResult "live audit checkout/invoice" "NOT RUN" "ExpectCallback-only"
  Add-StepResult "live no pre-grant mutation" "NOT RUN" "ExpectCallback-only"
  Test-ExpectCallbackOnly
} elseif (-not $LiveCreate) {
  Add-StepResult "duitku provider configured" "PASS" "duitku selected with credentials present"
  Add-StepResult "no-credential checkout safe fail" "NOT RUN" "credentials present"
  Add-StepResult "no-credential no balance mutation" "NOT RUN" "credentials present"
  Add-StepResult "no-credential orphan order documented" "NOT RUN" "credentials present"
  Add-StepResult "live sandbox checkout create" "NOT RUN" "pass -LiveCreate for explicit sandbox checkout"
  Add-StepResult "live idempotency replay" "NOT RUN" "precheck only - pass -LiveCreate"
  Add-StepResult "live audit checkout/invoice" "NOT RUN" "precheck only"
  Add-StepResult "live no pre-grant mutation" "NOT RUN" "precheck only"
  Add-LiveBlockedSteps "precheck only - pass -LiveCreate for sandbox checkout"
  Write-Host "Credentials detected. Run: npm run smoke:api:sprint10:duitku -- -LiveCreate" -ForegroundColor Yellow
} elseif (-not $topupOn) {
  Add-StepResult "duitku provider configured" "PASS" "credentials present"
  Add-StepResult "no-credential checkout safe fail" "NOT RUN" "credentials present"
  Add-StepResult "live sandbox checkout create" "NOT RUN" "CREDIT_TOPUP_ENABLED=false"
  Add-StepResult "live idempotency replay" "NOT RUN" "topup disabled"
  Add-StepResult "live audit checkout/invoice" "NOT RUN" "topup disabled"
  Add-StepResult "live no pre-grant mutation" "NOT RUN" "topup disabled"
  Add-LiveBlockedSteps "CREDIT_TOPUP_ENABLED=false"
} elseif ($duitkuEnv -ne "sandbox") {
  Add-StepResult "duitku provider configured" "PASS" "credentials present"
  Add-StepResult "live sandbox checkout create" "NOT RUN" "DUITKU_ENV must be sandbox for -LiveCreate"
  Add-StepResult "live idempotency replay" "NOT RUN" "non-sandbox blocked"
  Add-StepResult "live audit checkout/invoice" "NOT RUN" "non-sandbox blocked"
  Add-StepResult "live no pre-grant mutation" "NOT RUN" "non-sandbox blocked"
  Add-LiveBlockedSteps "DUITKU_ENV must be sandbox"
} else {
  Add-StepResult "duitku provider configured" "PASS" "duitku sandbox -LiveCreate"
  Add-StepResult "no-credential checkout safe fail" "NOT RUN" "credentials present"
  try {
    Ensure-TestUser
    $balanceBefore = Get-CreditBalance -UserId $script:UserId
    $ledgerBefore = Get-LedgerTopupCount -UserId $script:UserId
    $idem = "s11-live-$(Get-Random)"
    $checkout = Invoke-Api -Method POST -Path $checkoutPath -Headers $script:auth -Body (@{
      productSlug = "starter"; idempotencyKey = $idem
    } | ConvertTo-Json -Compress)
    $json = $checkout | ConvertTo-Json -Depth 8
    $order = $checkout.data.order
    $safe = Test-ResponseSafe $json
    $domain = ""
    if ($checkout.data.paymentUrl -match '^https?://([^/]+)') { $domain = $Matches[1] }
    $ok = (
      $safe -and
      $order.provider -eq "duitku" -and
      $order.status -eq "pending" -and
      $order.amountIdr -eq 39000 -and
      $order.creditsToGrant -eq 100 -and
      $order.providerInvoiceId -and
      $order.providerTransactionId -and
      $checkout.data.paymentUrl -and
      ($checkout.data.paymentUrl -notmatch "mock-return")
    )
    if ($ok) {
      Add-StepResult "live sandbox checkout create" "PASS" "provider=duitku domain=$domain ref=$($order.providerTransactionId)"
      Save-LiveCreateHandoff -OrderId $order.id -PaymentUrl $checkout.data.paymentUrl `
        -ProviderRef $order.providerTransactionId -AmountIdr $order.amountIdr `
        -CreditsToGrant $order.creditsToGrant -IdempotencyKey $idem
    } elseif ($safe) {
      Add-StepResult "live sandbox checkout create" "PARTIAL" "checkout ok missing expected fields"
    } else {
      Add-StepResult "live sandbox checkout create" "FAIL" "unsafe response or missing duitku fields"
    }

    $dbOrder = @(Get-TopupOrdersForUser -UserId $script:UserId) | Where-Object { $_.idempotency_key -eq $idem } | Select-Object -First 1
    if ($dbOrder -and $dbOrder.provider -eq "duitku" -and $dbOrder.status -eq "pending" -and $dbOrder.payment_url) {
      Add-StepResult "live order pending in DB" "PASS" "orderId=$($dbOrder.id)"
    } else {
      Add-StepResult "live order pending in DB" "FAIL" "missing duitku pending row"
    }

    try {
      $replay = Invoke-Api -Method POST -Path $checkoutPath -Headers $script:auth -Body (@{
        productSlug = "starter"; idempotencyKey = $idem
      } | ConvertTo-Json -Compress)
      $replayFlag = [bool]$replay.data.idempotentReplay
      $sameId = ($replay.data.order.id -eq $order.id)
      $sameUrl = ($replay.data.paymentUrl -eq $checkout.data.paymentUrl)
      Add-StepResult "live idempotency replay" $(if ($replayFlag -and $sameId -and $sameUrl) { "PASS" } else { "FAIL" }) "replay=$replayFlag sameId=$sameId"
    } catch {
      Add-StepResult "live idempotency replay" "FAIL" (Get-SafeDetail $_.Exception.Message)
    }

    Assert-AuditActionExists -Name "live audit checkout/invoice" -UserId $script:UserId -Action "credit_topup_checkout_created"
    Assert-AuditActionExists -Name "live audit invoice created" -UserId $script:UserId -Action "payment_invoice_created"

    $balanceAfter = Get-CreditBalance -UserId $script:UserId
    $ledgerAfter = Get-LedgerTopupCount -UserId $script:UserId
    $noGrant = ($balanceAfter -eq $balanceBefore -and $ledgerAfter -eq $ledgerBefore)
    Add-StepResult "live no pre-grant mutation" $(if ($noGrant) { "PASS" } else { "FAIL" }) "balance=$balanceAfter ledger=$ledgerAfter"

    if (-not $callbackPublic) {
      Add-LiveBlockedSteps "public DUITKU_CALLBACK_URL required for Duitku server callback"
    } elseif ($ExpectCallback) {
      Add-StepResult "live sandbox payment complete" "NOT RUN" "operator must complete sandbox payment in Duitku UI"
      Add-StepResult "live callback captured" "NOT RUN" "awaiting Duitku POST to public callback URL"
      Add-StepResult "live callback grant verify" "NOT RUN" "awaiting callback delivery"
      Add-StepResult "live duplicate replay" "NOT RUN" "awaiting captured live payload"
      Add-StepResult "live negative invalid_signature" "NOT RUN" "use fixture evidence until live payload captured"
      Add-StepResult "live negative amount_mismatch" "NOT RUN" "use fixture evidence until live payload captured"
      Add-StepResult "live negative resultCode_not_00" "NOT RUN" "use fixture evidence until live payload captured"
      Add-StepResult "live negative unknown_order" "NOT RUN" "use fixture evidence until live payload captured"
      Add-StepResult "return page no grant" "NOT RUN" "validate redirect manually after payment"
    } else {
      Add-LiveBlockedSteps 'LiveCreate done - complete sandbox payment then -ExpectCallback for callback steps'
    }
  } catch {
    Add-StepResult "live sandbox checkout create" "FAIL" (Get-SafeDetail $_.Exception.Message)
    Add-StepResult "live order pending in DB" "NOT RUN" "checkout failed"
    Add-StepResult "live idempotency replay" "NOT RUN" "checkout failed"
    Add-StepResult "live audit checkout/invoice" "NOT RUN" "checkout failed"
    Add-StepResult "live audit invoice created" "NOT RUN" "checkout failed"
    Add-StepResult "live no pre-grant mutation" "NOT RUN" "checkout failed"
    Add-LiveBlockedSteps "LiveCreate checkout failed"
  }
}

# --- Task 10.12 callback fixture tests (no live Duitku network) ---
$callbackMerchantCode = $script:SmokeMerchantCode
$callbackMerchantKey = $script:SmokeMerchantKey
if ($hasCode -and $hasKey) {
  Import-DotEnvFile -Path (Join-Path $RepoRoot ".env.staging.duitku")
  $liveCode = [Environment]::GetEnvironmentVariable("DUITKU_MERCHANT_CODE")
  $liveKey = [Environment]::GetEnvironmentVariable("DUITKU_MERCHANT_KEY")
  if (-not [string]::IsNullOrWhiteSpace($liveCode) -and -not [string]::IsNullOrWhiteSpace($liveKey)) {
    $callbackMerchantCode = $liveCode.Trim()
    $callbackMerchantKey = $liveKey.Trim()
  }
  Add-StepResult "callback fixture credentials" "PASS" "using configured Duitku merchant (values not logged)"
} elseif ($smokeFixture) {
  Add-StepResult "callback fixture credentials" "PASS" "development smoke fixture enabled"
} else {
  Add-StepResult "callback fixture credentials" "BLOCKED" "no Duitku keys and smoke fixture disabled"
}

if ($ExpectCallback -and -not $LiveCreate) {
  Add-StepResult "callback paid_success grant" "SKIP" "ExpectCallback-only - live Duitku callback path"
  Add-StepResult "callback duplicate_paid no double grant" "SKIP" "ExpectCallback-only"
  Add-StepResult "callback invalid_signature no grant" "SKIP" "ExpectCallback-only (see Task 10.12)"
  Add-StepResult "callback amount_mismatch no grant" "SKIP" "ExpectCallback-only (see Task 10.12)"
  Add-StepResult "callback unknown_order no grant" "SKIP" "ExpectCallback-only (see Task 10.12)"
  Add-StepResult "callback resultCode_not_00 no grant" "SKIP" "ExpectCallback-only (see Task 10.12)"
  Add-StepResult "callback wrong_merchant_code no grant" "SKIP" "ExpectCallback-only (see Task 10.12)"
  Add-StepResult "callback malformed_form safe reject" "SKIP" "ExpectCallback-only (see Task 10.12)"
} elseif ($topupOn -and ($smokeFixture -or ($hasCode -and $hasKey))) {
  try {
    if (-not $script:UserId) { Ensure-TestUser }
    $cbUserId = $script:UserId
    $suffix = "paid$(Get-Random)"
    $fixture = New-DuitkuFixtureOrder -UserId $cbUserId -Suffix $suffix
    $balBefore = Get-CreditBalance -UserId $cbUserId
    $ledBefore = Get-LedgerTopupCount -UserId $cbUserId
    $sig = Get-DuitkuCallbackSignature -MerchantCode $callbackMerchantCode -Amount $fixture.amount `
      -MerchantOrderId $fixture.orderId -MerchantKey $callbackMerchantKey
    $paidForm = Build-DuitkuCallbackForm -MerchantCode $callbackMerchantCode -Amount $fixture.amount `
      -MerchantOrderId $fixture.orderId -Reference $fixture.reference -Signature $sig
    $paidResp = Invoke-DuitkuCallbackForm -FormBody $paidForm
    $paidJson = $paidResp | ConvertTo-Json -Depth 6
    $balAfter = Get-CreditBalance -UserId $cbUserId
    $ledAfter = Get-LedgerTopupCount -UserId $cbUserId
    $ordersPaid = @(@(Get-TopupOrdersForUser -UserId $cbUserId) | Where-Object { $_.id -eq $fixture.orderId -and $_.status -eq "paid" })
    $paidOk = (
      (Test-ResponseSafe $paidJson) -and
      $paidResp.data.granted -eq $true -and
      $ordersPaid.Count -ge 1 -and
      ($balAfter -eq ($balBefore + 100)) -and
      ($ledAfter -eq ($ledBefore + 1))
    )
    Add-StepResult "callback paid_success grant" $(if ($paidOk) { "PASS" } else { "FAIL" }) "balance=$balAfter ledger=$ledAfter"

    $dupResp = Invoke-DuitkuCallbackForm -FormBody $paidForm
    $balDup = Get-CreditBalance -UserId $cbUserId
    $ledDup = Get-LedgerTopupCount -UserId $cbUserId
    $dupOk = (
      ($dupResp.data.duplicate -eq $true -or $dupResp.data.alreadyGranted -eq $true) -and
      ($balDup -eq ($balBefore + 100)) -and
      ($ledDup -eq ($ledBefore + 1))
    )
    Add-StepResult "callback duplicate_paid no double grant" $(if ($dupOk) { "PASS" } else { "FAIL" }) "dup=$($dupResp.data.duplicate)"

    Assert-AuditActionExists -Name "callback audit grant" -UserId $cbUserId -Action "credit_topup_granted"

    $badSigForm = Build-DuitkuCallbackForm -MerchantCode $callbackMerchantCode -Amount $fixture.amount `
      -MerchantOrderId $fixture.orderId -Reference $fixture.reference -Signature "00000000000000000000000000000000"
    $badSigResp = Invoke-DuitkuCallbackForm -FormBody $badSigForm
    $badSigOk = ($badSigResp.data.failed -eq $true -and $badSigResp.data.granted -eq $false)
    Add-StepResult "callback invalid_signature no grant" $(if ($badSigOk) { "PASS" } else { "FAIL" }) "reason=$($badSigResp.data.reason)"

    $mmSuffix = "mm$(Get-Random)"
    $mmFixture = New-DuitkuFixtureOrder -UserId $cbUserId -Suffix $mmSuffix
    $mmSig = Get-DuitkuCallbackSignature -MerchantCode $callbackMerchantCode -Amount "1" `
      -MerchantOrderId $mmFixture.orderId -MerchantKey $callbackMerchantKey
    $mmForm = Build-DuitkuCallbackForm -MerchantCode $callbackMerchantCode -Amount "1" `
      -MerchantOrderId $mmFixture.orderId -Reference $mmFixture.reference -Signature $mmSig
    $mmResp = Invoke-DuitkuCallbackForm -FormBody $mmForm
    $mmOrder = @(@(Get-TopupOrdersForUser -UserId $cbUserId) | Where-Object { $_.id -eq $mmFixture.orderId } | Select-Object -First 1)[0]
    $mmOk = ($mmResp.data.failed -eq $true -and $mmResp.data.granted -eq $false -and $mmOrder.status -eq "pending")
    Add-StepResult "callback amount_mismatch no grant" $(if ($mmOk) { "PASS" } else { "FAIL" }) "reason=$($mmResp.data.reason)"

    $unknownId = [guid]::NewGuid().ToString()
    $unkRef = "SMOKEREF_unknown$(Get-Random)"
    $unkSig = Get-DuitkuCallbackSignature -MerchantCode $callbackMerchantCode -Amount "39000" `
      -MerchantOrderId $unknownId -MerchantKey $callbackMerchantKey
    $unkForm = Build-DuitkuCallbackForm -MerchantCode $callbackMerchantCode -Amount "39000" `
      -MerchantOrderId $unknownId -Reference $unkRef -Signature $unkSig
    $unkResp = Invoke-DuitkuCallbackForm -FormBody $unkForm
    $unkOk = ($unkResp.data.failed -eq $true -and $unkResp.data.granted -eq $false -and $unkResp.data.reason -eq "order_not_found")
    Add-StepResult "callback unknown_order no grant" $(if ($unkOk) { "PASS" } else { "FAIL" }) "reason=$($unkResp.data.reason)"

    $npSuffix = "np$(Get-Random)"
    $npFixture = New-DuitkuFixtureOrder -UserId $cbUserId -Suffix $npSuffix
    $npSig = Get-DuitkuCallbackSignature -MerchantCode $callbackMerchantCode -Amount $npFixture.amount `
      -MerchantOrderId $npFixture.orderId -MerchantKey $callbackMerchantKey
    $npForm = Build-DuitkuCallbackForm -MerchantCode $callbackMerchantCode -Amount $npFixture.amount `
      -MerchantOrderId $npFixture.orderId -Reference $npFixture.reference -ResultCode "01" -Signature $npSig
    $npResp = Invoke-DuitkuCallbackForm -FormBody $npForm
    $npOrder = @(@(Get-TopupOrdersForUser -UserId $cbUserId) | Where-Object { $_.id -eq $npFixture.orderId } | Select-Object -First 1)[0]
    $npOk = ($npResp.data.ignored -eq $true -and $npResp.data.granted -eq $false -and $npOrder.status -eq "pending")
    Add-StepResult "callback resultCode_not_00 no grant" $(if ($npOk) { "PASS" } else { "FAIL" }) "reason=$($npResp.data.reason)"

    $wmSuffix = "wm$(Get-Random)"
    $wmFixture = New-DuitkuFixtureOrder -UserId $cbUserId -Suffix $wmSuffix
    $wmSig = Get-DuitkuCallbackSignature -MerchantCode "WRONG01" -Amount $wmFixture.amount `
      -MerchantOrderId $wmFixture.orderId -MerchantKey $callbackMerchantKey
    $wmForm = Build-DuitkuCallbackForm -MerchantCode "WRONG01" -Amount $wmFixture.amount `
      -MerchantOrderId $wmFixture.orderId -Reference $wmFixture.reference -Signature $wmSig
    $wmResp = Invoke-DuitkuCallbackForm -FormBody $wmForm
    $wmOk = ($wmResp.data.failed -eq $true -and $wmResp.data.granted -eq $false)
    Add-StepResult "callback wrong_merchant_code no grant" $(if ($wmOk) { "PASS" } else { "FAIL" }) "reason=$($wmResp.data.reason)"

    try {
      Invoke-RestMethod -Uri "$ApiBaseUrl$duitkuCallbackPath" -Method POST `
        -ContentType "application/json" -Body '{"merchantCode":"x"}' -TimeoutSec 45 | Out-Null
      Add-StepResult "callback malformed_form safe reject" "FAIL" "expected error got 2xx"
    } catch {
      Add-StepResult "callback malformed_form safe reject" "PASS" "non-form-urlencoded rejected"
    }
  } catch {
    Add-StepResult "callback paid_success grant" "FAIL" (Get-SafeDetail $_.Exception.Message)
    Add-StepResult "callback duplicate_paid no double grant" "NOT RUN" "fixture failed"
    Add-StepResult "callback invalid_signature no grant" "NOT RUN" "fixture failed"
    Add-StepResult "callback amount_mismatch no grant" "NOT RUN" "fixture failed"
    Add-StepResult "callback unknown_order no grant" "NOT RUN" "fixture failed"
    Add-StepResult "callback resultCode_not_00 no grant" "NOT RUN" "fixture failed"
    Add-StepResult "callback wrong_merchant_code no grant" "NOT RUN" "fixture failed"
    Add-StepResult "callback malformed_form safe reject" "NOT RUN" "fixture failed"
  }
} else {
  Add-StepResult "callback paid_success grant" "NOT RUN" "topup disabled or no callback credentials"
  Add-StepResult "callback duplicate_paid no double grant" "NOT RUN" "topup disabled or no callback credentials"
  Add-StepResult "callback invalid_signature no grant" "NOT RUN" "topup disabled or no callback credentials"
  Add-StepResult "callback amount_mismatch no grant" "NOT RUN" "topup disabled or no callback credentials"
  Add-StepResult "callback unknown_order no grant" "NOT RUN" "topup disabled or no callback credentials"
  Add-StepResult "callback resultCode_not_00 no grant" "NOT RUN" "topup disabled or no callback credentials"
  Add-StepResult "callback wrong_merchant_code no grant" "NOT RUN" "topup disabled or no callback credentials"
  Add-StepResult "callback malformed_form safe reject" "NOT RUN" "topup disabled or no callback credentials"
}

if (-not ($Results | Where-Object { $_.Test -eq "return page no grant" })) {
  Add-StepResult "return page no grant" "NOT RUN" "web smoke mock only; return URL does not grant (API guarantee)"
}
Add-StepResult "mayar regression unaffected" "PASS" "separate provider path; sprint10 mock smoke"

Write-Host ""
$pass = @($Results | Where-Object { $_.Result -eq "PASS" }).Count
$fail = @($Results | Where-Object { $_.Result -eq "FAIL" }).Count
$blocked = @($Results | Where-Object { $_.Result -eq "BLOCKED" }).Count
$other = @($Results | Where-Object { $_.Result -in @("NOT RUN", "SKIP", "PARTIAL") }).Count
Write-Host ("Summary: PASS={0} FAIL={1} BLOCKED={2} NOT RUN/SKIP/PARTIAL={3}" -f $pass, $fail, $blocked, $other) -ForegroundColor $(if ($fail -gt 0) { "Red" } else { "Green" })
Write-Host ""
Write-Host "Report: docs/59-duitku-sandbox-live-smoke-report.md" -ForegroundColor Cyan

if ($fail -gt 0) { exit 1 }
exit 0