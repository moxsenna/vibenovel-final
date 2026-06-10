<#
.SYNOPSIS
  Shared helpers for cloud-agnostic staging smoke scripts (Task 11.2).

.DESCRIPTION
  Dot-source from smoke-staging.ps1 and related scripts:
    . (Join-Path $PSScriptRoot "lib\staging-smoke-common.ps1")

  Never logs secret values. Redacts keys in output.
#>

Set-StrictMode -Version Latest

$script:DefaultStagingApiUrl = "https://vibenovel-api-staging.moxsenna.workers.dev"
$script:DefaultStagingWebUrl = "https://vibenovel-web-staging.pages.dev"
$script:DefaultTargetName = "cloudflare-staging"

function Get-RedactedValue {
  param([string]$Value, [int]$VisiblePrefix = 4)
  if ([string]::IsNullOrWhiteSpace($Value)) { return "[not set]" }
  if ($Value.Length -le ($VisiblePrefix + 4)) { return "[redacted]" }
  return ($Value.Substring(0, $VisiblePrefix) + "…[redacted]")
}

function Import-DotEnvFile {
  param(
    [string]$Path,
    [hashtable]$KeyMap = @{}
  )
  if (-not (Test-Path $Path)) { return }
  foreach ($line in Get-Content $Path) {
    if ($line -match '^\s*#' -or $line -notmatch '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') { continue }
    $key = $Matches[1]
    $val = $Matches[2].Trim().Trim('"').Trim("'")
    if ([string]::IsNullOrWhiteSpace($val)) { continue }
    $target = if ($KeyMap.ContainsKey($key)) { $KeyMap[$key] } else { $key }
    if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($target))) {
      [Environment]::SetEnvironmentVariable($target, $val, 'Process')
    }
  }
}

function Import-StagingSupabaseEnv {
  param([string]$RepoRoot = "")
  if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
    $RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
  }

  $stagingMap = @{
    'SUPABASE_URL' = 'STAGING_SUPABASE_URL'
    'SUPABASE_ANON_KEY' = 'STAGING_SUPABASE_ANON_KEY'
    'SUPABASE_SERVICE_ROLE_KEY' = 'STAGING_SUPABASE_SERVICE_ROLE_KEY'
  }
  Import-DotEnvFile -Path (Join-Path $RepoRoot ".env.staging") -KeyMap $stagingMap

  $webMap = @{
    'VITE_SUPABASE_URL' = 'STAGING_SUPABASE_URL'
    'VITE_SUPABASE_ANON_KEY' = 'STAGING_SUPABASE_ANON_KEY'
    'SUPABASE_SERVICE_ROLE_KEY' = 'STAGING_SUPABASE_SERVICE_ROLE_KEY'
  }
  Import-DotEnvFile -Path (Join-Path $RepoRoot "apps\web\.env.local") -KeyMap $webMap
}

function Get-StagingSupabaseCredential {
  param([string]$Name)
  $v = [Environment]::GetEnvironmentVariable($Name)
  if (-not [string]::IsNullOrWhiteSpace($v)) { return $v.Trim() }
  return $null
}

function Resolve-StagingApiBaseUrl {
  param([string]$ApiBaseUrl = "")
  if (-not [string]::IsNullOrWhiteSpace($ApiBaseUrl)) { return $ApiBaseUrl.Trim().TrimEnd('/') }
  if (-not [string]::IsNullOrWhiteSpace($env:VIBENOVEL_STAGING_API_URL)) {
    return $env:VIBENOVEL_STAGING_API_URL.Trim().TrimEnd('/')
  }
  return $script:DefaultStagingApiUrl
}

function Resolve-StagingWebBaseUrl {
  param([string]$WebBaseUrl = "")
  if (-not [string]::IsNullOrWhiteSpace($WebBaseUrl)) { return $WebBaseUrl.Trim().TrimEnd('/') }
  if (-not [string]::IsNullOrWhiteSpace($env:VIBENOVEL_STAGING_WEB_URL)) {
    return $env:VIBENOVEL_STAGING_WEB_URL.Trim().TrimEnd('/')
  }
  return $script:DefaultStagingWebUrl
}

function Test-IsLocalSupabaseUrl {
  param([string]$Url)
  if ([string]::IsNullOrWhiteSpace($Url)) { return $true }
  try {
    $host = ([Uri]$Url.Trim()).Host.ToLowerInvariant()
    return ($host -eq "127.0.0.1" -or $host -eq "localhost" -or $host -eq "::1")
  } catch {
    return $false
  }
}

function Resolve-StagingSupabaseUrl {
  param(
    [string]$SupabaseUrl = "",
    [string]$DefaultLocalUrl = "http://127.0.0.1:54321",
    [string]$RepoRoot = ""
  )
  if (-not [string]::IsNullOrWhiteSpace($SupabaseUrl)) { return $SupabaseUrl.Trim().TrimEnd('/') }
  if (-not [string]::IsNullOrWhiteSpace($env:STAGING_SUPABASE_URL)) {
    return $env:STAGING_SUPABASE_URL.Trim().TrimEnd('/')
  }
  if (-not [string]::IsNullOrWhiteSpace($env:SUPABASE_URL)) {
    $candidate = $env:SUPABASE_URL.Trim().TrimEnd('/')
    if (-not (Test-IsLocalSupabaseUrl $candidate)) { return $candidate }
  }
  if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
    $RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
  }
  $webEnv = Join-Path $RepoRoot "apps\web\.env.local"
  if (Test-Path $webEnv) {
    foreach ($line in Get-Content $webEnv) {
      if ($line -match '^\s*VITE_SUPABASE_URL=(.+)$') {
        $candidate = $Matches[1].Trim().Trim('"').Trim("'").TrimEnd('/')
        if (-not (Test-IsLocalSupabaseUrl $candidate)) { return $candidate }
      }
    }
  }
  return $DefaultLocalUrl
}

function Resolve-StagingSupabaseAnonKey {
  param(
    [string]$SupabaseAnonKey = "",
    [string]$SupabaseUrl = "",
    [string]$RepoRoot = ""
  )
  if (-not [string]::IsNullOrWhiteSpace($SupabaseAnonKey)) { return $SupabaseAnonKey.Trim() }
  if (-not [string]::IsNullOrWhiteSpace($env:STAGING_SUPABASE_ANON_KEY)) {
    return $env:STAGING_SUPABASE_ANON_KEY.Trim()
  }
  if (-not [string]::IsNullOrWhiteSpace($env:SUPABASE_ANON_KEY)) {
    $candidate = $env:SUPABASE_ANON_KEY.Trim()
    if (-not [string]::IsNullOrWhiteSpace($candidate)) { return $candidate }
  }

  if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
    $RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
  }
  $webEnv = Join-Path $RepoRoot "apps\web\.env.local"
  if ((Test-Path $webEnv) -and -not (Test-IsLocalSupabaseUrl $SupabaseUrl)) {
    foreach ($line in Get-Content $webEnv) {
      if ($line -match '^\s*VITE_SUPABASE_ANON_KEY=(.+)$') {
        $candidate = $Matches[1].Trim().Trim('"').Trim("'")
        if (-not [string]::IsNullOrWhiteSpace($candidate)) { return $candidate }
      }
    }
  }

  if (Test-IsLocalSupabaseUrl $SupabaseUrl) {
    if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
      $RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
    }
    try {
      Push-Location $RepoRoot
      foreach ($line in (& supabase status -o env 2>$null)) {
        if ($line -match '^ANON_KEY="(.+)"\s*$') { return $Matches[1] }
      }
    } finally {
      Pop-Location
    }
  }

  return $null
}

function Get-StagingSupabaseParamsPresent {
  param(
    [string]$SupabaseUrl = "",
    [string]$SupabaseAnonKey = ""
  )
  $url = Resolve-StagingSupabaseUrl -SupabaseUrl $SupabaseUrl
  $key = Resolve-StagingSupabaseAnonKey -SupabaseAnonKey $SupabaseAnonKey -SupabaseUrl $url
  return @{
    Url = $url
    AnonKey = $key
    Present = (-not [string]::IsNullOrWhiteSpace($url) -and -not [string]::IsNullOrWhiteSpace($key) -and -not (Test-IsLocalSupabaseUrl $url))
  }
}

function Invoke-StagingHealthCheck {
  param(
    [string]$ApiBaseUrl,
    [switch]$RequireSupabase,
    [string[]]$AcceptAppEnvs = @("staging")
  )

  $uri = "$($ApiBaseUrl.TrimEnd('/'))/api/health"
  try {
    $health = Invoke-RestMethod -Uri $uri -Method GET -TimeoutSec 20
  } catch {
    return @{ Ok = $false; Error = $_.Exception.Message; Health = $null }
  }

  if (-not $health.ok) {
    return @{ Ok = $false; Error = "ok=false"; Health = $health }
  }

  $envFlags = $health.data.env
  $fail = 0
  $checks = @()

  $appEnvOk = $AcceptAppEnvs -contains $envFlags.appEnv
  $checks += @{ Name = "appEnv=$($envFlags.appEnv)"; Ok = $appEnvOk }
  $checks += @{ Name = "creditTopupEnabled=false"; Ok = (-not [bool]$envFlags.creditTopupEnabled) }
  $checks += @{ Name = "paymentProviderMock=true"; Ok = ([bool]$envFlags.paymentProviderMock) }
  $checks += @{ Name = "paymentProvider=mock"; Ok = ($envFlags.paymentProvider -eq "mock") }
  $checks += @{ Name = "aiGenerationEnabled=false"; Ok = (-not [bool]$envFlags.aiGenerationEnabled) }

  if ($RequireSupabase) {
    $checks += @{ Name = "hasSupabaseUrl=true"; Ok = [bool]$envFlags.hasSupabaseUrl }
    $checks += @{ Name = "hasSupabaseAnonKey=true"; Ok = [bool]$envFlags.hasSupabaseAnonKey }
    $checks += @{ Name = "hasSupabaseServiceRoleKey=true"; Ok = [bool]$envFlags.hasSupabaseServiceRoleKey }
  }

  foreach ($c in $checks) {
    if (-not $c.Ok) { $fail++ }
  }

  $json = $health | ConvertTo-Json -Depth 6 -Compress
  $badPatterns = @(
    "SUPABASE_SERVICE_ROLE", "service_role", "DUITKU_MERCHANT", "MAYAR_API_KEY", "OPENROUTER_API_KEY"
  )
  foreach ($pat in $badPatterns) {
    if ($json -match [regex]::Escape($pat)) { $fail++ }
  }

  return @{
    Ok = ($fail -eq 0)
    Error = $null
    Checks = $checks
    Health = $health
    EnvFlags = $envFlags
  }
}

function Test-StagingWebReachable {
  param([string]$WebBaseUrl, [string[]]$Paths = @("/", "/credits/topup"))
  $results = @()
  foreach ($path in $Paths) {
    $uri = "$($WebBaseUrl.TrimEnd('/'))$path"
    try {
      $resp = Invoke-WebRequest -Uri $uri -Method GET -TimeoutSec 20 -UseBasicParsing
      $results += @{ Path = $path; Ok = ($resp.StatusCode -eq 200); Status = $resp.StatusCode }
    } catch {
      $status = $null
      if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
      $results += @{ Path = $path; Ok = $false; Status = $status; Error = $_.Exception.Message }
    }
  }
  return $results
}

function Test-StagingCors {
  param(
    [string]$ApiBaseUrl,
    [string]$WebBaseUrl
  )
  $uri = "$($ApiBaseUrl.TrimEnd('/'))/api/health"
  try {
    $resp = Invoke-WebRequest -Uri $uri -Method GET -TimeoutSec 20 -UseBasicParsing `
      -Headers @{ Origin = $WebBaseUrl }
    $acao = $resp.Headers["Access-Control-Allow-Origin"]
    if ([string]::IsNullOrWhiteSpace($acao)) {
      $acao = $resp.Headers["access-control-allow-origin"]
    }
    $ok = ($acao -eq $WebBaseUrl -or $acao -eq "*")
    return @{ Ok = $ok; AllowOrigin = $acao }
  } catch {
    return @{ Ok = $false; Error = $_.Exception.Message }
  }
}

function Resolve-StagingSmokeTestEmail {
  param([string]$TestEmail = "")
  if (-not [string]::IsNullOrWhiteSpace($TestEmail)) { return $TestEmail.Trim() }
  if (-not [string]::IsNullOrWhiteSpace($env:SMOKE_TEST_EMAIL)) { return $env:SMOKE_TEST_EMAIL.Trim() }
  return $null
}

function Invoke-StagingAuthSignupSmoke {
  param(
    [string]$SupabaseUrl,
    [string]$SupabaseAnonKey,
    [string]$TestEmail = "",
    [string]$TestPassword = "VibeNovel-Staging-Smoke-Test!"
  )
  $fixedEmail = Resolve-StagingSmokeTestEmail -TestEmail $TestEmail
  if ([string]::IsNullOrWhiteSpace($fixedEmail)) {
    $fixedEmail = "staging-smoke-$(Get-Random -Maximum 99999999)@example.com"
  }
  $authHeaders = @{ apikey = $SupabaseAnonKey; Authorization = "Bearer $SupabaseAnonKey" }
  $body = (@{ email = $fixedEmail; password = $TestPassword } | ConvertTo-Json)
  $signupError = $null
  $loginError = $null

  try {
    $signup = Invoke-RestMethod -Uri "$SupabaseUrl/auth/v1/signup" -Method POST `
      -Headers $authHeaders -ContentType "application/json" -Body $body
    if ($signup.access_token) {
      return @{ Ok = $true; Email = $fixedEmail; Mode = "signup" }
    }
  } catch {
    $signupError = $_.Exception.Message
  }

  try {
    $signin = Invoke-RestMethod -Uri "$SupabaseUrl/auth/v1/token?grant_type=password" -Method POST `
      -Headers $authHeaders -ContentType "application/json" -Body $body
    if ($signin.access_token) {
      return @{ Ok = $true; Email = $fixedEmail; Mode = "login" }
    }
  } catch {
    $loginError = $_.Exception.Message
  }

  $detail = if ($signupError -and $loginError) { "$signupError | login: $loginError" } elseif ($signupError) { $signupError } else { $loginError }
  return @{ Ok = $false; Error = $detail; Email = $fixedEmail }
}