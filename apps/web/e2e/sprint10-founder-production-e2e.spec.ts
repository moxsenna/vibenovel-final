import { expect, test, type Page } from "@playwright/test";

const PROJECT_ID = process.env.SMOKE_PROJECT_ID?.trim() ?? "";
const ACCESS_TOKEN = process.env.SMOKE_ACCESS_TOKEN?.trim() ?? "";
const REFRESH_TOKEN = process.env.SMOKE_REFRESH_TOKEN?.trim() ?? "";
const SUPABASE_REF = process.env.SMOKE_SUPABASE_REF?.trim() ?? "";
const USER_JSON = process.env.SMOKE_USER_JSON?.trim() ?? "";
const PROD_APP = process.env.SMOKE_WEB_BASE_URL?.trim() || "https://app.narraza.web.id";

const MOCK_FALLBACK_RE = /Menampilkan mock|Mode demo|API tidak tersedia/i;
const DOM_LEAK_PATTERNS = [
  /OPENROUTER_API_KEY/i,
  /service_role/i,
  /jdxyhrnibmmwlbtbokqo/i,
  /api-staging\.narraza/i,
  /vibenovel-api-staging/i,
  /"planningTruth"\s*:/i,
  /packet_json/i,
];

function requireProductionEnv() {
  test.skip(
    !PROJECT_ID || !ACCESS_TOKEN || !REFRESH_TOKEN || !SUPABASE_REF || !USER_JSON,
    "Missing production smoke env — run via scripts/task-10.29-founder-browser-e2e.ps1",
  );
}

async function injectFounderSession(page: Page) {
  const storageKey = `sb-${SUPABASE_REF}-auth-token`;
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  await page.goto(`${PROD_APP}/login`);
  const user = JSON.parse(USER_JSON) as Record<string, unknown>;
  await page.evaluate(
    ({ key, accessToken, refreshToken, expiresAt: exp, user: sessionUser }) => {
      const payload = {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: exp,
        expires_in: 3600,
        token_type: "bearer",
        user: sessionUser,
      };
      localStorage.setItem(key, JSON.stringify(payload));
    },
    {
      key: storageKey,
      accessToken: ACCESS_TOKEN,
      refreshToken: REFRESH_TOKEN,
      expiresAt,
      user,
    },
  );
  await page.reload();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

async function assertNoLeaks(page: Page) {
  const bodyText = await page.locator("body").innerText();
  const html = await page.locator("body").innerHTML();
  for (const pattern of DOM_LEAK_PATTERNS) {
    expect(bodyText).not.toMatch(pattern);
    expect(html).not.toMatch(pattern);
  }
}

async function assertNoMockFallback(page: Page) {
  await expect(page.getByText(MOCK_FALLBACK_RE)).toHaveCount(0);
}

async function readAssistantCreditBalance(page: Page): Promise<number> {
  const heading = page.getByRole("heading", { name: "Saldo Kredit" });
  await expect(heading).toBeVisible();
  const numText = await heading.locator("..").locator("p").first().innerText();
  const value = Number.parseInt(numText.trim(), 10);
  expect(Number.isFinite(value)).toBe(true);
  return value;
}

async function prepareWriteRoom(page: Page) {
  const writePath = `/projects/${PROJECT_ID}/write`;
  await page.goto(writePath);
  await expect(page.getByText("Memuat ruang tulis…")).toBeHidden({ timeout: 45_000 });
  await assertNoMockFallback(page);

  const generateBeatsBtn = page.getByRole("button", { name: /Buat Daftar Adegan/i }).first();
  const babHeading = page.getByRole("heading", { name: /Bab 1/i }).first();

  await expect(async () => {
    const ready =
      (await generateBeatsBtn.isVisible()) || (await babHeading.isVisible());
    expect(ready).toBe(true);
  }).toPass({ timeout: 45_000 });

  if (await generateBeatsBtn.isVisible()) {
    await generateBeatsBtn.click();
    await expect(page.getByText(/Membuat adegan|Membuat…/i)).toBeHidden({ timeout: 60_000 });
  }

  await expect(babHeading).toBeVisible({ timeout: 20_000 });
  const firstBeat = page.getByRole("button", { name: /Adegan 1/i }).first();
  if ((await firstBeat.count()) > 0) {
    await firstBeat.click();
  }
}

test.describe("Task 10.29 — founder production browser E2E", () => {
  test.beforeEach(() => {
    requireProductionEnv();
  });

  test("route audit: dashboard through write without mock fallback", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await injectFounderSession(page);
    await assertNoLeaks(page);
    await assertNoMockFallback(page);

    await expect(page.getByText(/Perbaikan Cerita|Proyek/i).first()).toBeVisible({
      timeout: 20_000,
    });

    const routes = [
      `/projects/${PROJECT_ID}/intake`,
      `/projects/${PROJECT_ID}/concepts`,
      `/projects/${PROJECT_ID}/foundation`,
      `/projects/${PROJECT_ID}/outline`,
      `/projects/${PROJECT_ID}/write`,
      `/projects/${PROJECT_ID}/summary`,
      `/projects/${PROJECT_ID}/publish`,
      "/settings",
    ];

    for (const path of routes) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await assertNoMockFallback(page);
      await assertNoLeaks(page);
    }
  });

  test("write room: AI prose generation, persistence, credit UI", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await injectFounderSession(page);
    await prepareWriteRoom(page);

    await expect(page.getByText(/Saldo Kredit/i).first()).toBeVisible({ timeout: 20_000 });
    const balanceBefore = await readAssistantCreditBalance(page);

    const aiButton = page.getByRole("button", { name: /Tulis Beat dengan AI/i }).first();
    await expect(aiButton).toBeEnabled({ timeout: 20_000 });
    await aiButton.click();

    await expect(page.getByText(/Menghasilkan narasi/i)).toBeHidden({ timeout: 120_000 });
    await expect(page.getByText(/Narasi AI berhasil dibuat/i).first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(/Terpotong \d+ kredit/i).first()).toBeVisible();

    const proseArea = page.getByRole("textbox", { name: /Narasi adegan/i });
    await expect(proseArea).toBeVisible();
    const proseAfterGen = await proseArea.inputValue();
    expect(proseAfterGen.trim().length).toBeGreaterThan(100);
    expect(proseAfterGen.toLowerCase()).not.toContain("mock");
    expect(proseAfterGen).not.toMatch(/lorem ipsum/i);

    await page.reload();
    await expect(page.getByText("Memuat ruang tulis…")).toBeHidden({ timeout: 45_000 });
    await expect(proseArea).toBeVisible({ timeout: 20_000 });
    const proseAfterReload = await proseArea.inputValue();
    expect(proseAfterReload.trim().length).toBeGreaterThan(100);

    await expect(page.getByText(/Saldo Kredit/i).first()).toBeVisible({ timeout: 20_000 });
    const balanceAfter = await readAssistantCreditBalance(page);
    expect(balanceAfter).toBeLessThan(balanceBefore);
    expect(balanceBefore - balanceAfter).toBeGreaterThanOrEqual(5);

    await expect(page.getByText(/Top up belum tersedia/i).first()).toBeVisible();
    await assertNoLeaks(page);
  });
});