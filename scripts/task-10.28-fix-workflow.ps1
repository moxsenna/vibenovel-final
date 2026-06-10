Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot "lib\staging-smoke-common.ps1")
Import-DotEnvFile -Path (Join-Path $RepoRoot ".env.production")
$sbUrl = $env:SUPABASE_URL.Trim().TrimEnd("/")
$srk = $env:SUPABASE_SERVICE_ROLE_KEY
$h = @{
  apikey        = $srk
  Authorization = "Bearer $srk"
  Prefer        = "return=minimal"
  "Content-Type" = "application/json"
}
$projectId = "c5a9f0fb-7f45-4c9f-b37f-4a2981adeba9"
$body = @{ workflow_phase = "outline_locked" } | ConvertTo-Json
Invoke-RestMethod -Uri "$sbUrl/rest/v1/projects?id=eq.$projectId" -Method PATCH -Headers $h -Body $body | Out-Null
$proj = Invoke-RestMethod -Uri "$sbUrl/rest/v1/projects?id=eq.$projectId&select=workflow_phase" -Headers @{ apikey = $srk; Authorization = "Bearer $srk" }
Write-Host "Patched workflow_phase=$($proj[0].workflow_phase)"