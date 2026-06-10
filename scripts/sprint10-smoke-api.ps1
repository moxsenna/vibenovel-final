<#
.SYNOPSIS
  Sprint 10 Payment Topup API smoke — checkout shell (10.2) + webhook grant (10.3).

.DESCRIPTION
  Run from repo root:
    powershell -ExecutionPolicy Bypass -File scripts/sprint10-smoke-api.ps1

  Prerequisites:
    - supabase start && supabase db reset
    - npm run dev:api
    - apps/api/.dev.vars (gitignored)

  Baseline (always runs):
    - CREDIT_TOPUP_ENABLED=false default → 503 TOPUP_DISABLED on checkout
    - GET products still readable (auth required)
    - no token → 401

  Mock success / fail_provider require restart dev:api with:
    CREDIT_TOPUP_ENABLED=true
    PAYMENT_PROVIDER_MOCK=true
    PAYMENT_PROVIDER_MOCK_MODE=success   # or fail_provider | invalid_response

  Example mock success run:
    npm run smoke:api:sprint10 -- -MockMode success

  Security: does not print JWT, service role keys, or Mayar API keys.
#>
[CmdletBinding()]
param(
  [string]$ApiBaseUrl = "http://127.0.0.1:8787",
  [string]$SupabaseUrl = "http://127.0.0.1:54321",
  [string]$SupabaseAnonKey = "",
  [ValidateSet("auto", "success", "fail_provider", "invalid_response", "skip_mock")]
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
  $sanitized = $sanitized -replace 'MAYAR_API_KEY', '[mayar-key-redacted]'
  if ($sanitized.Length -gt 120) { return $sanitized.Substring(0, 117) + "..." }
  return $sanitized
}

function Wait-ApiReady {
  param([int]$TimeoutSec = 90, [int]$IntervalSec = 2)
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    try {
      $health = Invoke-RestMethod -Uri "$ApiBaseUrl/api/health" -Method GET -TimeoutSec 5 -ErrorAction Stop
      if ($health.ok -eq $true -and $null -ne $health.data) { return $health }
    } catch { }
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

function Test-TopupResponseSafe {
  param([string]$JsonText)
  $forbidden = @(
    'MAYAR_API_KEY', 'mayar_api_key', 'api_key', 'apiKey', 'authorization',
    'provider_payload_safe', 'providerPayloadSafe', 'service_role', 'OPENROUTER_API_KEY'
  )
  foreach ($f in $forbidden) {
    if ($JsonText -match $f) { return $false }
  }
  return $true
}

function Get-TopupOrdersForUser {
  param([string]$UserId)
  $srk = Resolve-ServiceRoleKey
  $headers = @{ apikey = $srk; Authorization = "Bearer $srk" }
  $uri = ('{0}/rest/v1/credit_topup_orders?user_id=eq.{1}&select=id,status,amount_idr,credits_to_grant,provider_invoice_id,provider_transaction_id,payment_url,idempotency_key&order=created_at.desc' -f $SupabaseUrl, $UserId)
  return @(Invoke-RestMethod -Uri $uri -Method GET -Headers $headers -ErrorAction Stop)
}

function Get-CreditBalanceRow {
  param([string]$UserId)
  $srk = Resolve-ServiceRoleKey
  $headers = @{ apikey = $srk; Authorization = "Bearer $srk" }
  $uri = ('{0}/rest/v1/credit_balances?user_id=eq.{1}&select=balance&limit=1' -f $SupabaseUrl, $UserId)
  $rows = @(Invoke-RestMethod -Uri $uri -Method GET -Headers $headers -ErrorAction Stop)
  if ($rows.Count -lt 1) { return $null }
  return $rows[0]
}

function Get-RestRowCount {
  param($Raw)
  if ($null -eq $Raw) { return 0 }
  if ($Raw -is [System.Array]) { return $Raw.Count }
  if ($Raw.PSObject.Properties.Name -contains "id") { return 1 }
  return 0
}

function Get-CreditLedgerTopupCount {
  param([string]$UserId)
  $srk = Resolve-ServiceRoleKey
  $headers = @{ apikey = $srk; Authorization = "Bearer $srk" }
  $uri = ('{0}/rest/v1/credit_ledger?user_id=eq.{1}&reason=eq.credit_topup&select=id' -f $SupabaseUrl, $UserId)
  $raw = Invoke-RestMethod -Uri $uri -Method GET -Headers $headers -ErrorAction Stop
  return Get-RestRowCount $raw
}

function Get-AuditLogsByAction {
  param([string]$UserId, [string]$Action)
  $srk = Resolve-ServiceRoleKey
  $headers = @{ apikey = $srk; Authorization = "Bearer $srk" }
  $uri = ('{0}/rest/v1/audit_logs?user_id=eq.{1}&action=eq.{2}&select=action,entity_type,entity_id,metadata,before_data,after_data&order=created_at.desc&limit=20' -f $SupabaseUrl, $UserId, $Action)
  return @(Invoke-RestMethod -Uri $uri -Method GET -Headers $headers -ErrorAction Stop)
}

function Assert-AuditActionExists {
  param([string]$Name, [string]$UserId, [string]$Action)
  try {
    $rows = Get-AuditLogsByAction -UserId $UserId -Action $Action
    if ($rows.Count -lt 1) {
      Add-StepResult $Name "FAIL" "no audit row for $Action"
      return
    }
    $json = ($rows | ConvertTo-Json -Depth 12)
    $safe = Test-TopupResponseSafe $json
    Add-StepResult $Name $(if ($safe) { "PASS" } else { "FAIL" }) "count=$($rows.Count)"
  } catch {
    Add-StepResult $Name "FAIL" $_.Exception.Message.Substring(0, [Math]::Min(80, $_.Exception.Message.Length))
  }
}

function New-MockPaymentReceivedBody {
  param(
    [string]$OrderId,
    [string]$InvoiceId,
    [string]$TransactionId,
    [int]$Amount = 39000,
    [string]$Event = "payment.received",
    [object]$Status = "paid",
    [string]$EventId = "mock_evt_$(Get-Random)",
    [string]$App = "vibenovel",
    [string]$Flow = "credit_topup",
    [hashtable]$ExtraData = @{}
  )
  $extra = @{
    orderId = $OrderId
    productSlug = "starter"
  }
  if (-not [string]::IsNullOrWhiteSpace($App)) { $extra.app = $App }
  if (-not [string]::IsNullOrWhiteSpace($Flow)) { $extra.flow = $Flow }
  foreach ($key in $ExtraData.Keys) { $extra[$key] = $ExtraData[$key] }
  return (@{
    event = $Event
    id = $EventId
    data = @{
      id = "mock_webhook_data_$(Get-Random)"
      invoiceId = $InvoiceId
      transactionId = $TransactionId
      amount = $Amount
      status = $Status
      extraData = $extra
    }
  } | ConvertTo-Json -Compress -Depth 6)
}

function Get-WebhookEventsCount {
  param([string]$ProcessingStatus = "")
  $srk = Resolve-ServiceRoleKey
  $headers = @{ apikey = $srk; Authorization = "Bearer $srk" }
  $filter = ""
  if (-not [string]::IsNullOrWhiteSpace($ProcessingStatus)) {
    $filter = "&processing_status=eq.$ProcessingStatus"
  }
  $uri = ('{0}/rest/v1/payment_webhook_events?select=id{1}' -f $SupabaseUrl, $filter)
  $rows = @(Invoke-RestMethod -Uri $uri -Method GET -Headers $headers -ErrorAction Stop)
  return $rows.Count
}

Write-Host "`nVibeNovel Sprint 10 Payment Topup API Smoke Test" -ForegroundColor Cyan

$anonKey = Resolve-SupabaseAnonKey
if ([string]::IsNullOrWhiteSpace($TestEmail)) {
  $TestEmail = "s10smoke-$(Get-Random -Maximum 99999999)@example.com"
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
  exit 1
}

$topupEnabled = [bool]$health.data.env.creditTopupEnabled
$paymentMock = [bool]$health.data.env.paymentProviderMock
Add-StepResult "health topup flags" "PASS" "enabled=$topupEnabled mock=$paymentMock"

$ordersBefore = @(Get-TopupOrdersForUser -UserId $script:UserId)
$balanceBefore = Get-CreditBalanceRow -UserId $script:UserId
$ledgerTopupBefore = Get-CreditLedgerTopupCount -UserId $script:UserId

$checkoutPath = "/api/credits/topup/checkout"
$webhookPath = "/api/payments/mayar/webhook"
$checkoutBody = (@{ productSlug = "starter"; idempotencyKey = "s10-base-$(Get-Random)" } | ConvertTo-Json -Compress)
$webhookDisabledBody = '{"event":"payment.received","data":{"status":true,"amount":39000}}'

Invoke-ApiExpectFailure -Name "POST checkout no token" -Method POST -Path $checkoutPath -Body $checkoutBody

try {
  $products = Invoke-Api -Path "/api/credits/topup/products" -Headers $auth
  $count = if ($products.data.products) { $products.data.products.Count } else { 0 }
  $safe = Test-TopupResponseSafe ($products | ConvertTo-Json -Depth 8)
  Add-StepResult "GET topup products" $(if ($count -eq 4 -and $safe) { "PASS" } else { "FAIL" }) "count=$count"
} catch {
  Add-StepResult "GET topup products" "FAIL" (Get-SafeDetail $_.Exception.Message)
}

if (-not $topupEnabled) {
  Invoke-ApiExpectErrorCode -Name "checkout TOPUP_DISABLED" -Method POST -Path $checkoutPath -Headers $auth -Body $checkoutBody -ExpectedCode "TOPUP_DISABLED"
  Invoke-ApiExpectErrorCode -Name "webhook TOPUP_DISABLED" -Method POST -Path $webhookPath -Body $webhookDisabledBody -ExpectedCode "TOPUP_DISABLED"
  $ordersAfterDisabled = @(Get-TopupOrdersForUser -UserId $script:UserId)
  if ($ordersAfterDisabled.Count -eq $ordersBefore.Count) {
    Add-StepResult "disabled no order created" "PASS" "count=$($ordersAfterDisabled.Count)"
  } else {
    Add-StepResult "disabled no order created" "FAIL" "before=$($ordersBefore.Count) after=$($ordersAfterDisabled.Count)"
  }
} else {
  Add-StepResult "checkout TOPUP_DISABLED" "SKIP" "CREDIT_TOPUP_ENABLED=true on server"
  Add-StepResult "disabled no order created" "SKIP" "topup enabled"
}

$resolvedMockMode = $MockMode
if ($MockMode -eq "auto") {
  if ($topupEnabled -and $paymentMock) { $resolvedMockMode = "success" } else { $resolvedMockMode = "skip_mock" }
}

if ($resolvedMockMode -eq "skip_mock" -or -not $topupEnabled -or -not $paymentMock) {
  Add-StepResult "mock checkout success" "NOT RUN" "set CREDIT_TOPUP_ENABLED=true PAYMENT_PROVIDER_MOCK=true and restart dev:api"
  Add-StepResult "forbidden client price rejected" "NOT RUN" "requires topup enabled"
  Add-StepResult "idempotency replay" "NOT RUN" "requires topup enabled"
  Add-StepResult "no balance mutation" "NOT RUN" "requires topup enabled"
  Add-StepResult "no ledger credit_topup row" "NOT RUN" "requires topup enabled"
  Add-StepResult "audit checkout created" "NOT RUN" "requires topup enabled"
  Add-StepResult "audit invoice created" "NOT RUN" "requires topup enabled"
  Add-StepResult "mock fail_provider checkout" "NOT RUN" "set PAYMENT_PROVIDER_MOCK_MODE=fail_provider + restart"
  Add-StepResult "webhook grant credits" "NOT RUN" "requires topup enabled"
  Add-StepResult "webhook duplicate no double grant" "NOT RUN" "requires topup enabled"
  Add-StepResult "webhook unknown order no grant" "NOT RUN" "requires topup enabled"
  Add-StepResult "webhook amount mismatch no grant" "NOT RUN" "requires topup enabled"
  Add-StepResult "webhook non-paid ignored" "NOT RUN" "requires topup enabled"
  Add-StepResult "webhook foreign app ignored" "NOT RUN" "requires topup enabled"
  Add-StepResult "webhook legacy siklusio ignored" "NOT RUN" "requires topup enabled"
} elseif ($resolvedMockMode -eq "fail_provider") {
  $failKey = "s10-fail-$(Get-Random)"
  $failBody = (@{ productSlug = "creator"; idempotencyKey = $failKey } | ConvertTo-Json -Compress)
  Invoke-ApiExpectErrorCode -Name "mock fail_provider checkout" -Method POST -Path $checkoutPath -Headers $auth -Body $failBody -ExpectedCode "PAYMENT_PROVIDER_ERROR"
  $failOrders = @(Get-TopupOrdersForUser -UserId $script:UserId)
  $failOrder = $failOrders | Where-Object { $_.idempotency_key -eq $failKey } | Select-Object -First 1
  if ($failOrder -and $failOrder.status -eq "pending" -and [string]::IsNullOrWhiteSpace($failOrder.payment_url)) {
    Add-StepResult "fail_provider pending no paymentUrl" "PASS" "orderId=$($failOrder.id)"
  } else {
    Add-StepResult "fail_provider pending no paymentUrl" "FAIL" "unexpected order state"
  }
  Add-StepResult "mock checkout success" "SKIP" "fail_provider mode active"
  Add-StepResult "forbidden client price rejected" "SKIP" "fail_provider mode active"
  Add-StepResult "idempotency replay" "SKIP" "fail_provider mode active"
  Add-StepResult "order pending in DB" "SKIP" "fail_provider mode active"
  Add-StepResult "no balance mutation" "SKIP" "fail_provider mode active"
  Add-StepResult "no ledger credit_topup row" "SKIP" "fail_provider mode active"
  Add-StepResult "audit checkout created" "SKIP" "fail_provider mode active"
  Add-StepResult "audit invoice created" "SKIP" "fail_provider mode active"
  Add-StepResult "webhook grant credits" "SKIP" "fail_provider mode active"
  Add-StepResult "webhook duplicate no double grant" "SKIP" "fail_provider mode active"
  Add-StepResult "webhook unknown order no grant" "SKIP" "fail_provider mode active"
  Add-StepResult "webhook amount mismatch no grant" "SKIP" "fail_provider mode active"
  Add-StepResult "webhook non-paid ignored" "SKIP" "fail_provider mode active"
  Add-StepResult "webhook foreign app ignored" "SKIP" "fail_provider mode active"
  Add-StepResult "webhook legacy siklusio ignored" "SKIP" "fail_provider mode active"
} else {
  $idemKey = "s10-mock-$(Get-Random)"
  $mockBody = (@{ productSlug = "starter"; idempotencyKey = $idemKey } | ConvertTo-Json -Compress)
  $script:CheckoutOrder = $null

  try {
    $checkout = Invoke-Api -Method POST -Path $checkoutPath -Headers $auth -Body $mockBody
    $order = $checkout.data.order
    $json = $checkout | ConvertTo-Json -Depth 8
    $safe = Test-TopupResponseSafe $json
    $ok = (
      $safe -and
      $order.status -eq "pending" -and
      $order.amountIdr -eq 39000 -and
      $order.creditsToGrant -eq 100 -and
      $checkout.data.paymentUrl -match "mock-return" -and
      $order.providerInvoiceId -match "^mock_inv_"
    )
    Add-StepResult "mock checkout success" $(if ($ok) { "PASS" } else { "FAIL" }) "status=$($order.status) amount=$($order.amountIdr)"
    $script:CheckoutOrder = $order
  } catch {
    Add-StepResult "mock checkout success" "FAIL" (Get-SafeDetail $_.Exception.Message)
  }

  $forbiddenBody = (@{
    productSlug = "starter"
    idempotencyKey = "s10-forbidden-$(Get-Random)"
    amountIdr = 1
    credits = 9999
  } | ConvertTo-Json -Compress)
  Invoke-ApiExpectErrorCode -Name "forbidden client price rejected" -Method POST -Path $checkoutPath -Headers $auth -Body $forbiddenBody -ExpectedCode "BAD_REQUEST"

  try {
    $replay = Invoke-Api -Method POST -Path $checkoutPath -Headers $auth -Body $mockBody
    $replayFlag = [bool]$replay.data.idempotentReplay
    $sameId = ($replay.data.order.id -eq $checkout.data.order.id)
    Add-StepResult "idempotency replay" $(if ($replayFlag -and $sameId) { "PASS" } else { "FAIL" }) "replay=$replayFlag sameId=$sameId"
  } catch {
    Add-StepResult "idempotency replay" "FAIL" (Get-SafeDetail $_.Exception.Message)
  }

  $ordersAfter = @(Get-TopupOrdersForUser -UserId $script:UserId)
  $pendingOrders = @($ordersAfter | Where-Object { $_.status -eq "pending" })
  if ($pendingOrders.Count -ge 1) {
    Add-StepResult "order pending in DB" "PASS" "pending=$($pendingOrders.Count)"
  } else {
    Add-StepResult "order pending in DB" "FAIL" "no pending order"
  }

  $balanceAfterCheckout = Get-CreditBalanceRow -UserId $script:UserId
  $ledgerTopupAfterCheckout = Get-CreditLedgerTopupCount -UserId $script:UserId
  $balanceSame = (
    ($null -eq $balanceBefore -and $null -eq $balanceAfterCheckout) -or
    ($balanceBefore.balance -eq $balanceAfterCheckout.balance)
  )
  Add-StepResult "no balance mutation" $(if ($balanceSame) { "PASS" } else { "FAIL" }) "after checkout only"
  Add-StepResult "no ledger credit_topup row" $(if ($ledgerTopupAfterCheckout -eq $ledgerTopupBefore) { "PASS" } else { "FAIL" }) "before=$ledgerTopupBefore after=$ledgerTopupAfterCheckout"

  Assert-AuditActionExists -Name "audit checkout created" -UserId $script:UserId -Action "credit_topup_checkout_created"
  Assert-AuditActionExists -Name "audit invoice created" -UserId $script:UserId -Action "payment_invoice_created"

  if ($script:CheckoutOrder) {
    $orderId = $script:CheckoutOrder.id
    $invoiceId = $script:CheckoutOrder.providerInvoiceId
    $transactionId = $script:CheckoutOrder.providerTransactionId
    $balanceBeforeWebhook = Get-CreditBalanceRow -UserId $script:UserId
    $ledgerBeforeWebhook = Get-CreditLedgerTopupCount -UserId $script:UserId
    $startingBalance = if ($balanceBeforeWebhook) { [int]$balanceBeforeWebhook.balance } else { 0 }
    $mockEvtId = "mock_evt_s10_$(Get-Random)"
    $webhookBody = New-MockPaymentReceivedBody -OrderId $orderId -InvoiceId $invoiceId -TransactionId $transactionId -EventId $mockEvtId

    try {
      $wh = Invoke-Api -Method POST -Path $webhookPath -Body $webhookBody
      $whJson = $wh | ConvertTo-Json -Depth 8
      $whSafe = Test-TopupResponseSafe $whJson
      $ordersPaid = @(Get-TopupOrdersForUser -UserId $script:UserId | Where-Object { $_.id -eq $orderId -and $_.status -eq "paid" })
      $balanceAfterGrant = Get-CreditBalanceRow -UserId $script:UserId
      $ledgerAfterGrant = Get-CreditLedgerTopupCount -UserId $script:UserId
      $newBalance = if ($balanceAfterGrant) { [int]$balanceAfterGrant.balance } else { 0 }
      $grantOk = (
        $whSafe -and
        $wh.data.granted -eq $true -and
        $ordersPaid.Count -eq 1 -and
        ($newBalance -eq ($startingBalance + 100)) -and
        ($ledgerAfterGrant -eq ($ledgerBeforeWebhook + 1))
      )
      Add-StepResult "webhook grant credits" $(if ($grantOk) { "PASS" } else { "FAIL" }) "balance=$newBalance ledger=$ledgerAfterGrant"
    } catch {
      Add-StepResult "webhook grant credits" "FAIL" (Get-SafeDetail $_.Exception.Message)
    }

    try {
      $whDup = Invoke-Api -Method POST -Path $webhookPath -Body $webhookBody
      $balanceAfterDup = Get-CreditBalanceRow -UserId $script:UserId
      $ledgerAfterDup = Get-CreditLedgerTopupCount -UserId $script:UserId
      $dupBalance = if ($balanceAfterDup) { [int]$balanceAfterDup.balance } else { 0 }
      $dupOk = (
        ($whDup.data.duplicate -eq $true -or $whDup.data.alreadyGranted -eq $true) -and
        ($dupBalance -eq ($startingBalance + 100)) -and
        ($ledgerAfterDup -eq ($ledgerBeforeWebhook + 1))
      )
      Add-StepResult "webhook duplicate no double grant" $(if ($dupOk) { "PASS" } else { "FAIL" }) "dup=$($whDup.data.duplicate)"
    } catch {
      Add-StepResult "webhook duplicate no double grant" "FAIL" (Get-SafeDetail $_.Exception.Message)
    }

    Assert-AuditActionExists -Name "audit webhook received" -UserId $script:UserId -Action "payment_webhook_received"
    Assert-AuditActionExists -Name "audit webhook processed" -UserId $script:UserId -Action "payment_webhook_processed"
    Assert-AuditActionExists -Name "audit credit topup granted" -UserId $script:UserId -Action "credit_topup_granted"

    $unknownBody = New-MockPaymentReceivedBody -OrderId "00000000-0000-0000-0000-000000000099" -InvoiceId "mock_inv_unknown" -TransactionId "mock_trx_unknown" -EventId "mock_evt_unknown_$(Get-Random)"
    try {
      $whUnknown = Invoke-Api -Method POST -Path $webhookPath -Body $unknownBody
      $ledgerAfterUnknown = Get-CreditLedgerTopupCount -UserId $script:UserId
      $unknownOk = ($whUnknown.data.failed -eq $true -and $whUnknown.data.granted -eq $false -and $ledgerAfterUnknown -eq ($ledgerBeforeWebhook + 1))
      Add-StepResult "webhook unknown order no grant" $(if ($unknownOk) { "PASS" } else { "FAIL" }) "reason=$($whUnknown.data.reason)"
    } catch {
      Add-StepResult "webhook unknown order no grant" "FAIL" (Get-SafeDetail $_.Exception.Message)
    }

    $mismatchBody = New-MockPaymentReceivedBody -OrderId $orderId -InvoiceId $invoiceId -TransactionId $transactionId -Amount 1 -EventId "mock_evt_mismatch_$(Get-Random)"
    try {
      $whMismatch = Invoke-Api -Method POST -Path $webhookPath -Body $mismatchBody
      $orderStillPaid = @(Get-TopupOrdersForUser -UserId $script:UserId | Where-Object { $_.id -eq $orderId -and $_.status -eq "paid" })
      $ledgerAfterMismatch = Get-CreditLedgerTopupCount -UserId $script:UserId
      $mismatchOk = (
        $whMismatch.data.failed -eq $true -and
        $whMismatch.data.granted -eq $false -and
        $orderStillPaid.Count -eq 1 -and
        $ledgerAfterMismatch -eq ($ledgerBeforeWebhook + 1)
      )
      Add-StepResult "webhook amount mismatch no grant" $(if ($mismatchOk) { "PASS" } else { "FAIL" }) "reason=$($whMismatch.data.reason)"
    } catch {
      Add-StepResult "webhook amount mismatch no grant" "FAIL" (Get-SafeDetail $_.Exception.Message)
    }

    $ignoredBody = New-MockPaymentReceivedBody -OrderId $orderId -InvoiceId $invoiceId -TransactionId $transactionId -Event "payment.reminder" -Status $false -EventId "mock_evt_ignored_$(Get-Random)"
    try {
      $whIgnored = Invoke-Api -Method POST -Path $webhookPath -Body $ignoredBody
      $ledgerAfterIgnored = Get-CreditLedgerTopupCount -UserId $script:UserId
      $ignoredOk = ($whIgnored.data.ignored -eq $true -and $whIgnored.data.granted -eq $false -and $ledgerAfterIgnored -eq ($ledgerBeforeWebhook + 1))
      Add-StepResult "webhook non-paid ignored" $(if ($ignoredOk) { "PASS" } else { "FAIL" }) "reason=$($whIgnored.data.reason)"
    } catch {
      Add-StepResult "webhook non-paid ignored" "FAIL" (Get-SafeDetail $_.Exception.Message)
    }

    $foreignBody = New-MockPaymentReceivedBody -OrderId $orderId -InvoiceId "mock_inv_siklusio" -TransactionId "mock_trx_siklusio" -App "siklusio" -Flow "membership_purchase" -EventId "mock_evt_foreign_$(Get-Random)"
    try {
      $whForeign = Invoke-Api -Method POST -Path $webhookPath -Body $foreignBody
      $ledgerAfterForeign = Get-CreditLedgerTopupCount -UserId $script:UserId
      $foreignOk = (
        $whForeign.data.ignored -eq $true -and
        $whForeign.data.granted -eq $false -and
        $whForeign.data.reason -eq "foreign_app_payload" -and
        $ledgerAfterForeign -eq ($ledgerBeforeWebhook + 1)
      )
      Add-StepResult "webhook foreign app ignored" $(if ($foreignOk) { "PASS" } else { "FAIL" }) "reason=$($whForeign.data.reason)"
    } catch {
      Add-StepResult "webhook foreign app ignored" "FAIL" (Get-SafeDetail $_.Exception.Message)
    }

    $legacySiklusioBody = (@{
      event = "payment.received"
      id = "mock_evt_legacy_$(Get-Random)"
      data = @{
        id = "mayar_webhook_legacy_$(Get-Random)"
        invoiceId = "mayar_inv_legacy"
        transactionId = "mayar_trx_legacy"
        amount = 37000
        status = "paid"
        customerEmail = "legacy-siklusio@example.com"
        extraData = @{
          noCustomer = "legacy-siklusio@example.com"
          idProd = "siklusio_premium_lifetime"
          productName = "Siklusio Premium Lifetime"
        }
      }
    } | ConvertTo-Json -Compress -Depth 6)
    try {
      $whLegacy = Invoke-Api -Method POST -Path $webhookPath -Body $legacySiklusioBody
      $ledgerAfterLegacy = Get-CreditLedgerTopupCount -UserId $script:UserId
      $legacyOk = (
        $whLegacy.data.ignored -eq $true -and
        $whLegacy.data.granted -eq $false -and
        $whLegacy.data.reason -eq "legacy_no_vibenovel_order" -and
        $ledgerAfterLegacy -eq ($ledgerBeforeWebhook + 1)
      )
      Add-StepResult "webhook legacy siklusio ignored" $(if ($legacyOk) { "PASS" } else { "FAIL" }) "reason=$($whLegacy.data.reason)"
    } catch {
      Add-StepResult "webhook legacy siklusio ignored" "FAIL" (Get-SafeDetail $_.Exception.Message)
    }

    # Mayar docs-shaped fixture (Task 10.5): boolean status, data.id = webhook row id (not invoice)
    $idemDoc = "s10-docshape-$(Get-Random)"
    $docOrder = $null
    try {
      $docCheckout = Invoke-Api -Method POST -Path $checkoutPath -Headers $auth -Body (@{
        productSlug = "starter"; idempotencyKey = $idemDoc
      } | ConvertTo-Json -Compress)
      $docOrder = $docCheckout.data.order
    } catch {
      Add-StepResult "mayar docs-shaped webhook grant" "FAIL" "second checkout failed"
    }
    if ($docOrder) {
      $docLedgerBefore = Get-CreditLedgerTopupCount -UserId $script:UserId
      $docBalanceBefore = Get-CreditBalanceRow -UserId $script:UserId
      $docStartBal = if ($docBalanceBefore) { [int]$docBalanceBefore.balance } else { 0 }
      $docWebhookBody = (@{
        event = "payment.received"
        id = "mayar_webhook_evt_$(Get-Random)"
        data = @{
          id = "mayar_webhook_data_id_$(Get-Random)"
          status = $true
          amount = $docOrder.amountIdr
          transactionId = $docOrder.providerTransactionId
          extraData = @{
            app = "vibenovel"
            flow = "credit_topup"
            orderId = $docOrder.id
            productSlug = "starter"
          }
        }
      } | ConvertTo-Json -Compress -Depth 6)
      try {
        $whDoc = Invoke-Api -Method POST -Path $webhookPath -Body $docWebhookBody
        $docBalanceAfter = Get-CreditBalanceRow -UserId $script:UserId
        $docLedgerAfter = Get-CreditLedgerTopupCount -UserId $script:UserId
        $docNewBal = if ($docBalanceAfter) { [int]$docBalanceAfter.balance } else { 0 }
        $docOk = (
          $whDoc.data.granted -eq $true -and
          ($docNewBal -eq ($docStartBal + 100)) -and
          ($docLedgerAfter -eq ($docLedgerBefore + 1))
        )
        $docDetail = "balance=$docNewBal ledger=$docLedgerAfter granted=$($whDoc.data.granted) reason=$($whDoc.data.reason)"
        Add-StepResult "mayar docs-shaped webhook grant" $(if ($docOk) { "PASS" } else { "FAIL" }) $docDetail
      } catch {
        Add-StepResult "mayar docs-shaped webhook grant" "FAIL" (Get-SafeDetail $_.Exception.Message)
      }
    }
  } else {
    Add-StepResult "webhook grant credits" "FAIL" "checkout order missing"
    Add-StepResult "webhook duplicate no double grant" "NOT RUN" "checkout failed"
    Add-StepResult "webhook unknown order no grant" "NOT RUN" "checkout failed"
    Add-StepResult "webhook amount mismatch no grant" "NOT RUN" "checkout failed"
    Add-StepResult "webhook non-paid ignored" "NOT RUN" "checkout failed"
    Add-StepResult "webhook foreign app ignored" "NOT RUN" "checkout failed"
    Add-StepResult "webhook legacy siklusio ignored" "NOT RUN" "checkout failed"
    Add-StepResult "mayar docs-shaped webhook grant" "NOT RUN" "checkout failed"
  }

  Add-StepResult "mock fail_provider checkout" "NOT RUN" "set PAYMENT_PROVIDER_MOCK_MODE=fail_provider + restart, run with -MockMode fail_provider"
  Add-StepResult "fail_provider pending no paymentUrl" "NOT RUN" "requires fail_provider mode"
}

Write-Host ""
$pass = @($Results | Where-Object { $_.Result -eq "PASS" }).Count
$fail = @($Results | Where-Object { $_.Result -eq "FAIL" }).Count
$skip = @($Results | Where-Object { $_.Result -in @("SKIP", "NOT RUN") }).Count
Write-Host ("Summary: PASS={0} FAIL={1} SKIP/NOT RUN={2} TOTAL={3}" -f $pass, $fail, $skip, $Results.Count) -ForegroundColor $(if ($fail -gt 0) { "Red" } else { "Green" })

if ($fail -gt 0) { exit 1 }
exit 0