<#
.SYNOPSIS
  Sprint 9 credit UI web E2E smoke (Task 9.2).

.DESCRIPTION
  Run from repo root:
    npm run smoke:web:credit-ui

  Prerequisites:
    - npm install (includes @playwright/test)
    - npx playwright install chromium
    - npm run dev:web with VITE_USE_MOCKS=true (default)
#>
[CmdletBinding()]
param(
  [string]$WebBaseUrl = "http://localhost:5173"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Continue"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$WebDir = Join-Path $RepoRoot "apps\web"

Write-Host "`nVibeNovel Sprint 9 Credit UI Web Smoke Test" -ForegroundColor Cyan
Write-Host "Web: $WebBaseUrl"

Push-Location $WebDir
try {
  $env:PLAYWRIGHT_BASE_URL = $WebBaseUrl
  npx playwright test e2e/sprint9-credit-ui.spec.ts --reporter=line
  if ($LASTEXITCODE -ne 0) { exit 1 }
} finally {
  Pop-Location
}

Write-Host "Summary: PASS" -ForegroundColor Green
exit 0