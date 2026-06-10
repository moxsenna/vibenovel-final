function Get-WranglerOAuthToken {
  $paths = @(
    (Join-Path $env:APPDATA "xdg.config\.wrangler\config\default.toml"),
    (Join-Path $env:USERPROFILE ".wrangler\config\default.toml")
  )
  foreach ($p in $paths) {
    if (-not (Test-Path $p)) { continue }
    $line = Get-Content $p | Where-Object { $_ -match '^oauth_token\s*=' } | Select-Object -First 1
    if ($line -match 'oauth_token\s*=\s*"(.+)"') { return $Matches[1] }
  }
  throw "wrangler oauth token not found - run: npx wrangler login"
}

function Add-CloudflarePagesDomain {
  param(
    [Parameter(Mandatory = $true)][string]$AccountId,
    [Parameter(Mandatory = $true)][string]$ProjectName,
    [Parameter(Mandatory = $true)][string]$DomainName
  )
  $token = Get-WranglerOAuthToken
  $uri = "https://api.cloudflare.com/client/v4/accounts/$AccountId/pages/projects/$ProjectName/domains"
  $body = @{ name = $DomainName } | ConvertTo-Json
  $headers = @{
    Authorization = "Bearer $token"
    "Content-Type" = "application/json"
  }
  $resp = Invoke-RestMethod -Method Post -Uri $uri -Headers $headers -Body $body -TimeoutSec 60
  if (-not $resp.success) {
    $msg = ($resp.errors | ForEach-Object { $_.message }) -join "; "
    throw "Cloudflare API failed: $msg"
  }
  return $resp.result
}