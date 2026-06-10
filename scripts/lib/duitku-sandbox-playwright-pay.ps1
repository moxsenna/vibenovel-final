# Playwright: open Duitku sandbox checkout and attempt test payment (Task 10.13b)
param(
  [string]$OrderId = "0c0818e1-e081-4d83-872f-cf9f200714a3",
  [string]$RepoRoot = ""
)
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
  $RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
}
. (Join-Path (Split-Path -Parent $PSScriptRoot) "lib\staging-smoke-common.ps1")
Import-StagingSupabaseEnv -RepoRoot $RepoRoot
$sr = Get-StagingSupabaseCredential "STAGING_SUPABASE_SERVICE_ROLE_KEY"
$url = Get-StagingSupabaseCredential "STAGING_SUPABASE_URL"
$order = (Invoke-RestMethod -Uri "$url/rest/v1/credit_topup_orders?id=eq.$OrderId&select=payment_url,status" -Headers @{ apikey=$sr; Authorization="Bearer $sr" })[0]
if ($order.status -ne "pending") { Write-Host "Order already $($order.status)"; exit 0 }
$paymentUrl = [string]$order.payment_url
if ([string]::IsNullOrWhiteSpace($paymentUrl)) { throw "no payment_url" }

Push-Location $RepoRoot
try {
  $repoRootJs = ($RepoRoot -replace '\\', '/')
  $spec = @"
const { chromium } = require('$repoRootJs/node_modules/@playwright/test');
(async () => {
  const url = process.env.DUITKU_PAY_URL;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  const title = await page.title();
  console.log('title=' + title);
  const body = await page.locator('body').innerText();
  if (/sandbox|simulasi|test/i.test(body)) console.log('sandbox_ui=true');
  const clickFirst = async (locator, label) => {
    if (await locator.count()) {
      await locator.click({ timeout: 15000 });
      await page.waitForTimeout(2500);
      console.log('clicked_' + label + '=true');
      return true;
    }
    return false;
  };
  const buttons = await page.locator('button, a, input[type=submit]').allTextContents();
  const sample = buttons.filter(Boolean).slice(0, 20).join(' | ');
  console.log('actions_sample=' + sample.substring(0, 400));
  // Step 1: pick a sandbox-friendly method (BCA VA common in Duitku sandbox)
  await clickFirst(page.getByText(/Klik BCA|BCA VA|m-BCA/i).first(), 'bca_method')
    || await clickFirst(page.getByText(/QRIS|DUITKU QRIS/i).first(), 'qris_method')
    || await clickFirst(page.getByText(/OVO|DANA|SHOPEE/i).first(), 'ewallet_method');
  // Step 2: advance through checkout (multiple pages)
  for (let step = 0; step < 6; step++) {
    const body2 = await page.locator('body').innerText();
    console.log('step=' + step + ' url=' + page.url());
    const clicked =
      await clickFirst(page.getByRole('button', { name: /simulasi|simulation|test pay|bayar sekarang|bayar|pay now|lunasi|selesai|confirm|lanjut|continue/i }).first(), 'pay_step_' + step)
      || await clickFirst(page.getByRole('link', { name: /simulasi|bayar|pay|lunasi|selesai|lanjut/i }).first(), 'pay_link_' + step)
      || await clickFirst(page.locator('input[type=submit]').first(), 'submit_' + step);
    if (!clicked) break;
    if (/sukses|success|berhasil|paid|lunas/i.test(body2)) {
      console.log('payment_success_text=true');
      break;
    }
  }
  await page.waitForTimeout(8000);
  const finalBody = await page.locator('body').innerText();
  if (/sukses|success|berhasil|paid|lunas/i.test(finalBody)) console.log('final_status=success');
  else console.log('final_status=pending_or_unknown');
  await browser.close();
})();
"@
  $specPath = Join-Path $env:TEMP "duitku-pay.spec.cjs"
  Set-Content $specPath $spec
  $env:DUITKU_PAY_URL = $paymentUrl
  node $specPath
} finally {
  Pop-Location
  Remove-Item Env:DUITKU_PAY_URL -ErrorAction SilentlyContinue
}
Write-Host "Polling order..."
Start-Sleep -Seconds 10
& (Join-Path $PSScriptRoot "duitku-poll-order.ps1") -OrderId $OrderId