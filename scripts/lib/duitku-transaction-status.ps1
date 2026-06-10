param([string]$OrderId = "2fbe48f5-de17-4f5b-850a-23d1d07179c8", [string]$RepoRoot = "")
Set-StrictMode -Version Latest
if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
  $RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
}
. (Join-Path (Split-Path -Parent $PSScriptRoot) "lib\staging-smoke-common.ps1")
Import-DotEnvFile -Path (Join-Path $RepoRoot ".env.staging.duitku")
$code = [Environment]::GetEnvironmentVariable("DUITKU_MERCHANT_CODE")
$key = [Environment]::GetEnvironmentVariable("DUITKU_MERCHANT_KEY")
if ([string]::IsNullOrWhiteSpace($code) -or [string]::IsNullOrWhiteSpace($key)) { throw "missing duitku creds" }
$toSign = "$code$OrderId$key"
$md5 = [System.Security.Cryptography.MD5]::Create()
$sig = ([BitConverter]::ToString($md5.ComputeHash([Text.Encoding]::UTF8.GetBytes($toSign))) -replace '-', '').ToLower()
$md5.Dispose()
$body = (@{ merchantCode = $code; merchantOrderId = $OrderId; signature = $sig } | ConvertTo-Json -Compress)
$resp = Invoke-RestMethod -Uri "https://api-sandbox.duitku.com/api/merchant/transactionStatus" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 45
$safe = $resp | ConvertTo-Json -Depth 4 -Compress
$safe = $safe -replace $key, '[redacted]'
Write-Host "duitku_statusCode=$($resp.statusCode) statusMessage=$($resp.statusMessage) reference=$($resp.reference)"
Write-Host "detail=$safe"