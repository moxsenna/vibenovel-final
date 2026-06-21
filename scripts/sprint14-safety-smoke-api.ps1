<#
.SYNOPSIS
  Sprint 14 safety hardening smoke.

.DESCRIPTION
  Runs local API contract checks for output validation, explicit safe repair,
  daily cap/cooldown guard, and validation migration coverage.
#>
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $RepoRoot
try {
  Write-Host "Sprint 14 safety contracts..." -ForegroundColor Cyan
  npm run test:sprint14-safety -w '@vibenovel/api'
  if ($LASTEXITCODE -ne 0) {
    throw "Sprint 14 safety contracts failed"
  }
  Write-Host "PASS Sprint 14 safety smoke" -ForegroundColor Green
} finally {
  Pop-Location
}
