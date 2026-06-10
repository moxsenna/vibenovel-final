# Attempt Duitku sandbox payment completion for latest pending order (Task 10.13b)
# Never logs merchant key or full sensitive URLs in stdout.
param(
  [string]$ApiBaseUrl = "https://api-staging.narraza.web.id",
  [string]$TestEmail = "staging-smoke@vibenovel.test",
  [string]$TestPassword = "VibeNovel-Staging-Smoke-Test!"
)
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
. (Join-Path (Split-Path -Parent $PSScriptRoot) "lib\staging-smoke-common.ps1")
Import-StagingSupabaseEnv -RepoRoot $RepoRoot
$supabaseUrl = Get-StagingSupabaseCredential "STAGING_SUPABASE_URL"
$anon = Get-StagingSupabaseCredential "STAGING_SUPABASE_ANON_KEY"
$sr = Get-StagingSupabaseCredential "STAGING_SUPABASE_SERVICE_ROLE_KEY"
if (-not $supabaseUrl -or -not $anon -or -not $sr) { throw "missing staging supabase env" }

$login = Invoke-RestMethod -Uri "$supabaseUrl/auth/v1/token?grant_type=password" -Method POST `
  -Headers @{ apikey = $anon } -ContentType "application/json" `
  -Body (@{ email = $TestEmail; password = $TestPassword } | ConvertTo-Json)
$token = $login.access_token
$me = Invoke-RestMethod -Uri "$ApiBaseUrl/api/me" -Headers @{ Authorization = "Bearer $token" }
$userId = $me.data.user.id

$orders = Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/credit_topup_orders?user_id=eq.$userId&status=eq.pending&provider=eq.duitku&select=id,amount_idr,credits_to_grant,payment_url,provider_transaction_id&order=created_at.desc&limit=1" `
  -Headers @{ apikey = $sr; Authorization = "Bearer $sr" }
if (-not $orders -or $orders.Count -lt 1) { throw "no pending duitku order" }
$order = $orders[0]
Write-Host "Pending order id=$($order.id) amount=$($order.amount_idr) ref=$($order.provider_transaction_id)"

$paymentUrl = [string]$order.payment_url
if ([string]::IsNullOrWhiteSpace($paymentUrl)) { throw "no payment_url" }
$domain = ([Uri]$paymentUrl).Host
Write-Host "Opening Duitku sandbox host=$domain (URL not logged)"

# Fetch checkout page
$page = curl.exe -sS -L --max-time 45 $paymentUrl
if ($LASTEXITCODE -ne 0) { throw "failed to fetch payment page" }
Write-Host "Payment page bytes=$($page.Length)"

# Try common sandbox completion patterns in HTML
if ($page -match 'sandbox|simulat|test', 'IgnoreCase') { Write-Host "Page appears sandbox/test oriented" }

# Poll order status up to 90s for callback
for ($i = 1; $i -le 18; $i++) {
  Start-Sleep -Seconds 5
  $row = Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/credit_topup_orders?id=eq.$($order.id)&select=status&limit=1" `
    -Headers @{ apikey = $sr; Authorization = "Bearer $sr" }
  $status = $row[0].status
  Write-Host "Poll $i status=$status"
  if ($status -eq "paid") { Write-Host "PASS order paid via callback"; exit 0 }
}

Write-Host "Order still pending - manual payment in Duitku UI may be required"
exit 2