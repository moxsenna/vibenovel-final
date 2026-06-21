[CmdletBinding()]
param(
  [switch]$DryRun,
  [switch]$AllowPaidAiSmoke,
  [ValidateRange(1, 1000000)]
  [int]$MaxCredits = 60000,
  [ValidateSet("conservative", "full")]
  [string]$ExpectedContextBudgetProfile = "conservative",
  [string]$BaseUrl = "",
  [string]$ArtifactPath = "",
  [ValidateRange(5, 30)]
  [int]$ChapterCount = 5
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($ArtifactPath)) {
  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $ArtifactPath = Join-Path $repoRoot "artifacts\long-fiction\five-chapter-$stamp.json"
}

$artifact = [ordered]@{
  schemaVersion = 1
  smokeType = if ($ChapterCount -eq 5) { "five_chapter" } else { "extended_chapter" }
  startedAt = (Get-Date).ToUniversalTime().ToString("o")
  dryRun = [bool]$DryRun
  baseUrl = if ($BaseUrl) { $BaseUrl } else { $null }
  expectedContextBudgetProfile = $ExpectedContextBudgetProfile
  maxCredits = $MaxCredits
  chapterCountRequested = $ChapterCount
  projectId = $null
  generationAttemptIds = @()
  chapters = @()
  creditStart = $null
  creditEnd = $null
  creditsDebited = $null
  cleanupAttempted = $false
  cleanupSucceeded = $false
  checks = [ordered]@{}
  status = "running"
  error = $null
  cleanupError = $null
  finishedAt = $null
}
$script:accessToken = ""

function Save-Artifact {
  $directory = Split-Path -Parent $ArtifactPath
  if ($directory) { New-Item -ItemType Directory -Path $directory -Force | Out-Null }
  $artifact.finishedAt = (Get-Date).ToUniversalTime().ToString("o")
  $artifact | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $ArtifactPath -Encoding utf8
}

function Invoke-NarrazaApi {
  param(
    [Parameter(Mandatory)][string]$Method,
    [Parameter(Mandatory)][string]$Path,
    [object]$Body = $null
  )
  $headers = @{ Authorization = "Bearer $script:accessToken" }
  $params = @{
    Uri = "$($BaseUrl.TrimEnd('/'))$Path"
    Method = $Method
    Headers = $headers
    TimeoutSec = 200
  }
  if ($null -ne $Body) {
    $params.ContentType = "application/json"
    $params.Body = ($Body | ConvertTo-Json -Depth 10 -Compress)
  }
  $response = Invoke-RestMethod @params
  if (-not $response.ok) { throw "$Method $Path returned ok=false" }
  return $response.data
}

function Get-CreditBalanceValue {
  $data = Invoke-NarrazaApi -Method GET -Path "/api/credits/balance"
  if ($null -ne $data.creditBalance) { return [int]$data.creditBalance.balance }
  if ($null -ne $data.balance) { return [int]$data.balance }
  throw "Credit balance response has no balance field"
}

Write-Host "=== Narraza Long-Fiction Live Smoke ===" -ForegroundColor Cyan

try {
  $artifact.checks.validBudget = $MaxCredits -gt 0
  $artifact.checks.validProfile = $ExpectedContextBudgetProfile -in @("conservative", "full")
  $artifact.checks.nodeBuild = $false

  Push-Location $repoRoot
  try {
    npm run build:api:node | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "Node API build failed" }
    $artifact.checks.nodeBuild = $true
  } finally {
    Pop-Location
  }

  if ([string]::IsNullOrWhiteSpace($BaseUrl)) {
    if (-not $DryRun) { throw "-BaseUrl is required for a paid live smoke" }
    $artifact.checks.health = "skipped_offline_dry_run"
  } else {
    $health = Invoke-RestMethod -Uri "$($BaseUrl.TrimEnd('/'))/api/health" -TimeoutSec 30
    if (-not $health.ok) { throw "Health endpoint returned ok=false" }
    $artifact.checks.health = "pass"
    $artifact.checks.runtime = $health.data.env.runtime
    $artifact.checks.contextBudgetProfile = $health.data.env.contextBudgetProfile
    if ($health.data.env.runtime -ne "node") {
      throw "Heavy-flow runtime must be node, got $($health.data.env.runtime)"
    }
    if ($health.data.env.contextBudgetProfile -ne $ExpectedContextBudgetProfile) {
      throw "Expected context profile $ExpectedContextBudgetProfile, got $($health.data.env.contextBudgetProfile)"
    }
  }

  if ($DryRun) {
    $artifact.status = "dry_run_pass"
    Save-Artifact
    Write-Host "DRY RUN PASS - no project created and no provider call made." -ForegroundColor Green
    Write-Host "Artifact: $ArtifactPath"
    exit 0
  }

  if (-not $AllowPaidAiSmoke) {
    throw "Paid smoke requires -AllowPaidAiSmoke"
  }
  $script:accessToken = [Environment]::GetEnvironmentVariable("NARRAZA_SMOKE_ACCESS_TOKEN")
  if ([string]::IsNullOrWhiteSpace($script:accessToken)) {
    throw "Set NARRAZA_SMOKE_ACCESS_TOKEN in the process environment"
  }

  $artifact.creditStart = Get-CreditBalanceValue
  $project = Invoke-NarrazaApi -Method POST -Path "/api/projects" -Body @{
    title = "Long Fiction Smoke $(Get-Date -Format s)"
    entryPath = "no_idea"
  }
  $artifact.projectId = $project.id
  $projectId = $project.id

  Invoke-NarrazaApi -Method POST -Path "/api/projects/$projectId/intake" -Body @{ entryPath = "no_idea" } | Out-Null
  Invoke-NarrazaApi -Method POST -Path "/api/projects/$projectId/intake/messages" -Body @{
    content = "Drama keluarga serial. Nadira menemukan surat lama; rahasia utama baru boleh terungkap mendekati akhir."
    idempotencyKey = "live-smoke-intake-$projectId"
  } | Out-Null
  Invoke-NarrazaApi -Method POST -Path "/api/projects/$projectId/intake/extract-signals" | Out-Null

  $conceptResult = Invoke-NarrazaApi -Method POST -Path "/api/projects/$projectId/concepts/generate" -Body @{
    idempotencyKey = "live-smoke-concepts-$projectId"
  }
  $concept = @($conceptResult.concepts | Select-Object -First 1)
  if ($concept.Count -eq 0) {
    $listed = Invoke-NarrazaApi -Method GET -Path "/api/projects/$projectId/concepts"
    $concept = @($listed.concepts | Select-Object -First 1)
  }
  if ($concept.Count -eq 0) { throw "No generated concept available" }
  Invoke-NarrazaApi -Method POST -Path "/api/projects/$projectId/concepts/$($concept[0].id)/select" | Out-Null

  Invoke-NarrazaApi -Method POST -Path "/api/projects/$projectId/foundation/proposals/generate" -Body @{} | Out-Null
  $proposalBundle = Invoke-NarrazaApi -Method GET -Path "/api/projects/$projectId/foundation/proposals"
  foreach ($proposal in @($proposalBundle.proposals)) {
    if ($proposal.status -eq "proposed") {
      Invoke-NarrazaApi -Method POST -Path "/api/projects/$projectId/foundation/proposals/$($proposal.id)/accept" | Out-Null
    }
  }
  Invoke-NarrazaApi -Method POST -Path "/api/projects/$projectId/foundation/lock" | Out-Null

  Invoke-NarrazaApi -Method POST -Path "/api/projects/$projectId/outline/generate" -Body @{
    targetChapterCount = $ChapterCount
    revealDensity = "sedang"
    retentionIntensity = "seimbang"
    proseStyleTarget = "hangat emosional"
  } | Out-Null
  Invoke-NarrazaApi -Method POST -Path "/api/projects/$projectId/outline/approve" | Out-Null
  Invoke-NarrazaApi -Method POST -Path "/api/projects/$projectId/outline/lock" | Out-Null
  $outline = Invoke-NarrazaApi -Method GET -Path "/api/projects/$projectId/outline"
  $chapters = @($outline.chapterOutlines | Sort-Object chapterNumber | Select-Object -First $ChapterCount)
  if ($chapters.Count -lt $ChapterCount) { throw "Expected $ChapterCount chapters, got $($chapters.Count)" }

  foreach ($chapter in $chapters) {
    $chapterEvidence = [ordered]@{ chapterNumber = $chapter.chapterNumber; chapterOutlineId = $chapter.id }
    $sessionResult = Invoke-NarrazaApi -Method POST -Path "/api/projects/$projectId/write/sessions" -Body @{
      chapterOutlineId = $chapter.id
    }
    $session = $sessionResult.session
    $beatsResult = Invoke-NarrazaApi -Method POST -Path "/api/projects/$projectId/write/sessions/$($session.id)/beats/generate" -Body @{}
    $beat = @($beatsResult.beats | Select-Object -First 1)
    if ($beat.Count -eq 0) { throw "Chapter $($chapter.chapterNumber) has no generated beat" }
    $generation = Invoke-NarrazaApi -Method POST -Path "/api/projects/$projectId/ai/generate-prose" -Body @{
      chapterOutlineId = $chapter.id
      beatId = $beat[0].id
      writingSessionId = $session.id
      qualityMode = "seimbang"
      idempotencyKey = "live-smoke-$projectId-chapter-$($chapter.chapterNumber)"
    }
    $attemptId = $generation.generationAttempt.id
    $artifact.generationAttemptIds += $attemptId
    $chapterEvidence.generationAttemptId = $attemptId
    $chapterEvidence.validationPersisted = $true
    $artifact.chapters += $chapterEvidence

    $currentBalance = Get-CreditBalanceValue
    if (($artifact.creditStart - $currentBalance) -gt $MaxCredits) {
      throw "Credit budget exceeded: $($artifact.creditStart - $currentBalance) > $MaxCredits"
    }
  }

  $lastChapter = $chapters[-1]
  $packet = Invoke-NarrazaApi -Method POST -Path "/api/projects/$projectId/write/context-packet" -Body @{
    chapterOutlineId = $lastChapter.id
  }
  $artifact.checks.finalPacket = if ($packet.safety.planningTruthPresent -eq $false) { "pass" } else { "fail" }
  if ($artifact.checks.finalPacket -ne "pass") { throw "Final packet safety check failed" }

  $artifact.creditEnd = Get-CreditBalanceValue
  $artifact.creditsDebited = $artifact.creditStart - $artifact.creditEnd
  if ($artifact.creditsDebited -gt $MaxCredits) { throw "Final credit budget exceeded" }
  $artifact.status = "pass"
} catch {
  $artifact.status = "fail"
  $artifact.error = $_.Exception.Message
  Write-Host "FAIL: $($artifact.error)" -ForegroundColor Red
} finally {
  if ($artifact.projectId -and $script:accessToken -and $BaseUrl) {
    $artifact.cleanupAttempted = $true
    try {
      Invoke-NarrazaApi -Method DELETE -Path "/api/projects/$($artifact.projectId)" | Out-Null
      $artifact.cleanupSucceeded = $true
    } catch {
      $artifact.cleanupError = $_.Exception.Message
    }
  }
  Save-Artifact
}

Write-Host "Artifact: $ArtifactPath"
if ($artifact.status -ne "pass") { exit 1 }
Write-Host "PASS - $ChapterCount chapter live smoke, credits=$($artifact.creditsDebited)" -ForegroundColor Green
