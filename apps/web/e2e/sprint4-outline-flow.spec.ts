import { expect, test, type Page } from "@playwright/test";

const DEMO_PROJECT_ID = "demo-project-001";

const MOCK_OUTLINE_MARKERS = [
  "Bab 1–10: Awal Konflik",
  "Makan Malam yang Dingin",
  "Rencana 10 Bab Awal",
];

/** Reject raw planningTruth field leaks in visible page text (not substring false positives). */
async function assertNoPlanningTruthInDom(page: Page) {
  const bodyText = await page.locator("body").innerText();
  expect(bodyText).not.toMatch(/"planningTruth"\s*:/i);
  expect(bodyText.toLowerCase()).not.toContain("planningtruthredacted");
}

async function assertPageNotBlank(page: Page, markers: string[]) {
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

test.describe("Sprint 4 web smoke — outline mock mode", () => {
  test("outline page renders mock content without planningTruth", async ({ page }) => {
    await page.goto(`/projects/${DEMO_PROJECT_ID}/outline`);
    await assertPageNotBlank(page, MOCK_OUTLINE_MARKERS);
    await expect(page.getByText("Bab 1:", { exact: false }).first()).toBeVisible();
    await assertNoPlanningTruthInDom(page);
  });
});

test.describe("Sprint 4 web smoke — outline API mode", () => {
  const apiModeEnabled = process.env.SMOKE_WEB_API_MODE === "true";
  const testEmail = process.env.SMOKE_TEST_EMAIL?.trim() ?? "";
  const testPassword = process.env.SMOKE_TEST_PASSWORD?.trim() ?? "";
  const projectId = process.env.SMOKE_PROJECT_ID?.trim() ?? "";

  test.skip(
    !apiModeEnabled,
    "API mode skipped — set SMOKE_WEB_API_MODE=true and run via scripts/sprint4-smoke-web.ps1 -IncludeApiMode",
  );

  test.skip(
    !testEmail || !testPassword || !projectId,
    "API mode skipped — missing SMOKE_TEST_EMAIL, SMOKE_TEST_PASSWORD, or SMOKE_PROJECT_ID",
  );

  test("foundation locked → outline generate → edit → approve → lock", async ({ page }) => {
    await devAuthLogin(page, testEmail, testPassword);

    const outlinePath = `/projects/${projectId}/outline`;
    await page.goto(outlinePath);
    await expect(page.getByText("Memuat outline cerita...")).toBeHidden({ timeout: 30_000 });

    await expect(
      page.getByText(/API tidak tersedia|Menampilkan mock Sprint 1/i),
    ).toHaveCount(0);

    const generateBtn = page.getByRole("button", { name: /Buat Rencana 10 Bab/i });
    await expect(generateBtn).toBeVisible({ timeout: 20_000 });
    await generateBtn.click();
    await expect(page.getByText(/Membuat rencana/i)).toBeHidden({ timeout: 60_000 });
    await expect(page.getByText(/Rencana 10 bab berhasil dibuat/i)).toBeVisible({
      timeout: 30_000,
    });

    await expect(page.getByText(/^Bab 1:/).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/^Bab 10:/).first()).toBeVisible({ timeout: 15_000 });

    await page.getByRole("heading", { name: "Yang Masih Menggantung" }).scrollIntoViewIfNeeded();
    await expect(page.getByRole("heading", { name: "Yang Masih Menggantung" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Jadwal Rahasia" })).toBeVisible();
    await expect(
      page.getByText("Siapa Siska dan apa hubungannya dengan Arman?", { exact: false }),
    ).toBeVisible();

    await assertNoPlanningTruthInDom(page);

    const bab1Toggle = page.getByRole("button", { name: /Bab 1:/ }).first();
    const editorHeading = page.getByRole("heading", { name: "Edit Rencana Bab" });
    await bab1Toggle.click();
    await expect(editorHeading).toBeVisible();

    const titleInput = page.locator("label").filter({ hasText: "Judul Bab" }).locator("input");
    await expect(titleInput).toBeEnabled();
    await titleInput.fill("Bab 1 E2E Edit");
    await page.getByRole("button", { name: "Simpan Perubahan" }).click();
    await expect(page.getByText(/Perubahan bab disimpan|Menyimpan/i).first()).toBeVisible({
      timeout: 20_000,
    });

    const approveBtn = page.getByRole("button", { name: /Setujui Outline/i });
    await expect(approveBtn).toBeVisible();
    await approveBtn.click();
    await expect(page.getByText(/Menyetujui/i)).toBeHidden({ timeout: 30_000 });

    const lockBtn = page.getByRole("button", { name: /Kunci Outline/i });
    await expect(lockBtn).toBeVisible();
    await lockBtn.click();
    await expect(page.getByText(/Mengunci/i)).toBeHidden({ timeout: 30_000 });

    await expect(page.getByText("Outline Terkunci", { exact: false }).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/Outline berhasil dikunci/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Setujui Outline/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Kunci Outline/i })).toHaveCount(0);

    if (!(await editorHeading.isVisible())) {
      await bab1Toggle.click();
    }
    await expect(editorHeading).toBeVisible();
    await expect(titleInput).toBeDisabled();

    await assertNoPlanningTruthInDom(page);
  });
});