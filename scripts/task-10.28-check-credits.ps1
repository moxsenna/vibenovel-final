Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot "lib\staging-smoke-common.ps1")
Import-DotEnvFile -Path (Join-Path $RepoRoot ".env.production")
$sbUrl = $env:SUPABASE_URL.Trim().TrimEnd("/")
$srk = $env:SUPABASE_SERVICE_ROLE_KEY
$userId = "abdc5016-ac92-4219-acea-85df829e4334"
$h = @{ apikey = $srk; Authorization = "Bearer $srk" }
$bal = Invoke-RestMethod -Uri "$sbUrl/rest/v1/credit_balances?user_id=eq.$userId&select=balance" -Headers $h
Write-Host "Balance: $($bal[0].balance)"
$attempts = Invoke-RestMethod -Uri "$sbUrl/rest/v1/generation_attempts?user_id=eq.$userId&order=created_at.desc&limit=3&select=status,error_code,provider,model,credit_cost,created_at" -Headers $h
foreach ($a in $attempts) {
  Write-Host "Attempt: $($a.created_at) status=$($a.status) err=$($a.error_code) model=$($a.model) cost=$($a.credit_cost)"
}
$ledger = Invoke-RestMethod -Uri "$sbUrl/rest/v1/credit_ledger?user_id=eq.$userId&order=created_at.desc&limit=6&select=direction,reason,amount,balance_after,created_at" -Headers $h
foreach ($l in $ledger) {
  Write-Host "Ledger: $($l.created_at) $($l.direction) $($l.reason) amt=$($l.amount) after=$($l.balance_after)"
}