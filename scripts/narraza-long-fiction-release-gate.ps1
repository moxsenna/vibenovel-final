[CmdletBinding()]
param(
  [ValidateSet("private-beta", "public")]
  [string]$ReleaseScope = "public",
  [ValidateSet("conservative", "full")]
  [string]$ExpectedContextBudgetProfile = "conservative",
  [ValidateSet("off", "shadow", "enforce")]
  [string]$ExpectedSemanticJudgeMode = "enforce",
  [switch]$CheckProductionHealth,
  [string]$ProductionApiBaseUrl = "https://api.narraza.web.id",
  [string]$FiveChapterArtifact = "",
  [string]$ThirtyChapterReport = "",
  [string]$OutputPath = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
if (-not $OutputPath) { $OutputPath = Join-Path $repoRoot "artifacts\long-fiction\release-gate-$stamp.json" }

$report = [ordered]@{
  schemaVersion = 2
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  releaseScope = $ReleaseScope
  releaseReady = $false
  blockingIssues = @()
  warnings = @()
  evidence = [ordered]@{}
  commandChecks = @()
}

function Add-Blocker([string]$Message) {
  $report.blockingIssues += $Message
}

function Save-GateReport {
  $directory = Split-Path -Parent $OutputPath
  New-Item -ItemType Directory -Path $directory -Force | Out-Null
  $report | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $OutputPath -Encoding utf8
}

function Invoke-GateCommand {
  param([string]$Name, [string]$Command)
  Write-Host "[$Name] $Command" -ForegroundColor Cyan
  $started = Get-Date
  $output = & powershell -NoProfile -Command $Command 2>&1
  $exitCode = $LASTEXITCODE
  $entry = [ordered]@{
    name = $Name
    command = $Command
    exitCode = $exitCode
    durationMs = [int]((Get-Date) - $started).TotalMilliseconds
    status = if ($exitCode -eq 0) { "pass" } else { "fail" }
    outputTail = @($output | Select-Object -Last 12 | ForEach-Object { "$_" })
  }
  $report.commandChecks += $entry
  if ($exitCode -ne 0) {
    Add-Blocker "$Name failed"
    return $false
  }
  return $true
}

Push-Location $repoRoot
try {
  $commands = @(
    @{ name = "typecheck"; command = "npm run typecheck" },
    @{ name = "lint"; command = "npm run lint -- --quiet" },
    @{ name = "api-contracts"; command = "npm run test:api:contracts" },
    @{ name = "credit-v2"; command = "npm run test:credit-v2" },
    @{ name = "long-serial-acceptance"; command = "npm run test:long-serial-acceptance -w @vibenovel/api" },
    @{ name = "generation-observability"; command = "npm run test:generation-observability -w @vibenovel/api" },
    @{ name = "marketing-claims"; command = "npm run test:marketing-claims -w @vibenovel/api" },
    @{ name = "no-production-stubs"; command = "npm run smoke:no-prod-stubs" },
    @{ name = "docs-drift"; command = "npm run check:docs-drift" },
    @{ name = "build-api-node"; command = "npm run build:api:node" },
    @{ name = "build-web"; command = "npm run build:web" }
  )
  foreach ($item in $commands) {
    if (-not (Invoke-GateCommand -Name $item.name -Command $item.command)) {
      break
    }
  }

  $migrationPrefixes = @("00022", "00023", "00024", "00025", "00026")
  $migrationEvidence = @()
  foreach ($prefix in $migrationPrefixes) {
    $matches = @(Get-ChildItem "supabase/migrations/${prefix}_*.sql" -ErrorAction SilentlyContinue)
    $valid = $matches.Count -eq 1 -and $matches[0].Length -gt 20
    $migrationEvidence += [ordered]@{
      prefix = $prefix
      count = $matches.Count
      file = if ($matches.Count -eq 1) { $matches[0].Name } else { $null }
      nonEmpty = $valid
    }
    if (-not $valid) { Add-Blocker "Migration $prefix must exist exactly once and contain real SQL" }
  }
  $report.evidence.migrations = $migrationEvidence

  $report.evidence.expectedContextBudgetProfile = $ExpectedContextBudgetProfile
  $report.evidence.expectedSemanticJudgeMode = $ExpectedSemanticJudgeMode
  if ($ReleaseScope -eq "public" -and $ExpectedSemanticJudgeMode -ne "enforce") {
    Add-Blocker "Public release requires SEMANTIC_JUDGE_MODE=enforce"
  }

  if ($ExpectedContextBudgetProfile -eq "full") {
    if (-not $FiveChapterArtifact) {
      Add-Blocker "Full context profile requires five-chapter activation artifact"
    }
    $report.evidence.fullProfileActivationRequired = $true
  }

  if ($CheckProductionHealth) {
    try {
      $health = Invoke-RestMethod -Uri "$($ProductionApiBaseUrl.TrimEnd('/'))/api/health" -TimeoutSec 30
      $report.evidence.productionHealth = $health.data.env
      if (-not $health.ok) { Add-Blocker "Production health returned ok=false" }
      if ($health.data.env.runtime -ne "node") { Add-Blocker "Production heavy-flow runtime is not node" }
      if ($health.data.env.contextBudgetProfile -ne $ExpectedContextBudgetProfile) {
        Add-Blocker "Production context profile does not match expected profile"
      }
      if ($ReleaseScope -eq "public" -and $health.data.env.semanticJudgeMode -ne "enforce") {
        Add-Blocker "Production semantic judge is not enforce"
      }
    } catch {
      Add-Blocker "Production health check failed: $($_.Exception.Message)"
    }
  } else {
    Add-Blocker "Production health was not checked; pass -CheckProductionHealth for release evidence"
  }

  if ($FiveChapterArtifact -and (Test-Path $FiveChapterArtifact)) {
    $five = Get-Content -LiteralPath $FiveChapterArtifact -Raw | ConvertFrom-Json
    $report.evidence.fiveChapterSmoke = $FiveChapterArtifact
    if ($five.status -ne "pass" -or $five.chapterCountRequested -lt 5 -or -not $five.cleanupSucceeded) {
      Add-Blocker "Five-chapter live smoke artifact is not a clean PASS"
    }
  } else {
    Add-Blocker "Five-chapter live smoke PASS artifact is missing"
  }

  if ($ReleaseScope -eq "public") {
    if ($ThirtyChapterReport -and (Test-Path $ThirtyChapterReport)) {
      $text = Get-Content -LiteralPath $ThirtyChapterReport -Raw
      $report.evidence.thirtyChapterReport = $ThirtyChapterReport
      if ($text -notmatch 'Verdict:\s*\*\*GO\*\*') {
        Add-Blocker "Paid 30-chapter report does not contain an evidence-backed GO verdict"
      }
    } else {
      Add-Blocker "Public release requires paid 30-chapter GO report"
    }
  }

  $report.releaseReady = $report.blockingIssues.Count -eq 0
} finally {
  Pop-Location
  Save-GateReport
}

Write-Host ""
Write-Host "RELEASE READY: $(if ($report.releaseReady) { 'YES' } else { 'NO' })" -ForegroundColor $(if ($report.releaseReady) { "Green" } else { "Red" })
foreach ($issue in $report.blockingIssues) { Write-Host "BLOCKER: $issue" -ForegroundColor Red }
Write-Host "Artifact: $OutputPath"
if (-not $report.releaseReady) { exit 1 }
