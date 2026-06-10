# Callback negative/duplicate matrix against AWS staging (Task 10.13b)
param(
  [string]$PaidOrderId = "0c0818e1-e081-4d83-872f-cf9f200714a3",
  [string]$ApiBaseUrl = "https://api-staging.narraza.web.id"
)
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
. (Join-Path (Split-Path -Parent $PSScriptRoot) "lib\staging-smoke-common.ps1")
Import-StagingSupabaseEnv -RepoRoot $RepoRoot
Import-DotEnvFile -Path (Join-Path $RepoRoot ".env.staging.duitku")
$code = [Environment]::GetEnvironmentVariable("DUITKU_MERCHANT_CODE")
$key = [Environment]::GetEnvironmentVariable("DUITKU_MERCHANT_KEY")
$sr = Get-StagingSupabaseCredential "STAGING_SUPABASE_SERVICE_ROLE_KEY"
$sb = Get-StagingSupabaseCredential "STAGING_SUPABASE_URL"

function Send-Callback {
  param([string]$OrderId,[string]$Amount,[string]$Signature,[string]$ResultCode="00",[string]$MerchantCode=$code,[string]$Ref="REFTEST")
  $form = "merchantCode=$([uri]::EscapeDataString($MerchantCode))&amount=$Amount&merchantOrderId=$([uri]::EscapeDataString($OrderId))&productDetail=topup&resultCode=$ResultCode&reference=$([uri]::EscapeDataString($Ref))&signature=$Signature"
  return Invoke-RestMethod -Uri "$ApiBaseUrl/api/payments/duitku/callback" -Method POST -ContentType "application/x-www-form-urlencoded" -Body $form -TimeoutSec 45
}
function Make-Sig([string]$MerchantCode,[string]$Amount,[string]$OrderId,[string]$MerchantKey) {
  $toSign = "$MerchantCode$Amount$OrderId$MerchantKey"
  $md5 = [System.Security.Cryptography.MD5]::Create()
  $hash = $md5.ComputeHash([Text.Encoding]::UTF8.GetBytes($toSign))
  $sig = ([BitConverter]::ToString($hash) -replace '-', '').ToLower()
  $md5.Dispose()
  return $sig
}
function Get-Balance([string]$UserId) {
  $rows = Invoke-RestMethod -Uri "$sb/rest/v1/credit_balances?user_id=eq.$UserId&select=balance" -Headers @{ apikey=$sr; Authorization="Bearer $sr" }
  if ($rows -is [array] -and $rows.Count -gt 0) { return [int]$rows[0].balance }
  return 0
}

$paid = (Invoke-RestMethod -Uri "$sb/rest/v1/credit_topup_orders?id=eq.$PaidOrderId&select=id,user_id,amount_idr,provider_transaction_id,status" -Headers @{ apikey=$sr; Authorization="Bearer $sr" })[0]
$bal = Get-Balance $paid.user_id
$sig = Make-Sig $code ([string]$paid.amount_idr) $PaidOrderId $key
$dup = Send-Callback -OrderId $PaidOrderId -Amount ([string]$paid.amount_idr) -Signature $sig -Ref $paid.provider_transaction_id
$balDup = Get-Balance $paid.user_id
Write-Host "duplicate duplicate=$($dup.data.duplicate) granted=$($dup.data.granted) balance=$bal->$balDup"

$bad = Send-Callback -OrderId $PaidOrderId -Amount ([string]$paid.amount_idr) -Signature "00000000000000000000000000000000" -Ref $paid.provider_transaction_id
$balBad = Get-Balance $paid.user_id
Write-Host "invalid_sig failed=$($bad.data.failed) granted=$($bad.data.granted) balance=$balDup->$balBad"

$pendingId = [guid]::NewGuid().ToString()
$body = @{ id=$pendingId; user_id=$paid.user_id; product_id=(Invoke-RestMethod -Uri "$sb/rest/v1/credit_topup_products?slug=eq.starter&select=id&limit=1" -Headers @{apikey=$sr;Authorization="Bearer $sr"})[0].id; provider="duitku"; provider_invoice_id=$pendingId; amount_idr=39000; credits_to_grant=100; status="pending"; idempotency_key="neg-mm-$(Get-Random)" } | ConvertTo-Json -Compress
Invoke-RestMethod -Uri "$sb/rest/v1/credit_topup_orders" -Method POST -Headers @{ apikey=$sr; Authorization="Bearer $sr"; Prefer="return=minimal" } -ContentType "application/json" -Body $body | Out-Null
$mmSig = Make-Sig $code "1" $pendingId $key
$mm = Send-Callback -OrderId $pendingId -Amount "1" -Signature $mmSig
Write-Host "amount_mismatch failed=$($mm.data.failed) reason=$($mm.data.reason)"

$unk = [guid]::NewGuid().ToString()
$unkSig = Make-Sig $code "39000" $unk $key
$unkResp = Send-Callback -OrderId $unk -Amount "39000" -Signature $unkSig -Ref "UNK$unk"
Write-Host "unknown_order failed=$($unkResp.data.failed) reason=$($unkResp.data.reason)"

$npId = [guid]::NewGuid().ToString()
$npBody = @{ id=$npId; user_id=$paid.user_id; product_id=(Invoke-RestMethod -Uri "$sb/rest/v1/credit_topup_products?slug=eq.starter&select=id&limit=1" -Headers @{apikey=$sr;Authorization="Bearer $sr"})[0].id; provider="duitku"; provider_invoice_id=$npId; amount_idr=39000; credits_to_grant=100; status="pending"; idempotency_key="neg-np-$(Get-Random)" } | ConvertTo-Json -Compress
Invoke-RestMethod -Uri "$sb/rest/v1/credit_topup_orders" -Method POST -Headers @{ apikey=$sr; Authorization="Bearer $sr"; Prefer="return=minimal" } -ContentType "application/json" -Body $npBody | Out-Null
$npSig = Make-Sig $code "39000" $npId $key
$np = Send-Callback -OrderId $npId -Amount "39000" -Signature $npSig -ResultCode "01"
Write-Host "non_paid ignored=$($np.data.ignored) granted=$($np.data.granted)"