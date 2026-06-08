import { expect, test, type Page } from "@playwright/test";

const DEMO_PROJECT_ID = "demo-project-001";
const MOCK_PUBLISH_MARKER = "mock-publish";
const DOM_LEAK_PATTERNS = [
  /"planningTruth"\s*:/i,
  /planning_truth/i,
  /packet_json/i,
  /packetJson/i,
  /"prose_text"\s*:/i,
  /"proseText"\s*:/i,
  /delta_json/i,
  /full_prompt/i,
  /openrouter/i,
  /estimated_cost_usd/i,
  /credit_ledger/i,
  /generationAttempt/i,
  /OPENROUTER_API_KEY/i,
];

async function assertNoPublishAiLeaksInDom(page: Page) {
  const bodyText = await page.locator("body").innerText();
  const html = await page.locator("body").innerHTML();

  for (const pattern of DOM_LEAK_PATTERNS) {
    expect(bodyText).not.toMatch(pattern);
    expect(html).not.toMatch(pattern);
  }

  expect(bodyText.toLowerCase()).not.toContain("planningtruth");
}

async function devAuthLogin(page: Page, email: string, password: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "Dev Auth" }).click();
  await page.getByPlaceholder("email").fill(email);
  await page.getByPlaceholder("password").fill(password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page.getByText(/Masuk:/)).toBeVisible();
}

test.describe("Sprint 9 web smoke — publish copy AI mock mode", () => {
  test("publish page mock mode hides AI copy action; no fake suggestions", async ({ page }) => {
    await page.goto(`/projects/${DEMO_PROJECT_ID}/publish`);

    await expect(page.getByTestId("publish-ai-copy-panel")).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByText(/Perbaiki copy dengan AI hanya tersedia dalam mode API/i).first(),
    ).toBeVisible();

    await expect(page.getByTestId("publish-ai-buat-saran")).toHaveCount(0);
    await expect(page.getByTestId("publish-ai-suggestions")).toHaveCount(0);

    await assertNoPublishAiLeaksInDom(page);
  });
});

test.describe("Sprint 9 web smoke — publish copy AI API mode", () => {
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

  test("API mode shows publish copy AI panel after package exists", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await devAuthLogin(page, testEmail, testPassword);

    const publishPath = `/projects/${projectId}/publish`;
    await page.goto(publishPath);
    await expect(page.getByText("Memuat paket publish…")).toBeHidden({ timeout: 30_000 });

    await expect(
      page.getByText(/API tidak tersedia|Menampilkan mock Sprint 1/i),
    ).toHaveCount(0);

    const generateBtn = page.getByRole("button", { name: /Buat Paket Publish/i });
    if (await generateBtn.isVisible()) {
      await generateBtn.click();
      await expect(page.getByText(/Membuat paket/i)).toBeHidden({ timeout: 60_000 });
    }

    await expect(page.getByTestId("publish-ai-copy-panel")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "Perbaiki Copy dengan AI" })).toBeVisible();
    await expect(page.getByTestId("publish-ai-buat-saran")).toBeVisible();

    await assertNoPublishAiLeaksInDom(page);
  });

  test("AI disabled shows safe message on Buat Saran Copy click", async ({ page }) => {
    test.skip(aiEnabled, "AI enabled — disabled-path test N/A");

    await page.setViewportSize({ width: 1440, height: 900 });
    await devAuthLogin(page, testEmail, testPassword);

    await page.goto(`/projects/${projectId}/publish`);
    await expect(page.getByText("Memuat paket publish…")).toBeHidden({ timeout: 30_000 });

    const generateBtn = page.getByRole("button", { name: /Buat Paket Publish/i });
    if (await generateBtn.isVisible()) {
      await generateBtn.click();
      await expect(page.getByText(/Membuat paket/i)).toBeHidden({ timeout: 60_000 });
    }

    await expect(page.getByTestId("publish-ai-buat-saran")).toBeVisible({ timeout: 20_000 });
    await page.getByTestId("publish-ai-buat-saran").click();

    await expect(page.getByText(/AI generation belum aktif/i).first()).toBeVisible({
      timeout: 20_000,
    });

    await assertNoPublishAiLeaksInDom(page);
  });

  test("AI enabled creates suggestions without mutating package until apply", async ({ page }) => {
    test.skip(!aiEnabled, "AI disabled — success path requires SMOKE_AI_ENABLED=true");

    await page.setViewportSize({ width: 1440, height: 900 });
    await devAuthLogin(page, testEmail, testPassword);

    await page.goto(`/projects/${projectId}/publish`);
    await expect(page.getByText("Memuat paket publish…")).toBeHidden({ timeout: 30_000 });

    const generateBtn = page.getByRole("button", { name: /Buat Paket Publish/i });
    if (await generateBtn.isVisible()) {
      await generateBtn.click();
      await expect(page.getByText(/Membuat paket/i)).toBeHidden({ timeout: 60_000 });
    }

    const teaserHeading = page.getByRole("heading", { name: "Teaser Bab" });
    await expect(teaserHeading).toBeVisible({ timeout: 20_000 });
    const teaserCard = teaserHeading.locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]");
    const teaserArea = teaserCard.locator("textarea");
    const teaserBefore = await teaserArea.inputValue();

    await page.getByTestId("publish-ai-field-teaser").check();
    await page.getByTestId("publish-ai-buat-saran").click();

    await expect(page.getByTestId("publish-ai-suggestion-teaser")).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByText(MOCK_PUBLISH_MARKER)).toBeVisible();

    const teaserAfterSuggest = await teaserArea.inputValue();
    expect(teaserAfterSuggest).toBe(teaserBefore);

    await page.getByTestId("publish-ai-terapkan-teaser").click();
    await expect(page.getByTestId("publish-ai-terapkan-teaser")).toBeHidden({ timeout: 30_000 });

    await expect(async () => {
      const teaserAfterApply = await teaserArea.inputValue();
      expect(teaserAfterApply).not.toBe(teaserBefore);
      expect(teaserAfterApply).toContain(MOCK_PUBLISH_MARKER);
    }).toPass({ timeout: 30_000 });

    await assertNoPublishAiLeaksInDom(page);
  });
});