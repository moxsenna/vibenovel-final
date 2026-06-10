<#
.SYNOPSIS
  Task 10.28 - Founder credit seed + production AI prose smoke (operator only).
  Never prints secrets. Does not commit env.
#>
[CmdletBinding()]
param(
  [string]$ApiBaseUrl = "https://api.narraza.web.id",
  [string]$FounderEmail = "moxsenna@gmail.com",
  [int]$SeedCredits = 50
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot "lib\staging-smoke-common.ps1")
Import-DotEnvFile -Path (Join-Path $RepoRoot ".env.production")

$sbUrl = $env:SUPABASE_URL.Trim().TrimEnd("/")
$anon = $env:SUPABASE_ANON_KEY
$srk = $env:SUPABASE_SERVICE_ROLE_KEY
if ([string]::IsNullOrWhiteSpace($sbUrl) -or [string]::IsNullOrWhiteSpace($anon) -or [string]::IsNullOrWhiteSpace($srk)) {
  throw "Production Supabase env missing in .env.production"
}

function Invoke-Api {
  param(
    [string]$Method = "GET",
    [string]$Path,
    [hashtable]$Headers = @{},
    [string]$Body = ""
  )
  $uri = "$ApiBaseUrl$Path"
  $params = @{
    Uri         = $uri
    Method      = $Method
    Headers     = $Headers
    ContentType = "application/json"
  }
  if ($Body) { $params.Body = $Body }
  return Invoke-RestMethod @params
}

$adminH = @{
  apikey        = $srk
  Authorization = "Bearer $srk"
  "Content-Type" = "application/json"
}

Write-Host "`nTask 10.28 - Founder AI test" -ForegroundColor Cyan

$health = Invoke-Api -Path "/api/health"
Write-Host ("Health: ai={0} orKey={1} topup={2} provider={3}" -f `
  $health.data.env.aiGenerationEnabled, `
  $health.data.env.hasOpenRouterApiKey, `
  $health.data.env.creditTopupEnabled, `
  $health.data.env.paymentProvider)

if (-not $health.data.env.aiGenerationEnabled -or -not $health.data.env.hasOpenRouterApiKey) {
  throw "Production AI not ready - abort"
}

$users = Invoke-RestMethod -Uri "$sbUrl/auth/v1/admin/users?per_page=200" -Headers $adminH
$founder = $users.users | Where-Object { $_.email -eq $FounderEmail } | Select-Object -First 1
if (-not $founder) { throw "Founder user not found: $FounderEmail" }
$userId = $founder.id
Write-Host "Founder user id: $userId"

$existing = Invoke-RestMethod -Uri "$sbUrl/rest/v1/credit_balances?user_id=eq.$userId&select=balance,user_id" -Headers $adminH
if ($existing -and $existing.Count -gt 0) {
  $beforeBal = [int]$existing[0].balance
  $newBal = [Math]::Max($beforeBal, $SeedCredits)
  if ($beforeBal -lt $SeedCredits) {
    $patch = @{ balance = $newBal } | ConvertTo-Json
    $patchH = $adminH.Clone()
    $patchH.Prefer = "return=minimal"
    Invoke-RestMethod -Uri "$sbUrl/rest/v1/credit_balances?user_id=eq.$userId" -Method PATCH -Headers $patchH -Body $patch | Out-Null
    Write-Host "Credit seed: $beforeBal -> $newBal"
  } else {
    Write-Host "Credit seed: sufficient balance=$beforeBal"
    $newBal = $beforeBal
  }
} else {
  $body = @{
    user_id       = $userId
    balance       = $SeedCredits
    monthly_quota = 0
    monthly_used  = 0
    source        = "admin_grant"
  } | ConvertTo-Json
  $postH = $adminH.Clone()
  $postH.Prefer = "return=minimal"
  Invoke-RestMethod -Uri "$sbUrl/rest/v1/credit_balances" -Method POST -Headers $postH -Body $body | Out-Null
  Write-Host "Credit seed: inserted balance=$SeedCredits"
  $newBal = $SeedCredits
}

$linkRes = Invoke-RestMethod -Uri "$sbUrl/auth/v1/admin/generate_link" -Method POST -Headers $adminH `
  -Body (@{ type = "magiclink"; email = $FounderEmail } | ConvertTo-Json)
$verifyRes = Invoke-RestMethod -Uri "$sbUrl/auth/v1/verify" -Method POST `
  -Headers @{ apikey = $anon; Authorization = "Bearer $anon"; "Content-Type" = "application/json" } `
  -Body (@{ type = "magiclink"; token_hash = $linkRes.hashed_token } | ConvertTo-Json)
$token = $verifyRes.access_token
if (-not $token) { throw "Failed to obtain founder session" }
Write-Host "Founder session: ok"
$auth = @{ Authorization = "Bearer $token" }

$projects = Invoke-Api -Path "/api/projects?includeArchived=true" -Headers $auth
$projectList = @($projects.data)
if ($projectList.Count -lt 1) { throw "No founder projects" }
$project = $projectList | Sort-Object -Property updatedAt -Descending | Select-Object -First 1
$projectId = $project.id
Write-Host "Test project: $projectId ($($project.title))"

function Ensure-WriteContext {
  param([string]$ProjectIdForBootstrap)
  $foundationLocked = $false
  try {
    $f = Invoke-Api -Path "/api/projects/$ProjectIdForBootstrap/foundation" -Headers $auth
    $foundationLocked = [bool]($f.data.foundation.isLocked -or $f.data.foundation.lockedAt)
    if ($foundationLocked) { Write-Host "Foundation already locked" }
  } catch { }

  if (-not $foundationLocked) {
    Write-Host "Bootstrapping foundation..."
    Invoke-Api -Method POST -Path "/api/projects/$ProjectIdForBootstrap/intake/messages" -Headers $auth `
      -Body '{"content":"Cerita drama rumah tangga dengan konflik keluarga dan rahasia masa lalu di Jakarta."}' | Out-Null
    Invoke-Api -Method POST -Path "/api/projects/$ProjectIdForBootstrap/intake/extract-signals" -Headers $auth -Body "{}" | Out-Null
    $concepts = Invoke-Api -Method POST -Path "/api/projects/$ProjectIdForBootstrap/concepts/generate" -Headers $auth -Body "{}"
    $conceptId = $concepts.data.concepts[0].id
    Invoke-Api -Method POST -Path "/api/projects/$ProjectIdForBootstrap/concepts/$conceptId/select" -Headers $auth -Body "{}" | Out-Null
    $proposals = Invoke-Api -Method POST -Path "/api/projects/$ProjectIdForBootstrap/foundation/proposals/generate" -Headers $auth -Body "{}"
    foreach ($p in $proposals.data.proposals) {
      if ($p.type -in @("foundation", "character", "fact", "relationship_speech_rule", "style")) {
        Invoke-Api -Method POST -Path "/api/projects/$ProjectIdForBootstrap/proposals/$($p.id)/accept" -Headers $auth -Body "{}" | Out-Null
      }
    }
    Invoke-Api -Method POST -Path "/api/projects/$ProjectIdForBootstrap/foundation/lock" -Headers $auth -Body "{}" | Out-Null
  }

  $outlineLocked = $false
  try {
    $outline = Invoke-Api -Path "/api/projects/$ProjectIdForBootstrap/outline" -Headers $auth
    $outlineLocked = ($outline.data.outlinePlan.status -eq "locked")
    if ($outlineLocked) { Write-Host "Outline already locked" }
  } catch { }

  if (-not $outlineLocked) {
    Write-Host "Bootstrapping outline..."
    try {
      Invoke-Api -Method POST -Path "/api/projects/$ProjectIdForBootstrap/outline/generate" -Headers $auth -Body "{}" | Out-Null
    } catch { Write-Host "Outline generate skipped or already exists" }
    Invoke-Api -Method POST -Path "/api/projects/$ProjectIdForBootstrap/outline/approve" -Headers $auth -Body "{}" | Out-Null
    Invoke-Api -Method POST -Path "/api/projects/$ProjectIdForBootstrap/outline/lock" -Headers $auth -Body "{}" | Out-Null
  }
}

Ensure-WriteContext -ProjectIdForBootstrap $projectId

$chapters = Invoke-Api -Path "/api/projects/$projectId/outline/chapters" -Headers $auth
$ch1 = ($chapters.data.chapters | Where-Object { $_.chapterNumber -eq 1 } | Select-Object -First 1)
if (-not $ch1.id) { throw "Chapter 1 outline missing" }
$ch1Id = $ch1.id

$session = Invoke-Api -Method POST -Path "/api/projects/$projectId/write/sessions" -Headers $auth `
  -Body (@{ chapterOutlineId = $ch1Id } | ConvertTo-Json)
$sessionId = $session.data.session.id
Invoke-Api -Method POST -Path "/api/projects/$projectId/write/sessions/$sessionId/beats/generate" -Headers $auth -Body "{}" | Out-Null
$beats = Invoke-Api -Path "/api/projects/$projectId/write/sessions/$sessionId/beats" -Headers $auth
$beatId = $beats.data.beats[0].id
Write-Host "Write context: session=$sessionId beat=$beatId"

$balanceBefore = (Invoke-Api -Path "/api/credits/balance" -Headers $auth).data.creditBalance.balance
Write-Host "Credit before generation: $balanceBefore"

$idem = "t1028-$(Get-Date -Format 'yyyyMMddHHmmss')"
$genBody = (@{
  chapterOutlineId = $ch1Id
  beatId           = $beatId
  writingSessionId = $sessionId
  qualityMode      = "hemat"
  idempotencyKey   = $idem
} | ConvertTo-Json -Compress)

Write-Host "Calling POST /api/projects/$projectId/ai/generate-prose ..."
$genRes = Invoke-Api -Method POST -Path "/api/projects/$projectId/ai/generate-prose" -Headers $auth -Body $genBody

$prose = $genRes.data.version.proseText
$proseLen = if ($prose) { $prose.Length } else { 0 }
$preview = if ($proseLen -gt 0) { $prose.Substring(0, [Math]::Min(240, $proseLen)) } else { "[empty]" }

Write-Host ("Generation: status={0} source={1} len={2} cost={3} balance={4}->{5}" -f `
  $genRes.data.generationAttempt.status, `
  $genRes.data.version.source, `
  $proseLen, `
  $genRes.data.creditCost, `
  $balanceBefore, `
  $genRes.data.creditBalance.balance)
Write-Host "Preview: $preview"

$staging = Invoke-RestMethod -Uri "https://vibenovel-api-staging.moxsenna.workers.dev/api/health"
Write-Host ("Staging health: ok={0}" -f $staging.ok)

foreach ($url in @("https://narraza.web.id", "https://app.narraza.web.id", "https://app.narraza.web.id/login")) {
  $r = Invoke-WebRequest -Uri $url -UseBasicParsing -Method Head
  Write-Host ("HTTP {0}: {1}" -f $r.StatusCode, $url)
}

@{
  userId          = $userId
  projectId       = $projectId
  sessionId       = $sessionId
  beatId          = $beatId
  creditBefore    = $balanceBefore
  creditAfter     = $genRes.data.creditBalance.balance
  creditCost      = $genRes.data.creditCost
  attemptStatus   = $genRes.data.generationAttempt.status
  versionSource   = $genRes.data.version.source
  versionId       = $genRes.data.version.id
  proseLen        = $proseLen
  prosePreview    = $preview
  idempotencyKey  = $idem
} | ConvertTo-Json -Depth 4 | Set-Content (Join-Path $RepoRoot "agent-tools\task-10.28-result.json")

Write-Host "`nTask 10.28 founder AI test: GO" -ForegroundColor Green