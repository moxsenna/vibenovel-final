<#
.SYNOPSIS
  Task 10.5/10.8 — Mayar sandbox live smoke (invoice create + optional webhook capture).

.DESCRIPTION
  Run from repo root:
    npm run smoke:api:sprint10:mayar-live

  Prerequisites (manual — never commit secrets):
    1. supabase start && npm run dev:api
    2. apps/api/.dev.vars (gitignored):
         CREDIT_TOPUP_ENABLED=true
         PAYMENT_PROVIDER_MOCK=false
         MAYAR_ENV=sandbox
         MAYAR_API_KEY=<sandbox key from web.mayar.club>
         MAYAR_BASE_URL=https://api.mayar.club/hl/v1
         MAYAR_REDIRECT_BASE_URL=http://localhost:5173
    3. Restart dev:api after env change

  This script NEVER reads or prints MAYAR_API_KEY. It probes /api/health booleans only.
  For real webhook delivery, register a public URL (staging/tunnel) in Mayar sandbox dashboard.
  Do NOT change production Siklusio Mayar dashboard URL.

  After test, rollback .dev.vars:
    PAYMENT_PROVIDER_MOCK=true
    PAYMENT_PROVIDER_MOCK_MODE=success
    (optional) CREDIT_TOPUP_ENABLED=false
#>
[CmdletBinding()]
param(
  [string]$ApiBaseUrl = "http://127.0.0.1:8787",
  [string]$SupabaseUrl = "http://127.0.0.1:54321",
  [string]$SupabaseAnonKey = "",
  [string]$TestEmail = "",
  [string]$TestPassword = "VibeNovel-Local-Smoke-Test!",
  [switch]$SkipInvoiceCreate,
  [switch]$SkipRollbackProbe
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Continue"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$Results = New-Object System.Collections.Generic.List[object]
$StepNumber = 0
$auth = @{}
$script:UserId = $null
$script:ServiceRoleKey = $null

function Add-StepResult {
  param([string]$Name, [ValidateSet("PASS", "FAIL", "SKIP", "NOT RUN", "PARTIAL")][string]$Result, [string]$Detail = "")
  $script:StepNumber++
  $Results.Add([PSCustomObject]@{ Step = $script:StepNumber; Test = $Name; Result = $Result; Detail = $Detail }) | Out-Null
  $color = switch ($Result) {
    "PASS" { "Green" }
    "FAIL" { "Red" }
    "PARTIAL" { "Yellow" }
    default { "Yellow" }
  }
  Write-Host ("[{0}] {1,-52} {2}" -f $Result, $Name, $Detail) -ForegroundColor $color
}

function Get-SafeDetail {
  param([string]$Text)
  if ([string]::IsNullOrWhiteSpace($Text)) { return "" }
  $s = $Text -replace 'Bearer\s+[A-Za-z0-9._-]+', 'Bearer [redacted]'
  $s = $s -replace 'eyJ[A-Za-z0-9._-]{20,}', '[jwt-redacted]'
  $s = $s -replace 'MAYAR_API_KEY', '[mayar-key-redacted]'
  if ($s.Length -gt 140) { return $s.Substring(0, 137) + "..." }
  return $s
}

function Resolve-SupabaseAnonKey {
  if (-not [string]::IsNullOrWhiteSpace($SupabaseAnonKey)) { return $SupabaseAnonKey.Trim() }
  Push-Location $RepoRoot
  try {
    foreach ($line in (& supabase status -o env 2>$null)) {
      if ($line -match '^ANON_KEY="(.+)"\s*$') { return $Matches[1] }
    }
  } finally { Pop-Location }
  throw "Supabase anon key not found."
}

function Resolve-ServiceRoleKey {
  if ($script:ServiceRoleKey) { return $script:ServiceRoleKey }
  Push-Location $RepoRoot
  try {
    foreach ($line in (& supabase status -o env 2>$null)) {
      if ($line -match '^SERVICE_ROLE_KEY="(.+)"\s*$') {
        $script:ServiceRoleKey = $Matches[1]
        return $script:ServiceRoleKey
      }
    }
  } finally { Pop-Location }
  throw "Supabase service role key not found."
}

function Get-ApiHealth {
  try {
    return Invoke-RestMethod -Uri "$ApiBaseUrl/api/health" -Method GET -TimeoutSec 10
  } catch { return $null }
}

function Invoke-Api {
  param(
    [ValidateSet("GET", "POST")][string]$Method = "GET",
    [Parameter(Mandatory)][string]$Path,
    [hashtable]$Headers = @{},
    [string]$Body = $null
  )
  $uri = "$ApiBaseUrl$Path"
  $params = @{ Method = $Method; Uri = $uri; Headers = $Headers; TimeoutSec = 45 }
  if ($Body) { $params.Body = $Body; $params.ContentType = "application/json" }
  return Invoke-RestMethod @params
}

function Get-CreditBalance {
  param([string]$UserId)
  $srk = Resolve-ServiceRoleKey
  $rows = Invoke-RestMethod -Uri "$SupabaseUrl/rest/v1/credit_balances?user_id=eq.$UserId&select=balance" `
    -Headers @{ apikey = $srk; Authorization = "Bearer $srk" } -Method GET
  if ($rows -is [array] -and $rows.Count -gt 0) { return [int]$rows[0].balance }
  return 0
}

function Get-LedgerTopupCount {
  param([string]$UserId)
  $srk = Resolve-ServiceRoleKey
  $rows = Invoke-RestMethod -Uri "$SupabaseUrl/rest/v1/credit_ledger?user_id=eq.$UserId&reason=eq.credit_topup&direction=eq.credit&select=id" `
    -Headers @{ apikey = $srk; Authorization = "Bearer $srk" } -Method GET
  if ($rows -is [array]) { return $rows.Count }
  return 0
}

function Test-ResponseSafe {
  param([string]$Json)
  $bad = @("MAYAR_API_KEY", "MAYAR_WEBHOOK_TOKEN", "OPENROUTER_API_KEY", "service_role")
  foreach ($pat in $bad) {
    if ($Json -match [regex]::Escape($pat)) { return $false }
  }
  return $true
}

function Add-LiveBlockedSteps {
  param([string]$Reason)
  Add-StepResult "live invoice create" "NOT RUN" $Reason
  Add-StepResult "live paid webhook grant" "NOT RUN" "requires real Mayar invoice + webhook"
  Add-StepResult "live duplicate replay" "NOT RUN" "requires captured live payload"
  Add-StepResult "siklusio router live" "NOT RUN" "requires staging tunnel + router enabled"
}

Write-Host "`nTask 10.8 - Mayar Staging Live Smoke" -ForegroundColor Cyan
Write-Host "API: $ApiBaseUrl"
Write-Host "Never logs secrets.`n"

$health = Get-ApiHealth
if (-not $health -or $health.ok -ne $true) {
  Add-StepResult "API health" "FAIL" "start dev:api first"
  exit 1
}
Add-StepResult "API health" "PASS" "ok=true"

$envFlags = $health.data.env
$hasKey = [bool]$envFlags.hasMayarApiKey
$topupOn = [bool]$envFlags.creditTopupEnabled
$mockOn = [bool]$envFlags.paymentProviderMock
$mayarEnv = [string]$envFlags.mayarEnv
Add-StepResult "env booleans" "PASS" "hasMayarApiKey=$hasKey creditTopupEnabled=$topupOn paymentProviderMock=$mockOn mayarEnv=$mayarEnv"

$canRunLive = $topupOn -and (-not $mockOn) -and $hasKey -and (-not $SkipInvoiceCreate)

if (-not $topupOn) {
  Add-LiveBlockedSteps "CREDIT_TOPUP_ENABLED=false"
} elseif ($mockOn) {
  Add-LiveBlockedSteps "PAYMENT_PROVIDER_MOCK=true - set false + restart dev:api"
} elseif (-not $hasKey) {
  Add-LiveBlockedSteps "hasMayarApiKey=false — add MAYAR_API_KEY to .dev.vars (gitignored)"
} elseif ($SkipInvoiceCreate) {
  Add-StepResult "live invoice create" "SKIP" "-SkipInvoiceCreate"
  Add-StepResult "live paid webhook grant" "NOT RUN" "requires real Mayar invoice + webhook"
  Add-StepResult "live duplicate replay" "NOT RUN" "requires captured live payload"
  Add-StepResult "siklusio router live" "NOT RUN" "requires staging"
} elseif ($canRunLive) {
  try {
    $anon = Resolve-SupabaseAnonKey
    if ([string]::IsNullOrWhiteSpace($TestEmail)) {
      $TestEmail = "s10live-$(Get-Random -Maximum 99999999)@example.com"
    }
    Invoke-RestMethod -Uri "$SupabaseUrl/auth/v1/signup" -Method POST `
      -Headers @{ apikey = $anon; Authorization = "Bearer $anon" } `
      -ContentType "application/json" `
      -Body (@{ email = $TestEmail; password = $TestPassword } | ConvertTo-Json) | Out-Null
    $login = Invoke-RestMethod -Uri "$SupabaseUrl/auth/v1/token?grant_type=password" -Method POST `
      -Headers @{ apikey = $anon } -ContentType "application/json" `
      -Body (@{ email = $TestEmail; password = $TestPassword } | ConvertTo-Json)
    $token = $login.access_token
    $auth = @{ Authorization = "Bearer $token" }
    $me = Invoke-Api -Path "/api/me" -Headers $auth
    $script:UserId = $me.data.user.id
    Add-StepResult "signup/login" "PASS" "email=$TestEmail"

    $balanceBefore = Get-CreditBalance -UserId $script:UserId
    $ledgerBefore = Get-LedgerTopupCount -UserId $script:UserId
    $idem = "s10live-$(Get-Random)"
    $checkout = Invoke-Api -Method POST -Path "/api/credits/topup/checkout" -Headers $auth -Body (@{
      productSlug = "starter"; idempotencyKey = $idem
    } | ConvertTo-Json -Compress)
    $json = $checkout | ConvertTo-Json -Depth 8
    $order = $checkout.data.order
    $safe = Test-ResponseSafe $json
    $domain = ""
    if ($checkout.data.paymentUrl -match '^https?://([^/]+)') { $domain = $Matches[1] }
    $ok = (
      $safe -and
      $order.provider -eq "mayar" -and
      $order.status -eq "pending" -and
      $order.amountIdr -eq 39000 -and
      $order.providerInvoiceId -and
      $order.providerTransactionId -and
      $checkout.data.paymentUrl -and
      ($checkout.data.paymentUrl -notmatch "mock-return")
    )
    $balanceAfter = Get-CreditBalance -UserId $script:UserId
    $ledgerAfter = Get-LedgerTopupCount -UserId $script:UserId
    $noGrant = ($balanceAfter -eq $balanceBefore -and $ledgerAfter -eq $ledgerBefore)
    if ($ok -and $noGrant) {
      Add-StepResult "live invoice create" "PASS" "provider=mayar domain=$domain"
    } elseif ($ok) {
      Add-StepResult "live invoice create" "PARTIAL" "checkout ok but balance/ledger changed unexpectedly"
    } else {
      Add-StepResult "live invoice create" "FAIL" "missing mayar fields or unsafe response"
    }
    Add-StepResult "live no pre-grant mutation" $(if ($noGrant) { "PASS" } else { "FAIL" }) "balance=$balanceAfter ledger=$ledgerAfter"
  } catch {
    Add-StepResult "live invoice create" "FAIL" (Get-SafeDetail $_.Exception.Message)
    Add-StepResult "live no pre-grant mutation" "NOT RUN" "checkout failed"
  }
  Add-StepResult "live paid webhook grant" "NOT RUN" "complete sandbox payment manually; capture webhook in docs/54"
  Add-StepResult "live duplicate replay" "NOT RUN" "replay captured payload after grant test"
  Add-StepResult "siklusio router live" "NOT RUN" "requires staging — not run without explicit approval"
}

if (-not $SkipRollbackProbe) {
  $healthAfter = Get-ApiHealth
  if ($healthAfter) {
    Add-StepResult "rollback probe health" "PASS" "manual rollback documented in docs/52"
  }
}

Write-Host ""
$pass = @($Results | Where-Object { $_.Result -eq "PASS" }).Count
$fail = @($Results | Where-Object { $_.Result -eq "FAIL" }).Count
$other = @($Results | Where-Object { $_.Result -in @("NOT RUN", "SKIP", "PARTIAL") }).Count
Write-Host ("Summary: PASS={0} FAIL={1} NOT RUN/SKIP/PARTIAL={2}" -f $pass, $fail, $other) -ForegroundColor $(if ($fail -gt 0) { "Red" } else { "Green" })
Write-Host ""
Write-Host "Rollback: PAYMENT_PROVIDER_MOCK=true, optional CREDIT_TOPUP_ENABLED=false, restart dev:api" -ForegroundColor Yellow
Write-Host "Report: docs/54-mayar-staging-live-execution-report.md" -ForegroundColor Cyan

if ($fail -gt 0) { exit 1 }
exit 0