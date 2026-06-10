<#
.SYNOPSIS
  Build production app/dashboard for Cloudflare Pages (Task 10.23 / 10.23a).

.DESCRIPTION
  Forces VITE_* from .env.production so apps/web/.env.local (staging) cannot bleed in.
  App target: https://app.narraza.web.id (not root narraza.web.id).
#>
[CmdletBinding()]
param(
  [string]$RepoRoot = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
  $RepoRoot = Split-Path -Parent $PSScriptRoot
}

. (Join-Path $PSScriptRoot "lib\staging-smoke-common.ps1")

$envPath = Join-Path $RepoRoot ".env.production"
if (-not (Test-Path $envPath)) { throw "missing .env.production" }

Import-DotEnvFile -Path $envPath

$viteUrl = $env:VITE_SUPABASE_URL
if ([string]::IsNullOrWhiteSpace($viteUrl)) { $viteUrl = $env:SUPABASE_URL }
$viteAnon = $env:VITE_SUPABASE_ANON_KEY
if ([string]::IsNullOrWhiteSpace($viteAnon)) { $viteAnon = $env:SUPABASE_ANON_KEY }

if (-not $viteUrl -or -not $viteAnon) { throw "production supabase keys required" }
if ($viteUrl -match 'jdxyhrnibmmwlbtbokqo') { throw "staging supabase forbidden in web build" }

$apiUrl = $env:VITE_API_URL
if ([string]::IsNullOrWhiteSpace($apiUrl)) { $apiUrl = "https://api.narraza.web.id" }
$siteUrl = $env:VITE_PUBLIC_SITE_URL
if ([string]::IsNullOrWhiteSpace($siteUrl)) { $siteUrl = "https://narraza.web.id" }
$appUrl = $env:VITE_APP_URL
if ([string]::IsNullOrWhiteSpace($appUrl)) { $appUrl = "https://app.narraza.web.id" }

$env:VITE_API_URL = $apiUrl.Trim().TrimEnd('/')
$env:VITE_PUBLIC_SITE_URL = $siteUrl.Trim().TrimEnd('/')
$env:VITE_APP_URL = $appUrl.Trim().TrimEnd('/')
$env:VITE_SUPABASE_URL = $viteUrl
$env:VITE_SUPABASE_ANON_KEY = $viteAnon
$env:VITE_USE_MOCKS = "false"

Write-Host "Building production app (VITE_API_URL=$($env:VITE_API_URL), VITE_APP_URL=$($env:VITE_APP_URL))" -ForegroundColor Cyan
Push-Location $RepoRoot
try {
  npm run build:web
  if ($LASTEXITCODE -ne 0) { throw "build:web failed" }
} finally {
  Pop-Location
  Remove-Item Env:VITE_API_URL, Env:VITE_PUBLIC_SITE_URL, Env:VITE_APP_URL, Env:VITE_SUPABASE_URL, Env:VITE_SUPABASE_ANON_KEY, Env:VITE_USE_MOCKS -ErrorAction SilentlyContinue
}

Write-Host "PASS production app build" -ForegroundColor Green