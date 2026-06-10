param(
  [string]$WebhookId = "",
  [string]$OrderId = "2fbe48f5-de17-4f5b-850a-23d1d07179c8"
)
Set-StrictMode -Version Latest
$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
. (Join-Path (Split-Path -Parent $PSScriptRoot) "lib\staging-smoke-common.ps1")
Import-StagingSupabaseEnv -RepoRoot $RepoRoot
$sr = Get-StagingSupabaseCredential "STAGING_SUPABASE_SERVICE_ROLE_KEY"
$base = Get-StagingSupabaseCredential "STAGING_SUPABASE_URL"
$h = @{ apikey = $sr; Authorization = "Bearer $sr" }
if ([string]::IsNullOrWhiteSpace($WebhookId)) {
  $uri = "$base/rest/v1/payment_webhook_events?provider=eq.duitku&provider_invoice_id=eq.$OrderId&select=id,processing_status,error_message_safe,payload_safe_json,metadata,provider_transaction_id,created_at&order=created_at.asc"
} else {
  $uri = "$base/rest/v1/payment_webhook_events?id=eq.$WebhookId&select=id,processing_status,error_message_safe,payload_safe_json,metadata,provider_transaction_id,created_at"
}
$rows = @(Invoke-RestMethod -Uri $uri -Headers $h)
Write-Host "webhook_count=$($rows.Count)"
foreach ($w in $rows) {
  Write-Host "--- id=$($w.id) status=$($w.processing_status) err=$($w.error_message_safe) at=$($w.created_at)"
  $p = $w.payload_safe_json | ConvertTo-Json -Depth 6 -Compress
  Write-Host "payload=$p"
  if ($w.metadata) {
    $m = $w.metadata | ConvertTo-Json -Depth 6 -Compress
    Write-Host "metadata=$m"
  }
  $diag = $null
  if ($w.payload_safe_json.PSObject.Properties.Name -contains "signatureDiagnostic") {
    $diag = $w.payload_safe_json.signatureDiagnostic
  }
  if ($null -ne $diag) {
    Write-Host "signatureDiagnostic:"
    Write-Host "  receivedPrefix=$($diag.signatureReceivedPrefix) length=$($diag.signatureReceivedLength)"
    Write-Host "  merchantCode=$($diag.merchantCodeUsed) amount=$($diag.amountUsed) orderId=$($diag.merchantOrderIdUsed)"
    Write-Host "  paymentCode=$($diag.paymentCode) referencePresent=$($diag.referencePresent)"
    Write-Host "  fieldNames=$($diag.fieldNames -join ',')"
    foreach ($c in $diag.formulaCandidates) {
      Write-Host "  candidate $($c.formulaName) prefix=$($c.computedSignaturePrefix)"
    }
  }
}