import { expect, test, type Page } from "@playwright/test";

const DEMO_PROJECT_ID = "demo-project-001";
const CHAPTER2_TITLE = "Pesan di Ponsel Arman";
const CHAPTER2_SUMMARY_SNIPPET = "Nadira tidak sengaja melihat pesan yang terhapus cepat";
const MOCK_AI_PROSE_SNIPPET = "Dia menahan napas";
const MOCK_REWRITE_SNIPPET = "Versi yang lebih jernih";
const MOCK_REWRITE_MARKER = "mock-rewrite";

const DOM_LEAK_PATTERNS = [
  /"planningTruth"\s*:/i,
  /planning_truth/i,
  /packet_json/i,
  /packetJson/i,
  /"currentChapter"\s*:\s*\{/i,
  /"revealGate"\s*:\s*\{/i,
  /"forbiddenReveals"\s*:\s*\[/i,
  /"promptText"\s*:/i,
  /"promptMessages"\s*:/i,
  /openrouter/i,
  /estimated_cost_usd/i,
  /credit_ledger/i,
  /generationAttempt/i,
  /OPENROUTER_API_KEY/i,
];

async function assertNoRewriteLeaksInDom(page: Page) {
  const bodyText = await page.locator("body").innerText();
  const html = await page.locator("body").innerHTML();

  for (const pattern of DOM_LEAK_PATTERNS) {
    expect(bodyText).not.toMatch(pattern);
    expect(html).not.toMatch(pattern);
  }

  expect(bodyText.toLowerCase()).not.toContain("planningtruthredacted");
  expect(bodyText).not.toContain(CHAPTER2_TITLE);
  expect(bodyText).not.toContain(CHAPTER2_SUMMARY_SNIPPET);
}

async function devAuthLogin(page: Page, email: string, password: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "Dev Auth" }).click();
  await page.getByPlaceholder("email").fill(email);
  await page.getByPlaceholder("password").fill(password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page.getByText(/Masuk:/)).toBeVisible();
}

async function prepareWriteRoomApi(page: Page, projectId: string) {
  const writePath = `/projects/${projectId}/write`;
  await page.goto(writePath);
  await expect(page.getByText("Memuat ruang tulis…")).toBeHidden({ timeout: 30_000 });

  await expect(
    page.getByText(/API tidak tersedia|Menampilkan mock Sprint 1/i),
  ).toHaveCount(0);

  const generateBeatsBtn = page.getByRole("button", { name: /Buat Daftar Adegan/i }).first();
  const babHeading = page.getByRole("heading", { name: /Bab 1/ }).first();
  const firstBeatBtn = page.getByRole("button", { name: /Adegan 1/i }).first();

  await expect(async () => {
    const ready =
      (await generateBeatsBtn.isVisible()) ||
      (await babHeading.isVisible()) ||
      (await firstBeatBtn.count()) > 0;
    expect(ready).toBe(true);
  }).toPass({ timeout: 30_000 });

  if (await generateBeatsBtn.isVisible()) {
    await generateBeatsBtn.click();
    await expect(page.getByText(/Membuat adegan|Membuat…/i)).toBeHidden({ timeout: 60_000 });
    await expect(page.getByText(/Adegan bab berhasil dibuat/i)).toBeVisible({ timeout: 30_000 });
  }

  await expect(babHeading).toBeVisible({ timeout: 20_000 });

  if ((await firstBeatBtn.count()) > 0) {
    await firstBeatBtn.click();
  }
}

test.describe("Sprint 9 web smoke — rewrite mock mode", () => {
  test("write page mock mode hides rewrite action; shows unavailable reason", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/projects/${DEMO_PROJECT_ID}/write`);

    await expect(page.getByRole("button", { name: /Tulis Beat dengan AI/i }).first()).toBeVisible({
      timeout: 15_000,
    });

    await expect(page.getByRole("button", { name: /Perbaiki Teks/i })).toHaveCount(0);

    await expect(
      page.getByText(/Perbaiki teks dengan AI hanya tersedia dalam mode API/i).first(),
    ).toBeVisible();

    await assertNoRewriteLeaksInDom(page);
  });
});

test.describe("Sprint 9 web smoke — rewrite API mode", () => {
  const apiModeEnabled = process.env.SMOKE_WEB_API_MODE === "true";
  const aiEnabled = process.env.SMOKE_AI_ENABLED === "true";
  const testEmail = process.env.SMOKE_TEST_EMAIL?.trim() ?? "";
  const testPassword = process.env.SMOKE_TEST_PASSWORD?.trim() ?? "";
  const projectId = process.env.SMOKE_PROJECT_ID?.trim() ?? "";

  test.skip(
    !apiModeEnabled,
    "API mode skipped — set SMOKE_WEB_API_MODE=true and run via scripts/sprint9-smoke-web.ps1 -IncludeApiMode",
  );

  test.skip(
    !testEmail || !testPassword || !projectId,
    "API mode skipped — missing SMOKE_TEST_EMAIL, SMOKE_TEST_PASSWORD, or SMOKE_PROJECT_ID",
  );

  test("API mode shows rewrite controls and cost label when prose exists", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await devAuthLogin(page, testEmail, testPassword);
    await prepareWriteRoomApi(page, projectId);

    await expect(page.getByText(/Perbaiki Teks dengan AI/i).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/Biaya rewrite:/i).first()).toBeVisible();

    await assertNoRewriteLeaksInDom(page);
  });

  test("AI disabled shows safe rewrite error without leaking internals", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await devAuthLogin(page, testEmail, testPassword);
    await prepareWriteRoomApi(page, projectId);

    const proseArea = page.getByRole("textbox", { name: /Narasi adegan/i });
    await proseArea.fill("Narasi uji untuk rewrite saat AI nonaktif.");
    await page.getByRole("button", { name: /Simpan/i }).first().click();
    await expect(page.getByText(/Tersimpan/i).first()).toBeVisible({ timeout: 30_000 });

    const rewriteButton = page.getByRole("button", { name: /Perbaiki Teks/i }).first();
    await expect(rewriteButton).toBeEnabled({ timeout: 15_000 });
    await rewriteButton.click();

    await expect(page.getByText(/AI generation belum aktif/i).first()).toBeVisible({
      timeout: 30_000,
    });

    await assertNoRewriteLeaksInDom(page);
  });

  test("AI enabled rewrites prose with credit notice", async ({ page }) => {
    test.skip(
      !aiEnabled,
      "Rewrite success skipped — restart dev:api with AI_GENERATION_ENABLED=true and AI_PROVIDER_MOCK=true",
    );

    await page.setViewportSize({ width: 1440, height: 900 });
    await devAuthLogin(page, testEmail, testPassword);
    await prepareWriteRoomApi(page, projectId);

    const aiButton = page.getByRole("button", { name: /Tulis Beat dengan AI/i }).first();
    await expect(aiButton).toBeEnabled({ timeout: 15_000 });
    await aiButton.click();
    await expect(page.getByText(/Menghasilkan narasi/i)).toBeHidden({ timeout: 90_000 });

    const proseArea = page.getByRole("textbox", { name: /Narasi adegan/i });
    await expect(proseArea).toContainText(MOCK_AI_PROSE_SNIPPET, { timeout: 30_000 });

    const rewriteButton = page.getByRole("button", { name: /Perbaiki Teks/i }).first();
    await expect(rewriteButton).toBeEnabled({ timeout: 15_000 });
    await rewriteButton.click();
    await expect(page.getByText(/Memperbaiki teks/i)).toBeHidden({ timeout: 90_000 });

    await expect(proseArea).toContainText(MOCK_REWRITE_SNIPPET, { timeout: 30_000 });
    const proseValue = await proseArea.inputValue();
    expect(proseValue).toContain(MOCK_REWRITE_MARKER);

    await expect(page.getByText(/Teks berhasil diperbaiki/i).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/Terpotong \d+ kredit/i).first()).toBeVisible();
    await expect(page.getByText(/Sisa:/i).first()).toBeVisible();

    await assertNoRewriteLeaksInDom(page);
  });
});