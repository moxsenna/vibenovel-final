param([Parameter(Mandatory)][string]$WebhookId)
Set-StrictMode -Version Latest
$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
. (Join-Path (Split-Path -Parent $PSScriptRoot) "lib\staging-smoke-common.ps1")
Import-StagingSupabaseEnv -RepoRoot $RepoRoot
$sr = Get-StagingSupabaseCredential "STAGING_SUPABASE_SERVICE_ROLE_KEY"
$base = Get-StagingSupabaseCredential "STAGING_SUPABASE_URL"
$h = @{ apikey = $sr; Authorization = "Bearer $sr"; Prefer = "return=minimal" }
Invoke-RestMethod -Uri "$base/rest/v1/payment_webhook_events?id=eq.$WebhookId" -Method DELETE -Headers $h
Write-Host "deleted webhook $WebhookId"