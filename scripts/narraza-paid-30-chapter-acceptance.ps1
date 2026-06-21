[CmdletBinding()]
param(
  [switch]$DryRun,
  [switch]$AllowPaid30ChapterAcceptance,
  [ValidateRange(1, 1000000)]
  [int]$MaxCredits = 100000,
  [ValidateSet("conservative", "full")]
  [string]$ExpectedContextBudgetProfile = "conservative",
  [string]$BaseUrl = "",
  [string]$EvidenceJsonPath = "",
  [string]$ArtifactPath = "",
  [string]$ReportPath = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
if (-not $ArtifactPath) { $ArtifactPath = Join-Path $repoRoot "artifacts\long-fiction\thirty-chapter-$stamp.json" }
if (-not $ReportPath) { $ReportPath = Join-Path $repoRoot "docs\audit\2026-06-21-narraza-30-chapter-acceptance-report.md" }

function Write-Report {
  param([System.Collections.IDictionary]$Result)
  $projectDisplay = if ($Result.projectId) { $Result.projectId } else { "not created" }
  $creditDisplay = if ($null -ne $Result.creditsDebited) { $Result.creditsDebited } else { "not measured" }
  $lines = @(
    "# Narraza 30-Chapter Paid Acceptance Report",
    "",
    "Generated: $($Result.generatedAt)",
    "Verdict: **$($Result.verdict)**",
    "Project ID: $projectDisplay",
    "Credits debited: $creditDisplay / $MaxCredits",
    "",
    "| Criterion | Pass | Actual |",
    "|---|---:|---|"
  )
  foreach ($name in $Result.criteria.Keys) {
    $item = $Result.criteria[$name]
    $lines += "| $name | $($item.pass) | $($item.actual) |"
  }
  $lines += @(
    "",
    "Generation attempt IDs: $(@($Result.generationAttemptIds) -join ', ')",
    "",
    "This report is evidence-driven. A successful process exit alone cannot produce GO."
  )
  $directory = Split-Path -Parent $ReportPath
  New-Item -ItemType Directory -Path $directory -Force | Out-Null
  $lines | Set-Content -LiteralPath $ReportPath -Encoding utf8
}

if ($DryRun) {
  $checks = [ordered]@{
    paidGuardPresent = $true
    maxCreditsValid = $MaxCredits -gt 0
    expectedProfileValid = $ExpectedContextBudgetProfile -in @("conservative", "full")
    baseUrlProvidedForLive = -not [string]::IsNullOrWhiteSpace($BaseUrl)
    accessTokenPresentForLive = -not [string]::IsNullOrWhiteSpace(
      [Environment]::GetEnvironmentVariable("NARRAZA_SMOKE_ACCESS_TOKEN")
    )
    evidencePathWritable = -not [string]::IsNullOrWhiteSpace($ArtifactPath)
    cleanupPathImplemented = (Select-String -Path (Join-Path $PSScriptRoot "narraza-live-five-chapter-smoke.ps1") -Pattern "cleanupAttempted" -Quiet)
  }
  $result = [ordered]@{
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    dryRun = $true
    verdict = "DRY-RUN PASS"
    checks = $checks
    paidProviderCalled = $false
  }
  $directory = Split-Path -Parent $ArtifactPath
  New-Item -ItemType Directory -Path $directory -Force | Out-Null
  $result | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $ArtifactPath -Encoding utf8
  Write-Host "DRY RUN PASS - no provider call made." -ForegroundColor Green
  Write-Host "Artifact: $ArtifactPath"
  exit 0
}

if (-not $AllowPaid30ChapterAcceptance) {
  throw "Paid acceptance requires -AllowPaid30ChapterAcceptance"
}
if (-not $BaseUrl) { throw "-BaseUrl is required" }
if (-not $EvidenceJsonPath) {
  throw "-EvidenceJsonPath is required; it must contain actual admin validation, credit, reveal, knowledge, context-size, routing, summary, and publish metrics"
}

$flowArtifact = [System.IO.Path]::ChangeExtension($ArtifactPath, ".flow.json")
& (Join-Path $PSScriptRoot "narraza-live-five-chapter-smoke.ps1") `
  -AllowPaidAiSmoke `
  -MaxCredits $MaxCredits `
  -ExpectedContextBudgetProfile $ExpectedContextBudgetProfile `
  -BaseUrl $BaseUrl `
  -ArtifactPath $flowArtifact `
  -ChapterCount 30
if ($LASTEXITCODE -ne 0) { throw "30-chapter live flow failed; see $flowArtifact" }

$flow = Get-Content -LiteralPath $flowArtifact -Raw | ConvertFrom-Json
$evidence = Get-Content -LiteralPath $EvidenceJsonPath -Raw | ConvertFrom-Json

$criteria = [ordered]@{
  "30 chapter outlines generated" = @{ pass = ($evidence.chapterOutlineCount -eq 30); actual = $evidence.chapterOutlineCount }
  "no major reveal before chapter 25" = @{ pass = ($evidence.earlyMajorRevealCount -eq 0); actual = $evidence.earlyMajorRevealCount }
  "major reveal explicit at chapter 25" = @{ pass = ($evidence.majorRevealChapter -eq 25); actual = $evidence.majorRevealChapter }
  "zero blocked current prose" = @{ pass = ($evidence.blockedCurrentProseCount -eq 0); actual = $evidence.blockedCurrentProseCount }
  "semantic judge traceable" = @{ pass = [bool]$evidence.semanticJudgeTraceable; actual = $evidence.semanticJudgeTraceable }
  "zero certain-knowledge violations" = @{ pass = ($evidence.certainKnowledgeViolationCount -eq 0); actual = $evidence.certainKnowledgeViolationCount }
  "stable continuity entity IDs" = @{ pass = [bool]$evidence.stableContinuityEntityIds; actual = $evidence.stableContinuityEntityIds }
  "at least two mini victories in chapters 1-10" = @{ pass = ($evidence.miniVictoriesFirstTen -ge 2); actual = $evidence.miniVictoriesFirstTen }
  "no four-chapter agency drought after chapter 10" = @{ pass = ($evidence.maxAgencyDroughtAfterTen -lt 4); actual = $evidence.maxAgencyDroughtAfterTen }
  "all open loops decided" = @{ pass = ($evidence.openLoopsWithoutDecision -eq 0); actual = $evidence.openLoopsWithoutDecision }
  "mobile warning rate below 10 percent" = @{ pass = ($evidence.mobileParagraphWarningRate -lt 0.10); actual = $evidence.mobileParagraphWarningRate }
  "average style score at least 0.75" = @{ pass = ($evidence.averageStyleScore -ge 0.75); actual = $evidence.averageStyleScore }
  "failed provider attempts refunded" = @{ pass = ($evidence.failedProviderAttempts -eq $evidence.refundLedgerCount); actual = "$($evidence.failedProviderAttempts)/$($evidence.refundLedgerCount)" }
  "every chapter has summary and publish package" = @{ pass = ($evidence.summaryCount -eq 30 -and $evidence.publishPackageCount -eq 30); actual = "$($evidence.summaryCount)/$($evidence.publishPackageCount)" }
  "credit budget respected" = @{ pass = ($flow.creditsDebited -le $MaxCredits); actual = $flow.creditsDebited }
}

$allPass = @($criteria.Values | Where-Object { -not $_.pass }).Count -eq 0
$result = [ordered]@{
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  dryRun = $false
  verdict = if ($allPass) { "GO" } else { "NO-GO" }
  projectId = $flow.projectId
  creditsDebited = $flow.creditsDebited
  generationAttemptIds = @($flow.generationAttemptIds)
  criteria = $criteria
  sourceFlowArtifact = $flowArtifact
  sourceEvidenceArtifact = $EvidenceJsonPath
}
$directory = Split-Path -Parent $ArtifactPath
New-Item -ItemType Directory -Path $directory -Force | Out-Null
$result | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $ArtifactPath -Encoding utf8
Write-Report -Result $result
Write-Host "Verdict: $($result.verdict)"
Write-Host "Artifact: $ArtifactPath"
Write-Host "Report: $ReportPath"
if (-not $allPass) { exit 1 }
