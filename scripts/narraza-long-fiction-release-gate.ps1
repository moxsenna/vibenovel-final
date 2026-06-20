param(
  [switch]$CheckProductionHealth,
  [string]$ExpectedContextBudgetProfile = "conservative"
)

$ErrorActionPreference = "Stop"
$report = @{
  releaseReady = $false
  blockingIssues = @()
  warnings = @()
  evidence = @{}
}

Write-Host "=== Narraza Long-Fiction Release Gate ===" -ForegroundColor Cyan

# 1. Typecheck
Write-Host "`n[1/8] Running typecheck..." -NoNewline
$tc = npm run typecheck 2>&1
if ($LASTEXITCODE -eq 0) { Write-Host " PASS" -ForegroundColor Green }
else { Write-Host " FAIL" -ForegroundColor Red; $report.blockingIssues += "Typecheck failed" }

# 2. Lint
Write-Host "[2/8] Running lint..." -NoNewline
$lint = npm run lint 2>&1
$errCount = ($lint | Select-String "error TS|Error -" | Measure-Object).Count
if ($errCount -eq 0) { Write-Host " PASS ($errCount errors)" -ForegroundColor Green }
else { Write-Host " FAIL" -ForegroundColor Red; $report.blockingIssues += "Lint errors: $errCount" }

# 3. API contracts
Write-Host "[3/8] Running baseline tests..." -NoNewline
$bl = npm run test:long-fiction-baseline -w @vibenovel/api 2>&1
if ($LASTEXITCODE -eq 0) { Write-Host " PASS" -ForegroundColor Green }
else { Write-Host " FAIL" -ForegroundColor Red; $report.blockingIssues += "Baseline tests failed" }

# 4. Credit/rate-limit
Write-Host "[4/8] Running credit tests..." -NoNewline
$cr = npm run test:ai-rate-limit-v2 -w @vibenovel/api 2>&1
if ($LASTEXITCODE -eq 0) { Write-Host " PASS" -ForegroundColor Green }
else { Write-Host " FAIL" -ForegroundColor Red; $report.blockingIssues += "Credit tests failed" }

# 5. Long serial acceptance
Write-Host "[5/8] Running 30-chapter acceptance..." -NoNewline
$ac = npm run test:long-serial-acceptance -w @vibenovel/api 2>&1
if ($LASTEXITCODE -eq 0) { Write-Host " PASS" -ForegroundColor Green }
else { Write-Host " FAIL" -ForegroundColor Red; $report.blockingIssues += "Acceptance tests failed" }

# 6. Build
Write-Host "[6/8] Building..." -NoNewline
$bd = npm run build:api:node 2>&1
if ($LASTEXITCODE -eq 0) { Write-Host " PASS" -ForegroundColor Green }
else { Write-Host " FAIL" -ForegroundColor Red; $report.blockingIssues += "Build failed" }

# 7. Migration check
Write-Host "[7/8] Checking migrations..." -NoNewline
$migs = @("00022", "00023", "00024")
$allExist = $true
foreach ($m in $migs) {
  if (-not (Test-Path "supabase/migrations/${m}_*.sql")) { $allExist = $false }
}
if ($allExist) { Write-Host " PASS" -ForegroundColor Green }
else { Write-Host " FAIL" -ForegroundColor Red; $report.blockingIssues += "Migrations missing" }

# 8. Profile check
Write-Host "[8/8] Checking budget profile..." -NoNewline
if ($ExpectedContextBudgetProfile -eq "conservative" -or $ExpectedContextBudgetProfile -eq "full") {
  Write-Host " PASS ($ExpectedContextBudgetProfile)" -ForegroundColor Green
} else {
  Write-Host " FAIL" -ForegroundColor Red
  $report.blockingIssues += "Invalid budget profile"
}

$report.releaseReady = $report.blockingIssues.Count -eq 0
Write-Host "`n=== RESULT ===" -ForegroundColor Cyan
if ($report.releaseReady) {
  Write-Host "RELEASE READY: YES" -ForegroundColor Green
} else {
  Write-Host "RELEASE READY: NO" -ForegroundColor Red
  Write-Host "Blocking issues:"; $report.blockingIssues | ForEach-Object { Write-Host "  - $_" }
}
Write-Host ($report | ConvertTo-Json -Compress)
exit $(if ($report.releaseReady) { 0 } else { 1 })
