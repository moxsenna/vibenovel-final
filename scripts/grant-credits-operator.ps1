<#
.SYNOPSIS
  Operator grant credits to a user by email (production .env.production).
#>
[CmdletBinding()]
param(
  [string]$Email = "moxsenna@gmail.com",
  [int]$Amount = 100000,
  [string]$IdempotencyKey = "admin-manual-grant-100k-2026-06-20"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot "lib\staging-smoke-common.ps1")
Import-DotEnvFile -Path (Join-Path $RepoRoot ".env.production")

$sbUrl = $env:SUPABASE_URL.Trim().TrimEnd("/")
$srk = $env:SUPABASE_SERVICE_ROLE_KEY
if ([string]::IsNullOrWhiteSpace($sbUrl) -or [string]::IsNullOrWhiteSpace($srk)) {
  throw "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.production"
}

$adminH = @{
  apikey         = $srk
  Authorization  = "Bearer $srk"
  "Content-Type" = "application/json"
}

$users = Invoke-RestMethod -Uri "$sbUrl/auth/v1/admin/users?per_page=500" -Headers $adminH
$founder = $users.users | Where-Object { $_.email -eq $Email } | Select-Object -First 1
if (-not $founder) { throw "User not found: $Email" }
$userId = $founder.id
Write-Host "User: $Email id=$userId"

$dup = Invoke-RestMethod -Uri "$sbUrl/rest/v1/credit_ledger?user_id=eq.$userId&metadata->>idempotencyKey=eq.$IdempotencyKey&select=id" -Headers $adminH
if ($dup -and @($dup).Count -gt 0) {
  $b = Invoke-RestMethod -Uri "$sbUrl/rest/v1/credit_balances?user_id=eq.$userId&select=balance" -Headers $adminH
  Write-Host "Already granted (idempotencyKey=$IdempotencyKey). balance=$($b[0].balance)"
  exit 0
}

# Atomic grant: the balance upsert and ledger insert happen in one transaction
# inside grant_operator_credit_atomic (migration 00026). Doing them as two
# separate PostgREST writes risked bumping the balance and then failing the
# ledger write, which left no idempotency row and double-granted on rerun.
$rpcH = $adminH.Clone()
$rpcBody = @{
  p_user_id         = $userId
  p_amount          = $Amount
  p_idempotency_key = $IdempotencyKey
  p_reason          = "welcome_bonus"
  p_note            = "Manual operator grant +$Amount"
} | ConvertTo-Json

$result = Invoke-RestMethod -Uri "$sbUrl/rest/v1/rpc/grant_operator_credit_atomic" -Method POST -Headers $rpcH -Body $rpcBody

if ($result.already_granted) {
  Write-Host "Already granted (idempotencyKey=$IdempotencyKey). balance=$($result.new_balance)"
} elseif ($result.granted) {
  Write-Host "OK: $($result.previous_balance) -> $($result.new_balance) (+$Amount credits)"
} else {
  throw "Grant did not complete: $($result | ConvertTo-Json -Compress)"
}