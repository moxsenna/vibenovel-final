$ErrorActionPreference = "Stop"
$base = "https://app.narraza.web.id"
$js = "$base/assets/index-CCUIgaLV.js"
$css = "$base/assets/index-u6ZJoxD9.css"

$jsBody = curl.exe -sS $js
$cssBody = curl.exe -sS $css

Write-Host "JS bytes: $($jsBody.Length)"
Write-Host "CSS bytes: $($cssBody.Length)"

$forbidden = @(
  "api-staging.narraza.web.id",
  "vibenovel-web-staging.pages.dev",
  "localhost",
  "127.0.0.1",
  "jdxyhrnibmmwlbtbokqo"
)
$required = "api.narraza.web.id"

Write-Host "`n--- Forbidden pattern scan (JS) ---"
foreach ($pat in $forbidden) {
  $hit = $jsBody -match [regex]::Escape($pat)
  Write-Host "$pat : $(if ($hit) { 'FOUND' } else { 'absent' })"
}

Write-Host "`n--- Required API URL (JS) ---"
Write-Host "api.narraza.web.id : $(if ($jsBody -match [regex]::Escape($required)) { 'FOUND' } else { 'MISSING' })"

Write-Host "`n--- HTTP status ---"
foreach ($url in @("$base/", "$js", "$css", "$base/login", "$base/dashboard")) {
  $code = curl.exe -sS -o NUL -w "%{http_code}" $url
  Write-Host "$url -> $code"
}

Write-Host "`n--- Root domain ---"
$rootCode = curl.exe -sS -o NUL -w "%{http_code}" "https://narraza.web.id/"
Write-Host "https://narraza.web.id/ -> $rootCode"