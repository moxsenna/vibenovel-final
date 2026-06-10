param([string]$OrderId = "2fbe48f5-de17-4f5b-850a-23d1d07179c8")
Set-StrictMode -Version Latest
$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
. (Join-Path (Split-Path -Parent $PSScriptRoot) "lib\staging-smoke-common.ps1")
Import-StagingSupabaseEnv -RepoRoot $RepoRoot
$sr = Get-StagingSupabaseCredential "STAGING_SUPABASE_SERVICE_ROLE_KEY"
$base = Get-StagingSupabaseCredential "STAGING_SUPABASE_URL"
$h = @{ apikey = $sr; Authorization = "Bearer $sr" }
$order = (Invoke-RestMethod -Uri "$base/rest/v1/credit_topup_orders?id=eq.$OrderId&select=id,status,amount_idr,credits_to_grant,provider_transaction_id,user_id" -Headers $h)[0]
$webhooks = @(Invoke-RestMethod -Uri "$base/rest/v1/payment_webhook_events?provider=eq.duitku&provider_invoice_id=eq.$OrderId&select=id,processing_status,error_message_safe,provider_transaction_id,payload_safe_json,created_at&order=created_at.desc" -Headers $h)
$refWebhooks = @(Invoke-RestMethod -Uri "$base/rest/v1/payment_webhook_events?provider=eq.duitku&provider_transaction_id=eq.$($order.provider_transaction_id)&select=id,processing_status,error_message_safe,provider_invoice_id,created_at&order=created_at.desc" -Headers $h)
$bal = (Invoke-RestMethod -Uri "$base/rest/v1/credit_balances?user_id=eq.$($order.user_id)&select=balance" -Headers $h)[0].balance
Write-Host "order_status=$($order.status) ref=$($order.provider_transaction_id) credits=$($order.credits_to_grant)"
Write-Host "balance=$bal webhook_count=$($webhooks.Count)"
foreach ($w in $webhooks) {
  $payload = ($w.payload_safe_json | ConvertTo-Json -Compress)
  if ($payload.Length -gt 200) { $payload = $payload.Substring(0, 197) + "..." }
  Write-Host "  webhook $($w.id) status=$($w.processing_status) err=$($w.error_message_safe) at=$($w.created_at)"
  Write-Host "    payload=$payload"
}
Write-Host "ref_webhook_count=$($refWebhooks.Count)"
foreach ($w in $refWebhooks) { Write-Host "  ref_webhook $($w.id) invoice=$($w.provider_invoice_id) status=$($w.processing_status) err=$($w.error_message_safe)" }