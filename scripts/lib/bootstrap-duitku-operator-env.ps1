# Creates gitignored .env.staging.duitku from commented DUITKU_* in .env.staging
param([string]$RepoRoot = "")
if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
  $RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
}
$stagingPath = Join-Path $RepoRoot ".env.staging"
$outPath = Join-Path $RepoRoot ".env.staging.duitku"
if (-not (Test-Path $stagingPath)) { throw ".env.staging missing" }
$duitkuLines = New-Object System.Collections.Generic.List[string]
foreach ($line in Get-Content $stagingPath) {
  if ($line -match '^\s*#\s*(DUITKU_[A-Za-z0-9_]+)=(.*)$') {
    $key = $Matches[1]
    $val = $Matches[2].Trim()
    if ($key -eq "DUITKU_CALLBACK_URL") {
      $val = "https://api-staging.narraza.web.id/api/payments/duitku/callback"
    }
    if ($key -eq "DUITKU_RETURN_URL") {
      $val = "https://vibenovel-web-staging.pages.dev/credits/topup/return"
    }
    if (-not [string]::IsNullOrWhiteSpace($val)) {
      $duitkuLines.Add("$key=$val") | Out-Null
    }
  }
}
if ($duitkuLines.Count -lt 2) { throw "No uncommented DUITKU merchant code/key found in .env.staging comments" }
$header = @(
  "# Mode B - Duitku sandbox (gitignored)",
  "CREDIT_TOPUP_ENABLED=true",
  "PAYMENT_PROVIDER=duitku",
  "PAYMENT_PROVIDER_MOCK=false",
  "DUITKU_ENV=sandbox"
)
Set-Content -Path $outPath -Value (($header + $duitkuLines) -join [Environment]::NewLine)
Write-Host "Created $outPath ($($duitkuLines.Count) DUITKU vars, values not logged)"