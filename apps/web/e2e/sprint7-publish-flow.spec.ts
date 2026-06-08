import { expect, test, type Page } from "@playwright/test";

const DEMO_PROJECT_ID = "demo-project-001";

const MOCK_PUBLISH_MARKERS = [
  "Paket Publish",
  "Aset Publikasi",
  "Makan Malam yang Dingin",
  "Teaser Bab",
  "Sinopsis Pendek",
  "Caption Promosi",
];

const DOM_LEAK_PATTERNS = [
  /"planningTruth"\s*:/i,
  /planning_truth/i,
  /packet_json/i,
  /packetJson/i,
  /"prose_text"\s*:/i,
  /"proseText"\s*:/i,
  /delta_json/i,
  /deltaJson/i,
  /full_prompt/i,
  /openrouter/i,
  /"provider"\s*:/i,
  /"model"\s*:/i,
  /"token"\s*:/i,
];

const FORBIDDEN_OVERCLAIM_PATTERNS = [
  /dijamin viral/i,
  /pasti viral/i,
  /dijamin unlock/i,
  /pasti banyak pembaca/i,
  /cerita sudah dipublish otomatis/i,
  /posting otomatis ke platform/i,
];

async function assertNoPublishLeaksInDom(page: Page) {
  const bodyText = await page.locator("body").innerText();
  const html = await page.locator("body").innerHTML();

  for (const pattern of DOM_LEAK_PATTERNS) {
    expect(bodyText).not.toMatch(pattern);
    expect(html).not.toMatch(pattern);
  }

  expect(bodyText.toLowerCase()).not.toContain("planningtruth");
}

async function assertNoForbiddenOverclaim(page: Page) {
  const bodyText = await page.locator("body").innerText();
  for (const pattern of FORBIDDEN_OVERCLAIM_PATTERNS) {
    expect(bodyText).not.toMatch(pattern);
  }
}

async function assertManualCopyMessaging(page: Page) {
  const bodyText = await page.locator("body").innerText();
  expect(bodyText).toMatch(
    /manual|copy-paste|menyalin materi secara manual|tidak ada posting otomatis|siap salin/i,
  );
}

async function assertPublishPageNotBlank(page: Page, markers: string[]) {
  await expect(page.locator("#root")).toBeVisible();
  for (const text of markers) {
    await expect(page.getByText(text, { exact: false }).first()).toBeVisible();
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

test.describe("Sprint 7 web smoke — publish mock mode", () => {
  test("publish page renders mock content without leak markers or auto-post overclaim", async ({
    page,
  }) => {
    await page.goto(`/projects/${DEMO_PROJECT_ID}/publish`);
    await assertPublishPageNotBlank(page, MOCK_PUBLISH_MARKERS);
    await expect(page.getByRole("heading", { name: /Aset Publikasi/i })).toBeVisible();
    await assertNoPublishLeaksInDom(page);
    await assertNoForbiddenOverclaim(page);
    await assertManualCopyMessaging(page);
    await expect(page.getByRole("button", { name: "Salin" }).first()).toBeVisible();
  });
});

test.describe("Sprint 7 web smoke — publish API mode", () => {
  const apiModeEnabled = process.env.SMOKE_WEB_API_MODE === "true";
  const testEmail = process.env.SMOKE_TEST_EMAIL?.trim() ?? "";
  const testPassword = process.env.SMOKE_TEST_PASSWORD?.trim() ?? "";
  const projectId = process.env.SMOKE_PROJECT_ID?.trim() ?? "";

  test.skip(
    !apiModeEnabled,
    "API mode skipped — set SMOKE_WEB_API_MODE=true and run via scripts/sprint7-smoke-web.ps1 -IncludeApiMode",
  );

  test.skip(
    !testEmail || !testPassword || !projectId,
    "API mode skipped — missing SMOKE_TEST_EMAIL, SMOKE_TEST_PASSWORD, or SMOKE_PROJECT_ID",
  );

  test("approved summary → generate package → edit → checklist → mark exported readonly", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await devAuthLogin(page, testEmail, testPassword);

    const publishPath = `/projects/${projectId}/publish`;
    await page.goto(publishPath);
    await expect(page.getByText("Memuat paket publish…")).toBeHidden({ timeout: 30_000 });

    await expect(
      page.getByText(/API tidak tersedia|Menampilkan mock Sprint 1/i),
    ).toHaveCount(0);

    const generateBtn = page.getByRole("button", { name: /Buat Paket Publish/i });
    await expect(generateBtn).toBeVisible({ timeout: 20_000 });
    await generateBtn.click();
    await expect(page.getByText(/Membuat paket/i)).toBeHidden({ timeout: 60_000 });

    await expect(page.getByText("Teaser Bab", { exact: false }).first()).toBeVisible({
      timeout: 20_000,
    });
    await assertNoPublishLeaksInDom(page);
    await assertNoForbiddenOverclaim(page);
    await assertManualCopyMessaging(page);

    const captionHeading = page.getByRole("heading", { name: "Caption Promosi" });
    await expect(captionHeading).toBeVisible();
    const captionCard = captionHeading.locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]");
    const captionArea = captionCard.locator("textarea");
    await expect(captionArea).toBeVisible();
    await captionArea.fill("Caption E2E smoke — siap disalin manual ke KBM.");
    await captionCard.getByRole("button", { name: "Simpan" }).click();
    await expect(captionCard.getByRole("button", { name: /^Menyimpan/ })).toBeHidden({
      timeout: 30_000,
    });

    const checklistToggle = page
      .locator("button")
      .filter({ hasText: /Preview terbaca nyaman/i })
      .first();
    if ((await checklistToggle.count()) > 0) {
      await checklistToggle.click();
      await expect(page.getByText(/Menyimpan|Memperbarui/i)).toBeHidden({ timeout: 30_000 });
    }

    const markBtn = page.getByRole("button", { name: /Tandai Sudah Disalin ke KBM/i });
    await expect(markBtn).toBeVisible();
    await markBtn.click();
    await expect(page.getByText(/^Menandai/)).toBeHidden({ timeout: 30_000 });

    await expect(page.getByText(/Paket sudah ditandai disalin/i).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("button", { name: "Simpan" })).toHaveCount(0);

    await assertNoPublishLeaksInDom(page);
    await assertNoForbiddenOverclaim(page);
    await assertManualCopyMessaging(page);
    expect(page.url()).toMatch(/localhost:\d+\/projects\//);
    await expect(page.getByRole("button", { name: "Salin" }).first()).toBeVisible();
  });
});