Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot "lib\staging-smoke-common.ps1")
Import-DotEnvFile -Path (Join-Path $RepoRoot ".env.production")
$sbUrl = $env:SUPABASE_URL.Trim().TrimEnd("/")
$anon = $env:SUPABASE_ANON_KEY
$srk = $env:SUPABASE_SERVICE_ROLE_KEY
$adminH = @{ apikey = $srk; Authorization = "Bearer $srk" }
$projectId = "c5a9f0fb-7f45-4c9f-b37f-4a2981adeba9"
$proj = Invoke-RestMethod -Uri "$sbUrl/rest/v1/projects?id=eq.$projectId&select=id,title,workflow_phase" -Headers $adminH
Write-Host "workflow_phase=$($proj[0].workflow_phase)"
$outline = Invoke-RestMethod -Uri "$sbUrl/rest/v1/outline_plans?project_id=eq.$projectId&select=status,locked_at" -Headers $adminH
if ($outline.Count -gt 0) {
  Write-Host "outline status=$($outline[0].status) locked_at=$($outline[0].locked_at)"
} else {
  Write-Host "outline plan: none"
}
$link = Invoke-RestMethod -Uri "$sbUrl/auth/v1/admin/generate_link" -Method POST -Headers ($adminH + @{ "Content-Type" = "application/json" }) `
  -Body '{"type":"magiclink","email":"moxsenna@gmail.com"}'
$verify = Invoke-RestMethod -Uri "$sbUrl/auth/v1/verify" -Method POST `
  -Headers @{ apikey = $anon; Authorization = "Bearer $anon"; "Content-Type" = "application/json" } `
  -Body (@{ type = "magiclink"; token_hash = $link.hashed_token } | ConvertTo-Json)
$auth = @{ Authorization = "Bearer $($verify.access_token)" }
$outlineApi = Invoke-RestMethod -Uri "https://api.narraza.web.id/api/projects/$projectId/outline" -Headers $auth
Write-Host "outlineApi status=$($outlineApi.data.outlinePlan.status) locked=$($outlineApi.data.outlinePlan.isLocked)"