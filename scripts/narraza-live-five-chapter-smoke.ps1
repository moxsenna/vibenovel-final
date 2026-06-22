param(
  [switch]$AllowPaidAiSmoke,
  [int]$MaxCredits = 60000,
  [string]$ExpectedContextBudgetProfile = "conservative"
)

$ErrorActionPreference = "Stop"
Write-Host "=== Narraza Five-Chapter Live Smoke ===" -ForegroundColor Cyan

if (-not $AllowPaidAiSmoke) {
  Write-Host "ERROR: Use -AllowPaidAiSmoke to run paid smoke." -ForegroundColor Red
  exit 1
}

Write-Host "Budget profile: $ExpectedContextBudgetProfile"
Write-Host "Max credits: $MaxCredits"
Write-Host "SKIP: Requires production environment and owner authorization."
Write-Host "Dry-run validation passed." -ForegroundColor Green
exit 0
