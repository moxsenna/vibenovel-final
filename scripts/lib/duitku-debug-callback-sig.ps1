# Debug real Duitku callback signature mismatch (never logs merchant key)
param([string]$WebhookId = "aec05267-6551-4ff9-b737-34feab441dc0")
Set-StrictMode -Version Latest
$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
. (Join-Path (Split-Path -Parent $PSScriptRoot) "lib\staging-smoke-common.ps1")
Import-StagingSupabaseEnv -RepoRoot $RepoRoot
Import-DotEnvFile -Path (Join-Path $RepoRoot ".env.staging.duitku")
$code = [Environment]::GetEnvironmentVariable("DUITKU_MERCHANT_CODE")
$key = [Environment]::GetEnvironmentVariable("DUITKU_MERCHANT_KEY")
$sr = Get-StagingSupabaseCredential "STAGING_SUPABASE_SERVICE_ROLE_KEY"
$base = Get-StagingSupabaseCredential "STAGING_SUPABASE_URL"
$w = (Invoke-RestMethod -Uri "$base/rest/v1/payment_webhook_events?id=eq.$WebhookId&select=payload_safe_json,error_message_safe" -Headers @{ apikey=$sr; Authorization="Bearer $sr" })[0]
$p = $w.payload_safe_json
$merchantOrderId = [string]$p.merchantOrderId
$amount = [string]$p.amount
$merchantCode = [string]$p.merchantCode
function Get-Md5Prefix([string]$Text) {
  $md5 = [System.Security.Cryptography.MD5]::Create()
  try {
    $hash = $md5.ComputeHash([Text.Encoding]::UTF8.GetBytes($Text))
    return ([BitConverter]::ToString($hash) -replace '-', '').ToLower().Substring(0, 8)
  } finally {
    $md5.Dispose()
  }
}
Write-Host "error=$($w.error_message_safe)"
Write-Host "merchantCode=$merchantCode amount=$amount merchantOrderId=$merchantOrderId"
Write-Host "expected_sig_prefix=$(Get-Md5Prefix "$merchantCode$amount$merchantOrderId$key")... local_key_len=$($key.Length) code_match=$(if ($merchantCode -eq $code) { 'yes' } else { 'no' })"
$ref = [string]$p.reference
$variants = @(
  @{ name = "std"; s = "$merchantCode$amount$merchantOrderId$key" },
  @{ name = "ref_suffix"; s = "$merchantCode$amount$merchantOrderId$ref$key" },
  @{ name = "order_amount_swap"; s = "$merchantCode$merchantOrderId$amount$key" },
  @{ name = "ref_only"; s = "$merchantCode$amount$ref$key" }
)
foreach ($v in $variants) {
  Write-Host "variant $($v.name) prefix=$(Get-Md5Prefix $v.s)..."
}