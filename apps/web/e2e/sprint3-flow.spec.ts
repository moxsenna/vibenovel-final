import { expect, test, type Page } from "@playwright/test";

const DEMO_PROJECT_ID = "demo-project-001";

const MOCK_INTAKE_MARKERS = ["Mari Bangun Ceritamu", "Drama Rumah Tangga"];
const MOCK_CONCEPTS_MARKERS = ["Pilih Arah Ceritamu", "Luka yang Dibayar Mahal"];
const MOCK_FOUNDATION_MARKERS = ["Fondasi Cerita", "Kesiapan Fondasi", "Nadira"];

async function assertPageNotBlank(page: Page, markers: string[]) {
  await expect(page.locator("#root")).toBeVisible();
  for (const text of markers) {
    await expect(page.getByText(text, { exact: false }).first()).toBeVisible();
  }
}

test.describe("Sprint 3 web smoke — mock mode", () => {
  test("intake page renders mock content", async ({ page }) => {
    await page.goto(`/projects/${DEMO_PROJECT_ID}/intake`);
    await assertPageNotBlank(page, MOCK_INTAKE_MARKERS);
  });

  test("concepts page renders mock content", async ({ page }) => {
    await page.goto(`/projects/${DEMO_PROJECT_ID}/concepts`);
    await assertPageNotBlank(page, MOCK_CONCEPTS_MARKERS);
  });

  test("foundation page renders mock content", async ({ page }) => {
    await page.goto(`/projects/${DEMO_PROJECT_ID}/foundation`);
    await assertPageNotBlank(page, MOCK_FOUNDATION_MARKERS);
  });
});

test.describe("Sprint 3 web smoke — API mode", () => {
  const apiModeEnabled = process.env.SMOKE_WEB_API_MODE === "true";
  const testEmail = process.env.SMOKE_TEST_EMAIL?.trim() ?? "";
  const testPassword = process.env.SMOKE_TEST_PASSWORD?.trim() ?? "";
  const projectId = process.env.SMOKE_PROJECT_ID?.trim() ?? "";

  test.skip(
    !apiModeEnabled,
    "API mode skipped — set SMOKE_WEB_API_MODE=true and run via scripts/sprint3-smoke-web.ps1 -IncludeApiMode",
  );

  test.skip(
    !testEmail || !testPassword || !projectId,
    "API mode skipped — missing SMOKE_TEST_EMAIL, SMOKE_TEST_PASSWORD, or SMOKE_PROJECT_ID",
  );

  test("full intake → concepts → foundation flow via DevAuthPanel", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "Dev Auth" }).click();
    await page.getByPlaceholder("email").fill(testEmail);
    await page.getByPlaceholder("password").fill(testPassword);
    await page.getByRole("button", { name: "Masuk" }).click();
    await expect(page.getByText(/Masuk:/)).toBeVisible();

    const intakePath = `/projects/${projectId}/intake`;
    await page.goto(intakePath);
    await expect(page.getByText("Memuat sesi intake...")).toBeHidden({ timeout: 20_000 });

    const chatInput = page.getByPlaceholder("Ketik ide ceritamu di sini...");
    await expect(chatInput).toBeVisible({ timeout: 20_000 });

    const smokeMessage =
      "Drama rumah tangga tentang istri yang diremehkan keluarga suami, ingin bangkit dan menemukan keberanian.";
    await chatInput.fill(smokeMessage);
    await page.getByRole("button", { name: "Kirim" }).click();

    await expect(page.getByText(smokeMessage)).toBeVisible();
    await expect(page.locator("section").getByText(/drama|cerita|tokoh|genre/i).first()).toBeVisible({
      timeout: 20_000,
    });

    const conceptsPath = `/projects/${projectId}/concepts`;
    await page.goto(conceptsPath);
    await expect(page.getByText("Memuat konsep cerita...")).toBeHidden({ timeout: 20_000 });

    const main = page.getByRole("main");
    const generateBtn = main.getByRole("button", { name: /Buat 3 Konsep Cerita/i });
    if (await generateBtn.isVisible()) {
      await generateBtn.click();
      await expect(main.getByRole("heading", { level: 3 }).first()).toBeVisible({
        timeout: 30_000,
      });
    } else {
      await expect(main.getByRole("heading", { level: 3 }).first()).toBeVisible({
        timeout: 20_000,
      });
    }

    const selectBtn = main.getByRole("button", { name: /Pilih Konsep Ini/i }).first();
    await expect(selectBtn).toBeVisible();
    await selectBtn.click();
    await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/foundation`), {
      timeout: 20_000,
    });
    await expect(page.getByText("Memuat fondasi cerita...")).toBeHidden({ timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "Fondasi Cerita" })).toBeVisible();

    const proposalBtn = page.getByRole("button", { name: /Buat Usulan Fondasi/i });
    if (await proposalBtn.isVisible()) {
      await proposalBtn.click();
      await expect(page.getByText(/Membuat usulan/i)).toBeHidden({ timeout: 30_000 });
    }

    for (let round = 0; round < 20; round++) {
      const acceptCount = await page.getByRole("button", { name: "Terima Usulan" }).count();
      if (acceptCount === 0) break;
      await page.getByRole("button", { name: "Terima Usulan" }).first().click();
      await expect(page.getByText("Menerima...")).toBeHidden({ timeout: 20_000 });
    }

    const lockBtn = page.getByRole("button", { name: /Kunci Fondasi/i });
    await expect(lockBtn).toBeVisible();

    if (await lockBtn.isEnabled()) {
      await lockBtn.click();
      await expect(page.getByText(/Fondasi berhasil dikunci|Fondasi Terkunci/i).first()).toBeVisible({
        timeout: 20_000,
      });
    } else {
      await expect(page.getByText(/Kesiapan Fondasi|belum|lengkapi/i).first()).toBeVisible();
    }
  });
});