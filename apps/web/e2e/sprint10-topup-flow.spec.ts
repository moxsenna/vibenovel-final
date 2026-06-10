import { expect, test, type Page } from "@playwright/test";

const DOM_LEAK_PATTERNS = [
  /MAYAR_API_KEY/i,
  /MAYAR_WEBHOOK_TOKEN/i,
  /OPENROUTER_API_KEY/i,
  /provider_payload_safe/i,
  /providerPayloadSafe/i,
  /credit_ledger/i,
  /mock_trx_/i,
  /mock_inv_/i,
  /payment_webhook_events/i,
  /"service_role"/i,
];

async function assertNoTopupLeaksInDom(page: Page) {
  const bodyText = await page.locator("body").innerText();
  const html = await page.locator("body").innerHTML();
  for (const pattern of DOM_LEAK_PATTERNS) {
    expect(bodyText).not.toMatch(pattern);
    expect(html).not.toMatch(pattern);
  }
}

async function devAuthLogin(page: Page, email: string, password: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "Dev Auth" }).click();
  await page.getByPlaceholder("email").fill(email);
  await page.getByPlaceholder("password").fill(password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page.getByText(/Masuk:/)).toBeVisible();
}

test.describe("Sprint 10 web smoke — topup mock mode", () => {
  test("topup page shows mock explanation and disables checkout", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/credits/topup");
    await expect(page.getByRole("heading", { name: /Top Up Kredit/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/mode API/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Beli Paket/i })).toHaveCount(0);
    await assertNoTopupLeaksInDom(page);
  });
});

test.describe("Sprint 10 web smoke — topup API mode", () => {
  const apiModeEnabled = process.env.SMOKE_WEB_API_MODE === "true";
  const topupEnabled = process.env.SMOKE_TOPUP_ENABLED === "true";
  const topupDisabled = process.env.SMOKE_TOPUP_DISABLED === "true";
  const testEmail = process.env.SMOKE_TEST_EMAIL?.trim() ?? "";
  const testPassword = process.env.SMOKE_TEST_PASSWORD?.trim() ?? "";
  const apiBaseUrl = process.env.SMOKE_API_URL?.trim() || "http://127.0.0.1:8787";

  test.skip(
    !apiModeEnabled,
    "API mode skipped — run via scripts/sprint10-smoke-web.ps1 -IncludeApiMode",
  );

  test.skip(!testEmail || !testPassword, "Missing SMOKE_TEST_EMAIL or SMOKE_TEST_PASSWORD");

  test("topup disabled shows safe unavailable state", async ({ page }) => {
    test.skip(!topupDisabled, "Requires SMOKE_TOPUP_DISABLED=true on API");

    await page.setViewportSize({ width: 1280, height: 900 });
    await devAuthLogin(page, testEmail, testPassword);
    await page.goto("/credits/topup");
    await expect(page.getByText(/Top up belum tersedia/i).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("button", { name: /Beli Paket/i })).toHaveCount(0);
    await assertNoTopupLeaksInDom(page);
  });

  test("checkout redirects to mock return without leaking provider details", async ({ page }) => {
    test.skip(!topupEnabled, "Requires CREDIT_TOPUP_ENABLED=true on API");

    await page.setViewportSize({ width: 1280, height: 900 });
    await devAuthLogin(page, testEmail, testPassword);
    await page.goto("/credits/topup");
    await expect(page.getByRole("heading", { name: /Top Up Kredit/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("button", { name: /Beli Paket/i }).first()).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole("button", { name: /Beli Paket/i }).first().click();
    await page.waitForURL(/\/credits\/topup\/mock-return\?orderId=/, { timeout: 30_000 });
    await expect(page.getByText(/Pembayaran Sedang Diverifikasi/i)).toBeVisible();
    await assertNoTopupLeaksInDom(page);
  });

  test("mock webhook grant updates balance after refresh", async ({ page, request }) => {
    test.skip(!topupEnabled, "Requires CREDIT_TOPUP_ENABLED=true on API");

    let checkoutData: {
      order: {
        id: string;
        providerInvoiceId: string | null;
        providerTransactionId: string | null;
        amountIdr: number;
        creditsToGrant: number;
      };
    } | null = null;

    await page.route("**/api/credits/topup/checkout", async (route) => {
      const response = await route.fetch();
      const json = await response.json();
      checkoutData = json.data;
      await route.fulfill({ response });
    });

    await page.setViewportSize({ width: 1280, height: 900 });
    await devAuthLogin(page, testEmail, testPassword);
    await page.goto("/credits/topup");
    await page.getByRole("button", { name: /Beli Paket/i }).first().click();
    await page.waitForURL(/\/credits\/topup\/mock-return/, { timeout: 30_000 });

    expect(checkoutData).not.toBeNull();
    const order = checkoutData!.order;
    const eventId = `mock_evt_e2e_${Date.now()}`;
    const webhookBody = {
      event: "payment.received",
      id: eventId,
      data: {
        invoiceId: order.providerInvoiceId,
        transactionId: order.providerTransactionId,
        amount: order.amountIdr,
        status: "paid",
        extraData: {
          app: "vibenovel",
          flow: "credit_topup",
          orderId: order.id,
          productSlug: "starter",
        },
      },
    };

    const webhookRes = await request.post(`${apiBaseUrl}/api/payments/mayar/webhook`, {
      data: webhookBody,
    });
    expect(webhookRes.ok()).toBeTruthy();

    await page.getByRole("button", { name: /Refresh Saldo/i }).click();
    await expect(page.getByText(/Saldo diperbarui/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/100/)).toBeVisible();
    await assertNoTopupLeaksInDom(page);
  });
});