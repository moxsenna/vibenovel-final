# Replay sanitized real ShopeePay callback shape with invalid signature (Task 10.13c diagnostic)
param(
  [string]$OrderId = "2fbe48f5-de17-4f5b-850a-23d1d07179c8",
  [string]$Reference = "DS3157626EIZETCR5Q2OD3SP",
  [string]$ApiBaseUrl = "https://api-staging.narraza.web.id",
  [string]$RepoRoot = ""
)
Set-StrictMode -Version Latest
if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
  $RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
}
. (Join-Path (Split-Path -Parent $PSScriptRoot) "lib\staging-smoke-common.ps1")
Import-DotEnvFile -Path (Join-Path $RepoRoot ".env.staging.duitku")
$code = [Environment]::GetEnvironmentVariable("DUITKU_MERCHANT_CODE")
if ([string]::IsNullOrWhiteSpace($code)) { throw "missing merchant code" }
$form = @(
  "merchantCode=$([uri]::EscapeDataString($code))"
  "amount=39000"
  "merchantOrderId=$([uri]::EscapeDataString($OrderId))"
  "productDetail=$([uri]::EscapeDataString('Top Up Kredit VibeNovel - Paket Starter'))"
  "resultCode=00"
  "reference=$([uri]::EscapeDataString($Reference))"
  "paymentCode=SP"
  "signature=0000000000000000000000000000000000000000000000000000000000000000"
) -join "&"
$resp = Invoke-RestMethod -Uri "$ApiBaseUrl/api/payments/duitku/callback" -Method POST `
  -ContentType "application/x-www-form-urlencoded" -Body $form -TimeoutSec 45
Write-Host "reason=$($resp.data.reason) failed=$($resp.data.failed) webhook=$($resp.data.webhookEventId)"
if ($resp.data.reason -ne "invalid_signature") { exit 1 }
exit 0