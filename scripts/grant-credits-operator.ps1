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

$balRows = @(Invoke-RestMethod -Uri "$sbUrl/rest/v1/credit_balances?user_id=eq.$userId&select=balance,user_id" -Headers $adminH)
$before = 0
if ($balRows.Count -gt 0) { $before = [int]$balRows[0].balance }
$after = $before + $Amount

if ($balRows.Count -gt 0) {
  $patchH = $adminH.Clone()
  $patchH.Prefer = "return=minimal"
  $patch = @{ balance = $after; source = "admin_grant" } | ConvertTo-Json
  Invoke-RestMethod -Uri "$sbUrl/rest/v1/credit_balances?user_id=eq.$userId" -Method PATCH -Headers $patchH -Body $patch | Out-Null
} else {
  $postH = $adminH.Clone()
  $postH.Prefer = "return=minimal"
  $body = @{
    user_id       = $userId
    balance       = $after
    monthly_quota = 0
    monthly_used  = 0
    source        = "admin_grant"
  } | ConvertTo-Json
  Invoke-RestMethod -Uri "$sbUrl/rest/v1/credit_balances" -Method POST -Headers $postH -Body $body | Out-Null
}

$ledgerH = $adminH.Clone()
$ledgerH.Prefer = "return=minimal"
$ledgerBody = @{
  user_id       = $userId
  amount        = $Amount
  direction     = "credit"
  reason        = "welcome_bonus"
  balance_after = $after
  metadata      = @{
    idempotencyKey = $IdempotencyKey
    note           = "Manual operator grant +$Amount"
    grantedBy      = "grant-credits-operator.ps1"
  }
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Uri "$sbUrl/rest/v1/credit_ledger" -Method POST -Headers $ledgerH -Body $ledgerBody | Out-Null
Write-Host "OK: $before -> $after (+$Amount credits)"