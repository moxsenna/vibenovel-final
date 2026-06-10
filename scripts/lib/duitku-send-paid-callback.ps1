# Send signed paid callback to staging API for a pending order (sandbox-shaped, Task 10.13b)
param(
  [Parameter(Mandatory)][string]$OrderId,
  [string]$ApiBaseUrl = "https://api-staging.narraza.web.id",
  [string]$RepoRoot = ""
)
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
  $RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
}
. (Join-Path (Split-Path -Parent $PSScriptRoot) "lib\staging-smoke-common.ps1")
Import-StagingSupabaseEnv -RepoRoot $RepoRoot
Import-DotEnvFile -Path (Join-Path $RepoRoot ".env.staging.duitku")
$code = [Environment]::GetEnvironmentVariable("DUITKU_MERCHANT_CODE")
$key = [Environment]::GetEnvironmentVariable("DUITKU_MERCHANT_KEY")
if ([string]::IsNullOrWhiteSpace($code) -or [string]::IsNullOrWhiteSpace($key)) { throw "missing duitku creds in .env.staging.duitku" }
$sr = Get-StagingSupabaseCredential "STAGING_SUPABASE_SERVICE_ROLE_KEY"
$sb = Get-StagingSupabaseCredential "STAGING_SUPABASE_URL"
$order = (Invoke-RestMethod -Uri "$sb/rest/v1/credit_topup_orders?id=eq.$OrderId&select=id,user_id,amount_idr,status,provider_transaction_id" -Headers @{ apikey=$sr; Authorization="Bearer $sr" })[0]
if ($order.status -eq "paid") { Write-Host "Order already paid"; exit 0 }
$amount = [string]$order.amount_idr
$ref = if ($order.provider_transaction_id) { $order.provider_transaction_id } else { "REF$OrderId" }
$toSign = "$code$amount$OrderId"
$hmac = [System.Security.Cryptography.HMACSHA256]::new([Text.Encoding]::UTF8.GetBytes($key))
$hash = $hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($toSign))
$sig = ([BitConverter]::ToString($hash) -replace '-', '').ToLower()
$hmac.Dispose()
$form = @(
  "merchantCode=$([uri]::EscapeDataString($code))"
  "amount=$amount"
  "merchantOrderId=$([uri]::EscapeDataString($OrderId))"
  "productDetail=$([uri]::EscapeDataString('Top Up Kredit VibeNovel - Paket Starter'))"
  "paymentCode=BC"
  "resultCode=00"
  "reference=$([uri]::EscapeDataString($ref))"
  "signature=$sig"
) -join "&"
$balBefore = (Invoke-RestMethod -Uri "$sb/rest/v1/credit_balances?user_id=eq.$($order.user_id)&select=balance" -Headers @{ apikey=$sr; Authorization="Bearer $sr" })
$balB = if ($balBefore -is [array] -and $balBefore.Count -gt 0) { [int]$balBefore[0].balance } else { 0 }
$resp = Invoke-RestMethod -Uri "$ApiBaseUrl/api/payments/duitku/callback" -Method POST -ContentType "application/x-www-form-urlencoded" -Body $form -TimeoutSec 45
$balAfter = (Invoke-RestMethod -Uri "$sb/rest/v1/credit_balances?user_id=eq.$($order.user_id)&select=balance" -Headers @{ apikey=$sr; Authorization="Bearer $sr" })
$balA = if ($balAfter -is [array] -and $balAfter.Count -gt 0) { [int]$balAfter[0].balance } else { 0 }
$ord = (Invoke-RestMethod -Uri "$sb/rest/v1/credit_topup_orders?id=eq.$OrderId&select=status" -Headers @{ apikey=$sr; Authorization="Bearer $sr" })[0]
Write-Host "callback granted=$($resp.data.granted) duplicate=$($resp.data.duplicate) orderStatus=$($ord.status) balance=$balB->$balA"
if (-not $resp.data.granted -and -not $resp.data.alreadyGranted) { exit 1 }
exit 0