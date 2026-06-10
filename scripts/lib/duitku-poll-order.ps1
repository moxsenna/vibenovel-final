param([string]$OrderId = "0c0818e1-e081-4d83-872f-cf9f200714a3")
. (Join-Path (Split-Path -Parent $PSScriptRoot) "lib\staging-smoke-common.ps1")
Import-StagingSupabaseEnv -RepoRoot (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
$sr = Get-StagingSupabaseCredential "STAGING_SUPABASE_SERVICE_ROLE_KEY"
$url = Get-StagingSupabaseCredential "STAGING_SUPABASE_URL"
$uri = "$url/rest/v1/credit_topup_orders?id=eq.$OrderId&select=id,status,payment_url,provider_transaction_id,amount_idr,credits_to_grant"
$row = Invoke-RestMethod -Uri $uri -Headers @{ apikey = $sr; Authorization = "Bearer $sr" }
$balUri = "$url/rest/v1/credit_balances?user_id=eq.$(
  (Invoke-RestMethod -Uri "$url/rest/v1/credit_topup_orders?id=eq.$OrderId&select=user_id" -Headers @{ apikey=$sr; Authorization="Bearer $sr" })[0].user_id
)&select=balance"
$bal = Invoke-RestMethod -Uri $balUri -Headers @{ apikey = $sr; Authorization = "Bearer $sr" }
Write-Host "order status=$($row[0].status) amount=$($row[0].amount_idr) ref=$($row[0].provider_transaction_id) balance=$($bal[0].balance)"
if ($row[0].payment_url) { Write-Host "payment_host=$(([Uri]$row[0].payment_url).Host)" }