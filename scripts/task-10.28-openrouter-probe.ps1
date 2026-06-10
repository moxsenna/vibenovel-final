# Probe OpenRouter models without printing API key
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot "lib\staging-smoke-common.ps1")
Import-DotEnvFile -Path (Join-Path $RepoRoot ".env.production")

$key = $env:OPENROUTER_API_KEY
$base = ($env:OPENROUTER_BASE_URL).Trim().TrimEnd("/")
if ([string]::IsNullOrWhiteSpace($key)) { throw "OPENROUTER_API_KEY missing" }

$models = @(
  "google/gemma-2-9b-it",
  "google/gemini-2.5-flash",
  "google/gemini-flash-latest"
)

foreach ($model in $models) {
  $body = @{
    model = $model
    messages = @(@{ role = "user"; content = "Tulis satu kalimat pendek dalam Bahasa Indonesia tentang keluarga." })
    max_tokens = 60
    temperature = 0.7
  } | ConvertTo-Json -Depth 5

  try {
    $res = Invoke-WebRequest -Uri "$base/chat/completions" -Method POST `
      -Headers @{
        Authorization = "Bearer $key"
        "Content-Type" = "application/json"
        "HTTP-Referer" = "https://narraza.web.id"
        "X-Title" = "Narraza API Probe"
      } -Body $body -UseBasicParsing
    $json = $res.Content | ConvertFrom-Json
    $text = $json.choices[0].message.content
    $preview = if ($text.Length -gt 80) { $text.Substring(0, 80) + "..." } else { $text }
    Write-Host "MODEL $model : HTTP $($res.StatusCode) OK - $preview"
  } catch {
    $status = $_.Exception.Response.StatusCode.value__
    $detail = ""
    try {
      $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
      $detail = $reader.ReadToEnd()
      if ($detail.Length -gt 200) { $detail = $detail.Substring(0, 200) + "..." }
    } catch { }
    Write-Host "MODEL $model : HTTP $status FAIL - $detail"
  }
}