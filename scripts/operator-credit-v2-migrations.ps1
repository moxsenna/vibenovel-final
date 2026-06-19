<#
.SYNOPSIS
  Guarded Credit System v2 migration preflight/apply operator.

.DESCRIPTION
  Preflight is the default and never mutates a database. Hosted checks run from
  an isolated temporary Supabase workspace so the repository link is unchanged.
  Apply requires an exact approval phrase, a clean git worktree, dependency
  migrations 00017-00020 already applied, and a pre-apply data snapshot.

.EXAMPLE
  npm run operator:credit-v2:migrations -- -Environment local
  npm run operator:credit-v2:migrations -- -Environment staging
  npm run operator:credit-v2:migrations -- -Environment production

.EXAMPLE
  npm run operator:credit-v2:migrations -- -Environment staging -Apply `
    -ApprovalPhrase "APPLY credit-v2 staging jdxyhrnibmmwlbtbokqo"
#>
[CmdletBinding()]
param(
  [ValidateSet("local", "staging", "production")]
  [string]$Environment = "local",
  [switch]$Apply,
  [string]$ApprovalPhrase = "",
  [string]$ProjectRef = "",
  [string]$OperatorEnvFile = "",
  [string]$DbPassword = "",
  [string]$StagingProjectRef = "jdxyhrnibmmwlbtbokqo",
  [string]$AuditPath = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$MigrationIds = @("00017", "00018", "00019", "00020", "00021")
$DependencyIds = @("00017", "00018", "00019", "00020")
$TargetMigrationId = "00021"
$ExpectedProducts = @{
  starter = @(20000, 0)
  creator = @(50000, 5000)
  pro = @(120000, 10000)
  studio = @(270000, 30000)
}
$script:TempWorkspace = ""
$script:PaymentFlagStatus = "UNKNOWN"

if ([string]::IsNullOrWhiteSpace($AuditPath)) {
  $AuditPath = Join-Path $RepoRoot "docs\audit\21-credit-v2-migration-preflight-2026-06-19.md"
}

function Get-ProjectRefFromUrl {
  param([string]$Url)
  if ([string]::IsNullOrWhiteSpace($Url)) { return $null }
  try {
    $hostName = ([Uri]$Url.Trim()).Host
    if ($hostName -match '^([a-z0-9]{20})\.supabase\.co$') {
      return $Matches[1]
    }
  } catch { }
  return $null
}

function Import-OperatorEnv {
  param([string]$Path)
  if (-not (Test-Path $Path)) { return }
  foreach ($line in Get-Content $Path) {
    if ($line -match '^\s*#' -or $line -notmatch '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
      continue
    }
    $name = $Matches[1]
    $value = $Matches[2].Trim().Trim('"').Trim("'")
    if (-not [string]::IsNullOrWhiteSpace($value)) {
      [Environment]::SetEnvironmentVariable($name, $value, "Process")
    }
  }
}

function Resolve-OperatorEnvPath {
  if (-not [string]::IsNullOrWhiteSpace($OperatorEnvFile)) {
    if (-not (Test-Path $OperatorEnvFile)) {
      throw "Operator env file not found: $OperatorEnvFile"
    }
    return (Resolve-Path $OperatorEnvFile).Path
  }

  $fileName = ".env.$Environment"
  $localCandidate = Join-Path $RepoRoot $fileName
  if (Test-Path $localCandidate) { return $localCandidate }

  $worktreeOutput = & git worktree list --porcelain
  foreach ($line in $worktreeOutput) {
    if ($line -notmatch '^worktree\s+(.+)$') { continue }
    $candidate = Join-Path $Matches[1] $fileName
    if (Test-Path $candidate) { return $candidate }
  }
  return ""
}

function Get-WranglerPaymentFlag {
  param([string]$TargetEnvironment)
  if ($TargetEnvironment -eq "local") { return "false" }
  $source = Get-Content -Raw (Join-Path $RepoRoot "apps\api\wrangler.toml")
  $escaped = [regex]::Escape($TargetEnvironment)
  $match = [regex]::Match(
    $source,
    "(?ms)^\[env\.$escaped\.vars\]\s*(?<body>.*?)(?=^\[|\z)"
  )
  if (-not $match.Success) { return $null }
  $flag = [regex]::Match(
    $match.Groups["body"].Value,
    '(?m)^\s*CREDIT_TOPUP_ENABLED\s*=\s*"(?<value>true|false)"\s*$'
  )
  if (-not $flag.Success) { return $null }
  return $flag.Groups["value"].Value.ToLowerInvariant()
}

function Invoke-Supabase {
  param(
    [string[]]$Arguments,
    [switch]$AllowFailure
  )
  $previous = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $output = (& supabase @Arguments 2>&1 | Out-String)
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previous
  }
  if ($exitCode -ne 0 -and -not $AllowFailure) {
    throw "Supabase CLI failed (exit=$exitCode): $($output.Trim())"
  }
  return @{
    ExitCode = $exitCode
    Output = $output
  }
}

function New-IsolatedSupabaseWorkspace {
  $tempRoot = Join-Path ([IO.Path]::GetTempPath()) "vibenovel-credit-v2-$PID-$([guid]::NewGuid().ToString('N'))"
  New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null
  Copy-Item -Path (Join-Path $RepoRoot "supabase") -Destination (Join-Path $tempRoot "supabase") -Recurse
  $copiedLinkState = Join-Path $tempRoot "supabase\.temp"
  if (Test-Path $copiedLinkState) {
    $resolvedLinkState = [IO.Path]::GetFullPath($copiedLinkState)
    if (-not $resolvedLinkState.StartsWith([IO.Path]::GetFullPath($tempRoot), [StringComparison]::OrdinalIgnoreCase)) {
      throw "Unexpected copied Supabase link-state path"
    }
    Remove-Item -LiteralPath $resolvedLinkState -Recurse -Force
  }
  $script:TempWorkspace = $tempRoot
  return $tempRoot
}

function Remove-IsolatedSupabaseWorkspace {
  if ([string]::IsNullOrWhiteSpace($script:TempWorkspace)) { return }
  $resolved = [IO.Path]::GetFullPath($script:TempWorkspace)
  $tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
  if (-not $resolved.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to remove non-temporary path: $resolved"
  }
  if ((Split-Path -Leaf $resolved) -notlike "vibenovel-credit-v2-*") {
    throw "Refusing to remove unexpected temporary path: $resolved"
  }
  Remove-Item -LiteralPath $resolved -Recurse -Force -ErrorAction SilentlyContinue
  $script:TempWorkspace = ""
}

function Get-AppliedMigrationIds {
  param([string]$ListOutput)
  $ids = [System.Collections.Generic.HashSet[string]]::new()
  foreach ($line in ($ListOutput -split "`r?`n")) {
    if ($line -match '^\s*(\d{5})\s*\|\s*(\d{5})\s*\|') {
      [void]$ids.Add($Matches[2])
    }
  }
  return ,$ids
}

function Get-MigrationFileMap {
  $map = @{}
  foreach ($file in Get-ChildItem (Join-Path $RepoRoot "supabase\migrations") -File -Filter "*.sql") {
    if ($file.Name -match '^(\d{5})_') {
      $map[$Matches[1]] = $file.Name
    }
  }
  return $map
}

function Get-CountFromContentRange {
  param($Headers)
  $range = [string]$Headers["Content-Range"]
  if ($range -match '/(\d+)$') { return [int]$Matches[1] }
  return 0
}

function Get-CleanSupabaseOutput {
  param([string]$Output)
  $lines = @()
  foreach ($line in ($Output -split "`r?`n")) {
    $clean = $line -replace '^node\.exe\s*:\s*', ''
    if (
      $clean -match '^At .+supabase\.ps1:\d+' -or
      $clean -match '^\s*\+\s+' -or
      $clean -match '^\s*\+ CategoryInfo\s*:' -or
      $clean -match '^\s*\+ FullyQualifiedErrorId\s*:'
    ) {
      continue
    }
    $lines += $clean
  }
  return ($lines -join [Environment]::NewLine).Trim()
}

function Get-DataSnapshot {
  param(
    [string]$SupabaseUrl,
    [string]$ServiceRoleKey
  )
  if ([string]::IsNullOrWhiteSpace($SupabaseUrl) -or [string]::IsNullOrWhiteSpace($ServiceRoleKey)) {
    throw "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for data verification"
  }
  $base = $SupabaseUrl.TrimEnd("/")
  $headers = @{
    apikey = $ServiceRoleKey
    Authorization = "Bearer $ServiceRoleKey"
  }
  $productResponse = Invoke-RestMethod -Uri "$base/rest/v1/credit_topup_products?select=id,slug,credits,bonus_credits,is_active&order=slug.asc" `
    -Headers $headers -Method GET -TimeoutSec 30
  $products = if ($productResponse -is [System.Array]) {
    $productResponse
  } else {
    @($productResponse)
  }
  $countHeaders = $headers.Clone()
  $countHeaders.Prefer = "count=exact"
  $ordersResponse = Invoke-WebRequest -Uri "$base/rest/v1/credit_topup_orders?select=id&limit=1" `
    -Headers $countHeaders -Method HEAD -UseBasicParsing -TimeoutSec 30
  $linkedOrdersResponse = Invoke-WebRequest `
    -Uri "$base/rest/v1/credit_topup_orders?select=id,credit_topup_products!inner(id)&limit=1" `
    -Headers $countHeaders -Method HEAD -UseBasicParsing -TimeoutSec 30
  return @{
    products = $products
    historicalOrderCount = Get-CountFromContentRange $ordersResponse.Headers
    historicalOrderFkCount = Get-CountFromContentRange $linkedOrdersResponse.Headers
  }
}

function Test-ProductIntegrity {
  param($Snapshot)
  $issues = @()
  foreach ($slug in $ExpectedProducts.Keys) {
    $row = @($Snapshot.products | Where-Object { $_.slug -eq $slug }) | Select-Object -First 1
    if ($null -eq $row) {
      $issues += "missing:$slug"
      continue
    }
    if (-not [bool]$row.is_active) { $issues += "inactive:$slug" }
    if ([int]$row.credits -ne $ExpectedProducts[$slug][0]) {
      $issues += "credits:$slug"
    }
    if ([int]$row.bonus_credits -ne $ExpectedProducts[$slug][1]) {
      $issues += "bonus:$slug"
    }
  }
  $legacyActive = @(
    $Snapshot.products |
      Where-Object {
        $ExpectedProducts.Keys -notcontains $_.slug -and [bool]$_.is_active
      }
  )
  if ($legacyActive.Count -gt 0) {
    $issues += "legacy_products_active"
  }
  return $issues
}

function Write-AuditSection {
  param(
    [string]$Status,
    [string]$TargetRef,
    [string]$CommitSha,
    [string[]]$MigrationLines,
    [string[]]$Notes
  )
  $directory = Split-Path -Parent $AuditPath
  New-Item -ItemType Directory -Path $directory -Force | Out-Null
  if (-not (Test-Path $AuditPath)) {
    Set-Content -Path $AuditPath -Encoding UTF8 -Value @(
      "# Credit v2 Migration Preflight",
      "",
      "Generated by scripts/operator-credit-v2-migrations.ps1."
    )
  }
  Add-Content -Path $AuditPath -Encoding UTF8 -Value @(
    "",
    "## $Environment - $([DateTimeOffset]::UtcNow.ToString('u'))",
    "",
    "- Mode: $(if ($Apply) { 'apply' } else { 'preflight' })",
    "- Status: $Status",
    "- Target ref: $TargetRef",
    "- Commit SHA: $CommitSha",
    "- Payment flag: $($script:PaymentFlagStatus)",
    "",
    "### Migration state",
    "",
    $MigrationLines,
    "",
    "### Notes",
    "",
    $Notes
  )
}

function Stop-WithAudit {
  param(
    [string]$Message,
    [int]$ExitCode,
    [string]$TargetRef,
    [string]$CommitSha,
    [string[]]$MigrationLines = @("- Not evaluated."),
    [string[]]$Notes = @()
  )
  Write-Host "BLOCKED: $Message" -ForegroundColor Red
  Write-AuditSection -Status "BLOCKED" -TargetRef $TargetRef -CommitSha $CommitSha `
    -MigrationLines $MigrationLines -Notes (@("- $Message") + $Notes)
  exit $ExitCode
}

$commitSha = (& git rev-parse HEAD).Trim()
$targetRef = "local"
$envPath = ""
$supabaseUrl = "http://127.0.0.1:54321"
$serviceRoleKey = ""
$accessToken = ""

try {
  if ($Environment -ne "local") {
    $envPath = Resolve-OperatorEnvPath
    if ([string]::IsNullOrWhiteSpace($envPath)) {
      Stop-WithAudit -Message "No operator env file found for $Environment" -ExitCode 2 `
        -TargetRef "unknown" -CommitSha $commitSha
    }
    Import-OperatorEnv -Path $envPath
    $supabaseUrl = [Environment]::GetEnvironmentVariable("SUPABASE_URL")
    $serviceRoleKey = [Environment]::GetEnvironmentVariable("SUPABASE_SERVICE_ROLE_KEY")
    $accessToken = [Environment]::GetEnvironmentVariable("SUPABASE_ACCESS_TOKEN")
    if ([string]::IsNullOrWhiteSpace($DbPassword)) {
      $DbPassword = [Environment]::GetEnvironmentVariable("SUPABASE_DB_PASSWORD")
    }
    $derivedRef = Get-ProjectRefFromUrl -Url $supabaseUrl
    $targetRef = if ($ProjectRef) { $ProjectRef.Trim() } else { $derivedRef }
    if ([string]::IsNullOrWhiteSpace($targetRef) -or $targetRef -notmatch '^[a-z0-9]{20}$') {
      Stop-WithAudit -Message "Cannot determine a valid Supabase project ref" -ExitCode 2 `
        -TargetRef "unknown" -CommitSha $commitSha
    }
    if ($Environment -eq "staging" -and $targetRef -ne $StagingProjectRef) {
      Stop-WithAudit -Message "Staging ref mismatch: expected $StagingProjectRef" -ExitCode 3 `
        -TargetRef $targetRef -CommitSha $commitSha
    }
    if ($Environment -eq "production" -and $targetRef -eq $StagingProjectRef) {
      Stop-WithAudit -Message "Production ref equals the forbidden staging ref" -ExitCode 3 `
        -TargetRef $targetRef -CommitSha $commitSha
    }
  } else {
    $statusResult = Invoke-Supabase -Arguments @("status", "-o", "env")
    foreach ($line in ($statusResult.Output -split "`r?`n")) {
      if ($line -match '^SERVICE_ROLE_KEY="(.+)"\s*$') {
        $serviceRoleKey = $Matches[1]
      } elseif ($line -match '^API_URL="(.+)"\s*$') {
        $supabaseUrl = $Matches[1]
      }
    }
  }

  $wranglerFlag = Get-WranglerPaymentFlag -TargetEnvironment $Environment
  $envFlag = [Environment]::GetEnvironmentVariable("CREDIT_TOPUP_ENABLED")
  $paymentOff =
    $wranglerFlag -eq "false" -and
    ([string]::IsNullOrWhiteSpace($envFlag) -or $envFlag.Trim().ToLowerInvariant() -eq "false")
  if (-not $paymentOff) {
    $script:PaymentFlagStatus = "NOT_OFF"
    Stop-WithAudit -Message "CREDIT_TOPUP_ENABLED must remain false" -ExitCode 3 `
      -TargetRef $targetRef -CommitSha $commitSha
  }
  $script:PaymentFlagStatus = "OFF"

  $migrationFiles = Get-MigrationFileMap
  foreach ($id in $MigrationIds) {
    if (-not $migrationFiles.ContainsKey($id)) {
      Stop-WithAudit -Message "Migration file $id is missing" -ExitCode 1 `
        -TargetRef $targetRef -CommitSha $commitSha
    }
  }

  if ($Environment -eq "local") {
    $history = Invoke-Supabase -Arguments @("migration", "list", "--local")
    $dryRun = Invoke-Supabase -Arguments @("db", "push", "--local", "--dry-run")
  } else {
    if ([string]::IsNullOrWhiteSpace($accessToken) -or [string]::IsNullOrWhiteSpace($DbPassword)) {
      Stop-WithAudit -Message "SUPABASE_ACCESS_TOKEN and SUPABASE_DB_PASSWORD are required for hosted migration history" `
        -ExitCode 2 -TargetRef $targetRef -CommitSha $commitSha `
        -Notes @("- Env file: $envPath", "- No database mutation was attempted.")
    }
    [Environment]::SetEnvironmentVariable("SUPABASE_ACCESS_TOKEN", $accessToken, "Process")
    $tempRoot = New-IsolatedSupabaseWorkspace
    Invoke-Supabase -Arguments @(
      "link", "--project-ref", $targetRef, "--password", $DbPassword,
      "--workdir", $tempRoot
    ) | Out-Null
    $history = Invoke-Supabase -Arguments @(
      "migration", "list", "--linked", "--password", $DbPassword,
      "--workdir", $tempRoot
    )
    $dryRun = Invoke-Supabase -Arguments @(
      "db", "push", "--linked", "--dry-run", "--password", $DbPassword,
      "--workdir", $tempRoot
    )
  }

  $appliedIds = Get-AppliedMigrationIds -ListOutput $history.Output
  $migrationLines = @()
  foreach ($id in $MigrationIds) {
    $state = if ($appliedIds.Contains($id)) { "APPLIED" } else { "PENDING" }
    $migrationLines += "- $id ($($migrationFiles[$id])): $state"
    Write-Host "$id $state - $($migrationFiles[$id])"
  }

  $dependenciesReady = @(
    $DependencyIds | Where-Object { -not $appliedIds.Contains($_) }
  ).Count -eq 0
  $targetApplied = $appliedIds.Contains($TargetMigrationId)
  $preflightDataNotes = @()
  if (
    $targetApplied -and
    -not [string]::IsNullOrWhiteSpace($supabaseUrl) -and
    -not [string]::IsNullOrWhiteSpace($serviceRoleKey)
  ) {
    $currentSnapshot = Get-DataSnapshot -SupabaseUrl $supabaseUrl -ServiceRoleKey $serviceRoleKey
    $currentIssues = @(Test-ProductIntegrity -Snapshot $currentSnapshot)
    if ($currentIssues.Count -gt 0) {
      Stop-WithAudit -Message "Current product integrity failed: $($currentIssues -join ', ')" `
        -ExitCode 3 -TargetRef $targetRef -CommitSha $commitSha -MigrationLines $migrationLines
    }
    if ($currentSnapshot.historicalOrderFkCount -ne $currentSnapshot.historicalOrderCount) {
      Stop-WithAudit -Message "Current historical order FK verification failed" `
        -ExitCode 3 -TargetRef $targetRef -CommitSha $commitSha -MigrationLines $migrationLines
    }
    $preflightDataNotes += "- Current Credit v2 product integrity: PASS."
    $preflightDataNotes += "- Current historicalOrderCount: $($currentSnapshot.historicalOrderCount); all product FKs resolve."
  }
  Write-Host "`nSupabase dry-run output:" -ForegroundColor Cyan
  Write-Host (Get-CleanSupabaseOutput $dryRun.Output)
  Write-Host "Payment flag: OFF" -ForegroundColor Green

  if (-not $Apply) {
    $status = if ($targetApplied) {
      "PASS_ALREADY_APPLIED"
    } elseif ($dependenciesReady) {
      "PASS_READY_TO_APPLY"
    } else {
      "BLOCKED_DEPENDENCY_GAP"
    }
    $notes = @(
      "- Preflight only; no database mutation was attempted.",
      "- Dry-run exit code: $($dryRun.ExitCode).",
      "- Dependency 00017-00020 ready: $dependenciesReady.",
      "- Target 00021 already applied: $targetApplied."
    ) + $preflightDataNotes
    Write-AuditSection -Status $status -TargetRef $targetRef -CommitSha $commitSha `
      -MigrationLines $migrationLines -Notes $notes
    if (-not $dependenciesReady -and -not $targetApplied) {
      Write-Host "BLOCKED: dependency migrations 00017-00020 are not fully applied" -ForegroundColor Red
      exit 2
    }
    Write-Host "PASS Credit v2 migration preflight ($Environment)" -ForegroundColor Green
    exit 0
  }

  $expectedApproval = "APPLY credit-v2 $Environment $targetRef"
  if ($ApprovalPhrase -cne $expectedApproval) {
    Stop-WithAudit -Message "Exact approval required: $expectedApproval" -ExitCode 3 `
      -TargetRef $targetRef -CommitSha $commitSha -MigrationLines $migrationLines
  }

  $dirty = & git status --porcelain
  if ($dirty) {
    Stop-WithAudit -Message "Git worktree must be clean before apply" -ExitCode 3 `
      -TargetRef $targetRef -CommitSha $commitSha -MigrationLines $migrationLines
  }
  if (-not $dependenciesReady -and -not $targetApplied) {
    Stop-WithAudit -Message "Remote must have dependency migrations 00017-00020 before 00021 apply" `
      -ExitCode 3 -TargetRef $targetRef -CommitSha $commitSha -MigrationLines $migrationLines
  }

  $before = Get-DataSnapshot -SupabaseUrl $supabaseUrl -ServiceRoleKey $serviceRoleKey
  $beforeIssues = @(Test-ProductIntegrity -Snapshot $before)
  if ($before.historicalOrderFkCount -ne $before.historicalOrderCount) {
    throw "Pre-apply historical order FK verification failed"
  }
  if ($targetApplied -and $beforeIssues.Count -eq 0) {
    Write-AuditSection -Status "PASS_ALREADY_APPLIED" -TargetRef $targetRef -CommitSha $commitSha `
      -MigrationLines $migrationLines -Notes @(
        "- Apply requested but 00021 was already applied; no migration command was executed.",
        "- historicalOrderCount before verification: $($before.historicalOrderCount)."
      )
    Write-Host "PASS 00021 already applied and product integrity verified" -ForegroundColor Green
    exit 0
  }

  if ($Environment -eq "local") {
    Invoke-Supabase -Arguments @("migration", "up", "--local", "--include-all") | Out-Null
    $postHistory = Invoke-Supabase -Arguments @("migration", "list", "--local")
  } else {
    Invoke-Supabase -Arguments @(
      "db", "push", "--linked", "--include-all", "--yes",
      "--password", $DbPassword, "--workdir", $script:TempWorkspace
    ) | Out-Null
    $postHistory = Invoke-Supabase -Arguments @(
      "migration", "list", "--linked", "--password", $DbPassword,
      "--workdir", $script:TempWorkspace
    )
  }

  $postApplied = Get-AppliedMigrationIds -ListOutput $postHistory.Output
  if (-not $postApplied.Contains($TargetMigrationId)) {
    throw "Post-apply migration history does not contain 00021"
  }
  $after = Get-DataSnapshot -SupabaseUrl $supabaseUrl -ServiceRoleKey $serviceRoleKey
  $afterIssues = @(Test-ProductIntegrity -Snapshot $after)
  if ($afterIssues.Count -gt 0) {
    throw "Post-apply product integrity failed: $($afterIssues -join ', ')"
  }
  if ($after.historicalOrderCount -ne $before.historicalOrderCount) {
    throw "Historical order count changed during migration apply"
  }
  if ($after.historicalOrderFkCount -ne $after.historicalOrderCount) {
    throw "Post-apply historical order FK verification failed"
  }
  $beforeLegacyIds = @(
    $before.products |
      Where-Object { $ExpectedProducts.Keys -notcontains $_.slug } |
      ForEach-Object { $_.id }
  )
  $afterProductIds = @($after.products | ForEach-Object { $_.id })
  foreach ($legacyId in $beforeLegacyIds) {
    if ($afterProductIds -notcontains $legacyId) {
      throw "Legacy product was deleted during migration apply"
    }
  }

  Write-AuditSection -Status "PASS_APPLIED" -TargetRef $targetRef -CommitSha $commitSha `
    -MigrationLines $migrationLines -Notes @(
      "- Apply approval matched exactly.",
      "- historicalOrderCount before: $($before.historicalOrderCount).",
      "- historicalOrderCount after: $($after.historicalOrderCount).",
      "- Historical order foreign keys resolved before and after apply.",
      "- Four Credit v2 products active with exact credits/bonuses.",
      "- Any pre-existing legacy products remain present and inactive.",
      "- CREDIT_TOPUP_ENABLED remained false."
    )
  Write-Host "PASS Credit v2 migration apply ($Environment)" -ForegroundColor Green
} catch {
  $safeMessage = $_.Exception.Message -replace '(?i)(password|token|key)=\S+', '$1=[redacted]'
  Write-Host "FAIL Credit v2 migration operator: $safeMessage" -ForegroundColor Red
  Write-AuditSection -Status "ERROR" -TargetRef $targetRef -CommitSha $commitSha `
    -MigrationLines @("- Operator aborted before a complete migration-state result.") `
    -Notes @("- Error: $safeMessage", "- Database apply completion was not claimed.")
  exit 1
} finally {
  Remove-IsolatedSupabaseWorkspace
}
