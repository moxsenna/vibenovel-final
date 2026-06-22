<#
.SYNOPSIS
  Admin Sprint A API smoke — /api/admin guards and stubs.

.DESCRIPTION
  Run from repo root:
    npm run smoke:api:admin

  Prerequisites:
    - supabase start (local) or hosted Supabase env vars
    - npm run dev:api (default http://127.0.0.1:8787)
    - SUPABASE_SERVICE_ROLE_KEY (or local `supabase status -o env`)

  Covers:
    - GET /api/admin/users without token → 401
    - Writer JWT → 403 FORBIDDEN
    - Admin JWT → list + detail OK
    - POST credits/grant → 501 NOT_IMPLEMENTED (Codex stub)

  Security: does not print JWT or service role keys.
#>
[CmdletBinding()]
param(
  [string]$ApiBaseUrl = "http://127.0.0.1:8787",
  [string]$SupabaseUrl = "http://127.0.0.1:54321",
  [string]$SupabaseAnonKey = "",
  [string]$WriterEmail = "",
  [string]$AdminEmail = "",
  [string]$TestPassword = "VibeNovel-Admin-Smoke-Test!"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Continue"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$Results = New-Object System.Collections.Generic.List[object]
$StepNumber = 0
$script:ServiceRoleKey = $null

function Add-StepResult {
  param(
    [string]$Name,
    [ValidateSet("PASS", "FAIL", "SKIP")]
    [string]$Result,
    [string]$Detail = ""
  )
  $script:StepNumber++
  $Results.Add([PSCustomObject]@{
      Step   = $script:StepNumber
      Test   = $Name
      Result = $Result
      Detail = $Detail
    }) | Out-Null
  $color = switch ($Result) { "PASS" { "Green" } "FAIL" { "Red" } "SKIP" { "Yellow" } }
  Write-Host ("[{0}] {1,-44} {2}" -f $Result, $Name, $Detail) -ForegroundColor $color
}

function Get-SafeDetail {
  param([string]$Text)
  if ([string]::IsNullOrWhiteSpace($Text)) { return "" }
  $sanitized = $Text -replace 'Bearer\s+[A-Za-z0-9._-]+', 'Bearer [redacted]'
  $sanitized = $sanitized -replace 'eyJ[A-Za-z0-9._-]{20,}', '[jwt-redacted]'
  if ($sanitized.Length -gt 120) { return $sanitized.Substring(0, 117) + "..." }
  return $sanitized
}

function Resolve-SupabaseAnonKey {
  if (-not [string]::IsNullOrWhiteSpace($SupabaseAnonKey)) { return $SupabaseAnonKey.Trim() }
  if (-not [string]::IsNullOrWhiteSpace($env:SUPABASE_ANON_KEY)) { return $env:SUPABASE_ANON_KEY.Trim() }
  Push-Location $RepoRoot
  try {
    foreach ($line in (& supabase status -o env 2>$null)) {
      if ($line -match '^ANON_KEY="(.+)"\s*$') { return $Matches[1] }
    }
  } finally { Pop-Location }
  throw "Supabase anon key not found."
}

function Resolve-ServiceRoleKey {
  if ($script:ServiceRoleKey) { return $script:ServiceRoleKey }
  if (-not [string]::IsNullOrWhiteSpace($env:SUPABASE_SERVICE_ROLE_KEY)) {
    $script:ServiceRoleKey = $env:SUPABASE_SERVICE_ROLE_KEY.Trim()
    return $script:ServiceRoleKey
  }
  Push-Location $RepoRoot
  try {
    foreach ($line in (& supabase status -o env 2>$null)) {
      if ($line -match '^SERVICE_ROLE_KEY="(.+)"\s*$') {
        $script:ServiceRoleKey = $Matches[1]
        return $script:ServiceRoleKey
      }
    }
  } finally { Pop-Location }
  throw "Supabase service role key not found."
}

function Invoke-Api {
  param(
    [string]$Method = "GET",
    [string]$Path,
    [hashtable]$Headers = @{},
    $Body = $null
  )
  $uri = "$ApiBaseUrl$Path"
  $params = @{
    Uri         = $uri
    Method      = $Method
    Headers     = $Headers
    ErrorAction = "Stop"
  }
  if ($null -ne $Body -and $Body -ne "") {
    $params.ContentType = "application/json"
    $params.Body = $Body
  }
  return Invoke-RestMethod @params
}

function Get-ApiErrorPayload {
  param($ErrorRecord)
  $raw = $null
  if ($null -ne $ErrorRecord.ErrorDetails -and $ErrorRecord.ErrorDetails.Message) {
    $raw = $ErrorRecord.ErrorDetails.Message
  }
  if (-not $raw) { return $null }
  try { return ($raw | ConvertFrom-Json) } catch { return $null }
}

function Invoke-ApiExpectErrorCode {
  param(
    [string]$Name,
    [string]$Method = "GET",
    [string]$Path,
    [hashtable]$Headers = @{},
    [string]$Body = $null,
    [string]$ExpectedCode
  )
  try {
    Invoke-Api -Method $Method -Path $Path -Headers $Headers -Body $Body | Out-Null
    Add-StepResult $Name "FAIL" "expected $ExpectedCode, got 2xx"
  } catch {
    $payload = Get-ApiErrorPayload $_
    $code = if ($payload -and $payload.error.code) { $payload.error.code } else { "unknown" }
    if ($code -eq $ExpectedCode) {
      Add-StepResult $Name "PASS" "code=$code"
    } else {
      Add-StepResult $Name "FAIL" "expected=$ExpectedCode got=$code"
    }
  }
}

function Get-AccessToken {
  param([string]$Email, [string]$AnonKey)
  $authHeaders = @{ apikey = $AnonKey; Authorization = "Bearer $AnonKey" }
  $body = (@{ email = $Email; password = $TestPassword } | ConvertTo-Json)
  try {
    $signup = Invoke-RestMethod -Uri "$SupabaseUrl/auth/v1/signup" -Method POST -Headers $authHeaders -ContentType "application/json" -Body $body
    if ($signup.PSObject.Properties.Name -contains "access_token") { return $signup.access_token }
  } catch { }
  $signin = Invoke-RestMethod -Uri "$SupabaseUrl/auth/v1/token?grant_type=password" -Method POST -Headers $authHeaders -ContentType "application/json" -Body $body
  return $signin.access_token
}

function Ensure-AuthUser {
  param([string]$Email, [string]$AnonKey)
  $token = Get-AccessToken -Email $Email -AnonKey $AnonKey
  if ($token) { return $token }
  try {
    $srk = Resolve-ServiceRoleKey
    Invoke-RestMethod -Uri "$SupabaseUrl/auth/v1/admin/users" -Method POST `
      -Headers @{ apikey = $srk; Authorization = "Bearer $srk" } -ContentType "application/json" `
      -Body (@{ email = $Email; password = $TestPassword; email_confirm = $true } | ConvertTo-Json) | Out-Null
  } catch { }
  $token = Get-AccessToken -Email $Email -AnonKey $AnonKey
  if (-not $token) { throw "no token for $Email" }
  return $token
}

function Get-UserIdFromToken {
  param([string]$Token, [string]$AnonKey)
  $me = Invoke-RestMethod -Uri "$ApiBaseUrl/api/me" -Headers @{ Authorization = "Bearer $Token" }
  return $me.data.user.id
}

function Set-ProfileRole {
  param([string]$UserId, [string]$Role)
  $srk = Resolve-ServiceRoleKey
  $headers = @{
    apikey        = $srk
    Authorization = "Bearer $srk"
    Prefer        = "return=minimal"
  }
  $uri = "$SupabaseUrl/rest/v1/profiles?id=eq.$UserId"
  $body = (@{ role = $Role } | ConvertTo-Json)
  Invoke-RestMethod -Uri $uri -Method PATCH -Headers $headers -ContentType "application/json" -Body $body | Out-Null
}

Write-Host "`nNarraza Admin API Smoke" -ForegroundColor Cyan
Write-Host "API: $ApiBaseUrl"

try {
  $anonKey = Resolve-SupabaseAnonKey
  Add-StepResult "resolve anon key" "PASS" ""
} catch {
  Add-StepResult "resolve anon key" "FAIL" $_.Exception.Message
  exit 1
}

if ([string]::IsNullOrWhiteSpace($WriterEmail)) {
  $WriterEmail = "adminsmoke-writer-$(Get-Random -Maximum 99999999)@example.com"
}
if ([string]::IsNullOrWhiteSpace($AdminEmail)) {
  $AdminEmail = "adminsmoke-admin-$(Get-Random -Maximum 99999999)@example.com"
}

try {
  $null = Invoke-RestMethod "$ApiBaseUrl/health"
  Add-StepResult "GET /health" "PASS" ""
} catch {
  Add-StepResult "GET /health" "FAIL" (Get-SafeDetail $_.Exception.Message)
}

Invoke-ApiExpectErrorCode -Name "GET /api/admin/users no token" -Path "/api/admin/users" -ExpectedCode "UNAUTHORIZED"

try {
  $writerToken = Ensure-AuthUser -Email $WriterEmail -AnonKey $anonKey
  Add-StepResult "writer auth" "PASS" "email=$WriterEmail"
} catch {
  Add-StepResult "writer auth" "FAIL" (Get-SafeDetail $_.Exception.Message)
  $writerToken = $null
}

if ($writerToken) {
  $writerAuth = @{ Authorization = "Bearer $writerToken" }
  try {
    Invoke-Api -Path "/api/me" -Headers $writerAuth | Out-Null
    Add-StepResult "GET /api/me writer" "PASS" "profile ensured"
  } catch {
    Add-StepResult "GET /api/me writer" "FAIL" (Get-SafeDetail $_.Exception.Message)
  }

  Invoke-ApiExpectErrorCode -Name "GET /api/admin/users writer" -Path "/api/admin/users" -Headers $writerAuth -ExpectedCode "FORBIDDEN"

  try {
    $writerId = Get-UserIdFromToken -Token $writerToken -AnonKey $anonKey
  } catch {
    $writerId = $null
    Add-StepResult "resolve writer id" "FAIL" (Get-SafeDetail $_.Exception.Message)
  }
} else {
  $writerId = $null
  Add-StepResult "GET /api/admin/users writer" "SKIP" "no writer token"
}

try {
  $adminToken = Ensure-AuthUser -Email $AdminEmail -AnonKey $anonKey
  Add-StepResult "admin auth" "PASS" "email=$AdminEmail"
} catch {
  Add-StepResult "admin auth" "FAIL" (Get-SafeDetail $_.Exception.Message)
  $adminToken = $null
}

if ($adminToken) {
  $adminAuth = @{ Authorization = "Bearer $adminToken" }
  try {
    Invoke-Api -Path "/api/me" -Headers $adminAuth | Out-Null
    $adminId = Get-UserIdFromToken -Token $adminToken -AnonKey $anonKey
    Set-ProfileRole -UserId $adminId -Role "admin"
    Add-StepResult "PATCH profiles role=admin" "PASS" "userId=$adminId"
  } catch {
    Add-StepResult "PATCH profiles role=admin" "FAIL" (Get-SafeDetail $_.Exception.Message)
    $adminId = $null
  }

  if ($adminId) {
    try {
      $list = Invoke-Api -Path "/api/admin/users" -Headers $adminAuth
      $count = @($list.data.users).Count
      Add-StepResult "GET /api/admin/users admin" "PASS" "count=$count"
    } catch {
      Add-StepResult "GET /api/admin/users admin" "FAIL" (Get-SafeDetail $_.Exception.Message)
    }

    if ($writerId) {
      try {
        $detail = Invoke-Api -Path "/api/admin/users/$writerId" -Headers $adminAuth
        $name = $detail.data.user.displayName
        Add-StepResult "GET /api/admin/users/:id" "PASS" "displayName=$name"
      } catch {
        Add-StepResult "GET /api/admin/users/:id" "FAIL" (Get-SafeDetail $_.Exception.Message)
      }

      $grantBody = (@{
          amount         = 10
          reason         = "founder_test"
          note           = "admin smoke"
          idempotencyKey = "admin-smoke-$(Get-Random)"
        } | ConvertTo-Json -Compress)
      Invoke-ApiExpectErrorCode `
        -Name "POST credits/grant stub" `
        -Method POST `
        -Path "/api/admin/users/$writerId/credits/grant" `
        -Headers $adminAuth `
        -Body $grantBody `
        -ExpectedCode "NOT_IMPLEMENTED"
    } else {
      Add-StepResult "GET /api/admin/users/:id" "SKIP" "no writer id"
      Add-StepResult "POST credits/grant stub" "SKIP" "no writer id"
    }
  } else {
    Add-StepResult "GET /api/admin/users admin" "SKIP" "admin role not set"
  }
} else {
  Add-StepResult "GET /api/admin/users admin" "SKIP" "no admin token"
}

Write-Host ""
$Results | Format-Table Step, Test, Result, Detail -AutoSize
$fail = @($Results | Where-Object { $_.Result -eq "FAIL" }).Count
$pass = @($Results | Where-Object { $_.Result -eq "PASS" }).Count
Write-Host "Summary: $pass PASS, $fail FAIL" -ForegroundColor $(if ($fail -gt 0) { "Red" } else { "Green" })
if ($fail -gt 0) { exit 1 }
exit 0