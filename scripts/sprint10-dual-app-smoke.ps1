<#
.SYNOPSIS
  Task 10.3d — Dual-app smoke: Siklusio Mayar webhook router → VibeNovel grant.

.DESCRIPTION
  Prerequisites (local, gitignored env):
    - supabase start (VibeNovel)
    - VibeNovel dev:api with CREDIT_TOPUP_ENABLED=true, PAYMENT_PROVIDER_MOCK=true
    - Siklusio dev:backend with MAYAR_MULTI_APP_ROUTER_ENABLED=true
      and VIBENOVEL_MAYAR_WEBHOOK_URL=http://127.0.0.1:8787/api/payments/mayar/webhook
    - Siklusio MAYAR_WEBHOOK_TOKEN set in .dev.vars (not logged)

  Run:
    powershell -ExecutionPolicy Bypass -File scripts/sprint10-dual-app-smoke.ps1

  Security: never prints webhook tokens, API keys, or service role keys.
#>
[CmdletBinding()]
param(
  [string]$VibeNovelApiUrl = "http://127.0.0.1:8787",
  [string]$SiklusioApiUrl = "http://127.0.0.1:3000",
  [string]$SupabaseUrl = "http://127.0.0.1:54321",
  [string]$SiklusioRepo = "D:\Coding\remix_-siklusio",
  [string]$TestEmail = "",
  [string]$TestPassword = "VibeNovel-Local-Smoke-Test!",
  [switch]$RunForwardFailureTest
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Continue"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$Results = New-Object System.Collections.Generic.List[object]
$StepNumber = 0
$script:UserId = $null
$script:ServiceRoleKey = $null
$script:CheckoutOrder = $null
$script:CrossRepoEventId = "mock_evt_cross_repo_$(Get-Random)"

function Add-StepResult {
  param([string]$Name, [ValidateSet("PASS", "FAIL", "SKIP", "NOT RUN")][string]$Result, [string]$Detail = "")
  $script:StepNumber++
  $Results.Add([PSCustomObject]@{ Step = $script:StepNumber; Test = $Name; Result = $Result; Detail = $Detail }) | Out-Null
  $color = if ($Result -eq "PASS") { "Green" } elseif ($Result -eq "FAIL") { "Red" } else { "Yellow" }
  Write-Host ("[{0}] {1,-58} {2}" -f $Result, $Name, $Detail) -ForegroundColor $color
}

function Get-SafeDetail {
  param([string]$Text)
  if ([string]::IsNullOrWhiteSpace($Text)) { return "" }
  $sanitized = $Text -replace 'Bearer\s+[A-Za-z0-9._-]+', 'Bearer [redacted]'
  $sanitized = $sanitized -replace 'eyJ[A-Za-z0-9._-]{20,}', '[jwt-redacted]'
  $sanitized = $sanitized -replace '(?i)(MAYAR_WEBHOOK_TOKEN|X-Callback-Token|VIBENOVEL_MAYAR_FORWARD_TOKEN)\s*[:=]\s*\S+', '$1=[redacted]'
  if ($sanitized.Length -gt 120) { return $sanitized.Substring(0, 117) + "..." }
  return $sanitized
}

function Resolve-SupabaseAnonKey {
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

function Resolve-SiklusioWebhookToken {
  if (-not [string]::IsNullOrWhiteSpace($env:SIKLUSIO_MAYAR_WEBHOOK_TOKEN)) {
    return $env:SIKLUSIO_MAYAR_WEBHOOK_TOKEN.Trim()
  }
  $devVars = Join-Path $SiklusioRepo ".dev.vars"
  if (Test-Path $devVars) {
    foreach ($line in Get-Content $devVars) {
      if ($line -match '^MAYAR_WEBHOOK_TOKEN\s*=\s*"?([^"\r\n]+)"?\s*$') {
        return $Matches[1].Trim()
      }
    }
  }
  return "local-dual-app-smoke-token"
}

function Wait-HttpOk {
  param([string]$Url, [int]$TimeoutSec = 90, [string]$Method = "GET")
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    try {
      if ($Method -eq "GET") {
        Invoke-RestMethod -Uri $Url -Method GET -TimeoutSec 5 -ErrorAction Stop | Out-Null
      } else {
        Invoke-RestMethod -Uri $Url -Method $Method -TimeoutSec 5 -ErrorAction Stop | Out-Null
      }
      return $true
    } catch { }
    Start-Sleep -Seconds 2
  }
  return $false
}

function Invoke-VibeApi {
  param(
    [ValidateSet("GET", "POST")][string]$Method = "GET",
    [Parameter(Mandatory)][string]$Path,
    [hashtable]$Headers = @{},
    [string]$Body = $null
  )
  $uri = "$VibeNovelApiUrl$Path"
  if ($Method -eq "GET") {
    return Invoke-RestMethod -Uri $uri -Method GET -Headers $Headers -ErrorAction Stop
  }
  return Invoke-RestMethod -Uri $uri -Method POST -Headers $Headers -ContentType "application/json" -Body $Body -ErrorAction Stop
}

function Invoke-SiklusioWebhook {
  param([string]$Body, [string]$Token)
  $headers = @{ "X-Callback-Token" = $Token }
  try {
    $json = Invoke-RestMethod -Uri "$SiklusioApiUrl/api/payment/webhook" -Method POST `
      -Headers $headers -ContentType "application/json" -Body $Body -ErrorAction Stop
    return @{ StatusCode = 200; Json = $json }
  } catch {
    $status = 0
    $json = $null
    if ($_.Exception.Response) {
      $status = [int]$_.Exception.Response.StatusCode
      try {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $raw = $reader.ReadToEnd()
        if (-not [string]::IsNullOrWhiteSpace($raw)) { $json = $raw | ConvertFrom-Json }
      } catch { }
    }
    return @{ StatusCode = $status; Json = $json; Error = $_.Exception.Message }
  }
}

function Get-TopupOrdersForUser {
  param([string]$UserId)
  $srk = Resolve-ServiceRoleKey
  $headers = @{ apikey = $srk; Authorization = "Bearer $srk" }
  $uri = ('{0}/rest/v1/credit_topup_orders?user_id=eq.{1}&select=id,status,amount_idr,credits_to_grant,provider_invoice_id,provider_transaction_id,payment_url,idempotency_key,paid_at&order=created_at.desc' -f $SupabaseUrl, $UserId)
  $raw = Invoke-RestMethod -Uri $uri -Method GET -Headers $headers -ErrorAction Stop
  if ($null -eq $raw) { return @() }
  if ($raw -is [System.Array]) { return @($raw) }
  if ((Get-RestRowCount $raw) -eq 1) { return @($raw) }
  return @()
}

function Get-RestRowCount {
  param($Raw)
  if ($null -eq $Raw) { return 0 }
  if ($Raw -is [System.Array]) { return $Raw.Count }
  if ($Raw.PSObject.Properties.Name -contains "id") { return 1 }
  return 0
}

function Get-CreditBalance {
  param([string]$UserId)
  $srk = Resolve-ServiceRoleKey
  $headers = @{ apikey = $srk; Authorization = "Bearer $srk" }
  $uri = ('{0}/rest/v1/credit_balances?user_id=eq.{1}&select=balance&limit=1' -f $SupabaseUrl, $UserId)
  $raw = Invoke-RestMethod -Uri $uri -Method GET -Headers $headers -ErrorAction Stop
  if ((Get-RestRowCount $raw) -lt 1) { return 0 }
  $row = if ($raw -is [System.Array]) { $raw[0] } else { $raw }
  $balanceValue = $row.balance
  if ($null -eq $balanceValue) { return 0 }
  return [int]$balanceValue
}

function Get-LedgerTopupCount {
  param([string]$UserId)
  $srk = Resolve-ServiceRoleKey
  $headers = @{ apikey = $srk; Authorization = "Bearer $srk" }
  $uri = ('{0}/rest/v1/credit_ledger?user_id=eq.{1}&reason=eq.credit_topup&select=id' -f $SupabaseUrl, $UserId)
  $raw = Invoke-RestMethod -Uri $uri -Method GET -Headers $headers -ErrorAction Stop
  return Get-RestRowCount $raw
}

function Get-WebhookEventsProcessedCount {
  $srk = Resolve-ServiceRoleKey
  $headers = @{ apikey = $srk; Authorization = "Bearer $srk" }
  $uri = ('{0}/rest/v1/payment_webhook_events?processing_status=eq.processed&select=id' -f $SupabaseUrl)
  return Get-RestRowCount (Invoke-RestMethod -Uri $uri -Method GET -Headers $headers -ErrorAction Stop)
}

function Get-AuditCount {
  param([string]$UserId, [string]$Action)
  $srk = Resolve-ServiceRoleKey
  $headers = @{ apikey = $srk; Authorization = "Bearer $srk" }
  $uri = ('{0}/rest/v1/audit_logs?user_id=eq.{1}&action=eq.{2}&select=id' -f $SupabaseUrl, $UserId, $Action)
  return Get-RestRowCount (Invoke-RestMethod -Uri $uri -Method GET -Headers $headers -ErrorAction Stop)
}

function New-CrossRepoWebhookBody {
  param(
    [string]$OrderId,
    [string]$InvoiceId,
    [string]$TransactionId,
    [string]$EventId,
    [string]$App = "vibenovel",
    [string]$Flow = "credit_topup"
  )
  $extra = @{
    orderId = $OrderId
    productSlug = "starter"
  }
  if ($App) { $extra.app = $App }
  if ($Flow) { $extra.flow = $Flow }
  return (@{
    event = "payment.received"
    id = $EventId
    data = @{
      id = "cross_webhook_data_$(Get-Random)"
      invoiceId = $InvoiceId
      transactionId = $TransactionId
      amount = 39000
      status = "paid"
      extraData = $extra
    }
  } | ConvertTo-Json -Compress -Depth 6)
}

Write-Host "`nTask 10.3d - Dual-App Smoke (Siklusio to VibeNovel)" -ForegroundColor Cyan

$webhookToken = Resolve-SiklusioWebhookToken
Add-StepResult "resolve siklusio webhook token" "PASS" "token configured (not logged)"

if (-not (Wait-HttpOk -Url "$VibeNovelApiUrl/api/health")) {
  Add-StepResult "vibenovel api ready" "FAIL" "start dev:api with CREDIT_TOPUP_ENABLED=true"
  exit 1
}

$vnHealth = Invoke-RestMethod -Uri "$VibeNovelApiUrl/api/health" -Method GET
$topupOn = [bool]$vnHealth.data.env.creditTopupEnabled
$mockOn = [bool]$vnHealth.data.env.paymentProviderMock
Add-StepResult "vibenovel api ready" "PASS" "topup=$topupOn mock=$mockOn"
if (-not $topupOn -or -not $mockOn) {
  Add-StepResult "vibenovel env mode" "FAIL" "need CREDIT_TOPUP_ENABLED=true PAYMENT_PROVIDER_MOCK=true"
  exit 1
}
Add-StepResult "vibenovel env mode" "PASS" "mock success mode"

if (-not (Wait-HttpOk -Url "$SiklusioApiUrl/api/payment/webhook" -Method GET)) {
  Add-StepResult "siklusio webhook ready" "FAIL" "start Siklusio dev:backend with router env"
  exit 1
}
Add-StepResult "siklusio webhook ready" "PASS" "GET verify OK"

$anonKey = Resolve-SupabaseAnonKey
if ([string]::IsNullOrWhiteSpace($TestEmail)) {
  $TestEmail = "s10dual-$(Get-Random -Maximum 99999999)@example.com"
}

try {
  $signup = Invoke-RestMethod -Uri "$SupabaseUrl/auth/v1/signup" -Method POST `
    -Headers @{ apikey = $anonKey; Authorization = "Bearer $anonKey" } -ContentType "application/json" `
    -Body (@{ email = $TestEmail; password = $TestPassword } | ConvertTo-Json)
  $token = $signup.access_token
  Add-StepResult "signup/login" $(if ($token) { "PASS" } else { "FAIL" }) "email=$TestEmail"
} catch {
  Add-StepResult "signup/login" "FAIL" (Get-SafeDetail $_.Exception.Message)
  exit 1
}

$auth = @{ Authorization = "Bearer $token" }
try {
  $me = Invoke-VibeApi -Path "/api/me" -Headers $auth
  $script:UserId = $me.data.user.id
  Add-StepResult "GET /api/me" "PASS" "userId=$($script:UserId)"
} catch {
  Add-StepResult "GET /api/me" "FAIL" (Get-SafeDetail $_.Exception.Message)
  exit 1
}

try {
  $products = Invoke-VibeApi -Path "/api/credits/topup/products" -Headers $auth
  $count = if ($products.data.products) { $products.data.products.Count } else { 0 }
  Add-StepResult "GET topup products" $(if ($count -eq 4) { "PASS" } else { "FAIL" }) "count=$count"
} catch {
  Add-StepResult "GET topup products" "FAIL" (Get-SafeDetail $_.Exception.Message)
}

$balanceBefore = Get-CreditBalance -UserId $script:UserId
$ledgerBefore = Get-LedgerTopupCount -UserId $script:UserId
$idemKey = "s10dual-$(Get-Random)"
$checkoutBody = (@{ productSlug = "starter"; idempotencyKey = $idemKey } | ConvertTo-Json -Compress)

try {
  $checkout = Invoke-VibeApi -Method POST -Path "/api/credits/topup/checkout" -Headers $auth -Body $checkoutBody
  $order = $checkout.data.order
  $pendingOk = (
    $order.status -eq "pending" -and
    $order.providerInvoiceId -match "^mock_inv_" -and
    $order.providerTransactionId -match "^mock_trx_" -and
    $order.amountIdr -eq 39000 -and
    $order.creditsToGrant -eq 100
  )
  Add-StepResult "pending order checkout" $(if ($pendingOk) { "PASS" } else { "FAIL" }) "orderId=$($order.id)"
  $script:CheckoutOrder = $order
} catch {
  Add-StepResult "pending order checkout" "FAIL" (Get-SafeDetail $_.Exception.Message)
  exit 1
}

$crossBody = New-CrossRepoWebhookBody `
  -OrderId $script:CheckoutOrder.id `
  -InvoiceId $script:CheckoutOrder.providerInvoiceId `
  -TransactionId $script:CheckoutOrder.providerTransactionId `
  -EventId $script:CrossRepoEventId

$skResp = Invoke-SiklusioWebhook -Body $crossBody -Token $webhookToken
$forwardOk = ($skResp.StatusCode -eq 200 -and $skResp.Json.routed -eq "vibenovel" -and $skResp.Json.ok -eq $true)
Add-StepResult "siklusio forward vibenovel" $(if ($forwardOk) { "PASS" } else { "FAIL" }) "status=$($skResp.StatusCode) routed=$($skResp.Json.routed)"

Start-Sleep -Seconds 1
$ordersAfter = @(Get-TopupOrdersForUser -UserId $script:UserId)
$paidOrder = $ordersAfter | Where-Object { $_.id -eq $script:CheckoutOrder.id } | Select-Object -First 1
$balanceAfter = Get-CreditBalance -UserId $script:UserId
$ledgerAfter = Get-LedgerTopupCount -UserId $script:UserId
$paidAtOk = $paidOrder -and (-not [string]::IsNullOrWhiteSpace([string]$paidOrder.paid_at))
$grantOk = (
  $paidOrder -and
  $paidOrder.status -eq "paid" -and
  $paidAtOk -and
  ($balanceAfter -eq ($balanceBefore + 100)) -and
  ($ledgerAfter -eq ($ledgerBefore + 1))
)
Add-StepResult "vibenovel grant once" $(if ($grantOk) { "PASS" } else { "FAIL" }) "balanceBefore=$balanceBefore balanceAfter=$balanceAfter ledger=$ledgerAfter paidAt=$paidAtOk"

$auditProcessed = Get-AuditCount -UserId $script:UserId -Action "payment_webhook_processed"
$auditGranted = Get-AuditCount -UserId $script:UserId -Action "credit_topup_granted"
Add-StepResult "vibenovel audit trail" $(if ($auditProcessed -ge 1 -and $auditGranted -ge 1) { "PASS" } else { "FAIL" }) "processed=$auditProcessed granted=$auditGranted"

$skDup = Invoke-SiklusioWebhook -Body $crossBody -Token $webhookToken
$balanceDup = Get-CreditBalance -UserId $script:UserId
$ledgerDup = Get-LedgerTopupCount -UserId $script:UserId
$dupOk = (
  ($skDup.StatusCode -eq 200) -and
  ($balanceDup -eq $balanceAfter) -and
  ($ledgerDup -eq $ledgerAfter)
)
Add-StepResult "duplicate webhook idempotent" $(if ($dupOk) { "PASS" } else { "FAIL" }) "balance=$balanceDup ledger=$ledgerDup"

$whEventsBeforeCompat = Get-WebhookEventsProcessedCount
$ledgerCompatBefore = Get-LedgerTopupCount -UserId $script:UserId

$compatBodies = @(
  @{ Name = "non-vibenovel siklusio topup"; App = "siklusio"; Flow = "ai_credit_topup"; EventId = "mock_evt_sk_$(Get-Random)" },
  @{ Name = "non-vibenovel unknown app"; App = "unknown"; Flow = "credit_topup"; EventId = "mock_evt_unknown_$(Get-Random)" },
  @{ Name = "legacy no app flow"; App = ""; Flow = ""; EventId = "mock_evt_legacy_$(Get-Random)" }
)

$compatPass = $true
foreach ($case in $compatBodies) {
  $body = New-CrossRepoWebhookBody `
    -OrderId "00000000-0000-0000-0000-000000009999" `
    -InvoiceId "mock_inv_compat_$(Get-Random)" `
    -TransactionId "mock_trx_compat_$(Get-Random)" `
    -EventId $case.EventId `
    -App $case.App `
    -Flow $case.Flow
  $resp = Invoke-SiklusioWebhook -Body $body -Token $webhookToken
  if ($resp.Json -and ($resp.Json.PSObject.Properties.Name -contains "routed") -and $resp.Json.routed -eq "vibenovel") {
    $compatPass = $false
  }
}
$whEventsAfterCompat = Get-WebhookEventsProcessedCount
$ledgerCompatAfter = Get-LedgerTopupCount -UserId $script:UserId
$compatOk = (
  $compatPass -and
  ($whEventsAfterCompat -eq $whEventsBeforeCompat) -and
  ($ledgerCompatAfter -eq $ledgerCompatBefore)
)
Add-StepResult "non-vibenovel compatibility" $(if ($compatOk) { "PASS" } else { "FAIL" }) "vnEvents=$whEventsBeforeCompat->$whEventsAfterCompat ledger=$ledgerCompatBefore->$ledgerCompatAfter"

if ($RunForwardFailureTest) {
  Add-StepResult "forward failure 502" "NOT RUN" "requires Siklusio restart with unreachable VIBENOVEL_MAYAR_WEBHOOK_URL; covered by 10.3c unit test"
} else {
  Add-StepResult "forward failure 502" "NOT RUN" "pass -RunForwardFailureTest to document; 10.3c unit test covers fail-closed"
}

$failCount = @($Results | Where-Object { $_.Result -eq "FAIL" }).Count
$passCount = @($Results | Where-Object { $_.Result -eq "PASS" }).Count
$skipCount = @($Results | Where-Object { $_.Result -in @("SKIP", "NOT RUN") }).Count
Write-Host ""
Write-Host ("Summary: PASS={0} FAIL={1} SKIP/NOT RUN={2} TOTAL={3}" -f $passCount, $failCount, $skipCount, $Results.Count) -ForegroundColor $(if ($failCount -eq 0) { "Green" } else { "Red" })
if ($failCount -gt 0) { exit 1 }
exit 0