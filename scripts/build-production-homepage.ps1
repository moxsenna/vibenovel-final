<#
.SYNOPSIS
  Prepare production homepage static assets (Task 10.24).

.DESCRIPTION
  Copies apps/homepage source to apps/homepage/dist for Cloudflare Pages deploy.
  Apex narraza.web.id only — not the dashboard app.
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

$src = Join-Path $RepoRoot "apps\homepage"
$dist = Join-Path $src "dist"
$files = @("index.html", "styles.css", "_redirects")

if (-not (Test-Path (Join-Path $src "index.html"))) {
  throw "missing apps/homepage/index.html"
}

if (Test-Path $dist) {
  Remove-Item $dist -Recurse -Force
}
New-Item -ItemType Directory -Path $dist | Out-Null

foreach ($f in $files) {
  $from = Join-Path $src $f
  if (Test-Path $from) {
    Copy-Item $from (Join-Path $dist $f)
  }
}

Write-Host "PASS production homepage build -> apps/homepage/dist" -ForegroundColor Green