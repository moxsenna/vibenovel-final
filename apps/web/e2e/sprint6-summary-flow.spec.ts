import { expect, test, type Page } from "@playwright/test";

const DEMO_PROJECT_ID = "demo-project-001";

const MOCK_SUMMARY_MARKERS = [
  "Ringkasan Bab",
  "Makan Malam yang Dingin",
  "Nadira berusaha menjaga makan malam",
  "Fakta Baru",
];

const DOM_LEAK_PATTERNS = [
  /"planningTruth"\s*:/i,
  /planning_truth/i,
  /packet_json/i,
  /packetJson/i,
  /"prose_text"\s*:/i,
  /"proseText"\s*:/i,
  /openrouter/i,
  /full_prompt/i,
];

async function assertNoSummaryLeaksInDom(page: Page) {
  const bodyText = await page.locator("body").innerText();
  const html = await page.locator("body").innerHTML();

  for (const pattern of DOM_LEAK_PATTERNS) {
    expect(bodyText).not.toMatch(pattern);
    expect(html).not.toMatch(pattern);
  }

  expect(bodyText.toLowerCase()).not.toContain("planningtruthredacted");
}

async function assertSummaryPageNotBlank(page: Page, markers: string[]) {
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

test.describe("Sprint 6 web smoke — summary mock mode", () => {
  test("summary page renders mock content without planningTruth or packet_json", async ({ page }) => {
    await page.goto(`/projects/${DEMO_PROJECT_ID}/summary`);
    await assertSummaryPageNotBlank(page, MOCK_SUMMARY_MARKERS);
    await expect(page.getByRole("heading", { name: "Ringkasan Bab" })).toBeVisible();
    await assertNoSummaryLeaksInDom(page);
  });
});

test.describe("Sprint 6 web smoke — summary API mode", () => {
  const apiModeEnabled = process.env.SMOKE_WEB_API_MODE === "true";
  const testEmail = process.env.SMOKE_TEST_EMAIL?.trim() ?? "";
  const testPassword = process.env.SMOKE_TEST_PASSWORD?.trim() ?? "";
  const projectId = process.env.SMOKE_PROJECT_ID?.trim() ?? "";

  test.skip(
    !apiModeEnabled,
    "API mode skipped — set SMOKE_WEB_API_MODE=true and run via scripts/sprint6-smoke-web.ps1 -IncludeApiMode",
  );

  test.skip(
    !testEmail || !testPassword || !projectId,
    "API mode skipped — missing SMOKE_TEST_EMAIL, SMOKE_TEST_PASSWORD, or SMOKE_PROJECT_ID",
  );

  test("ready_for_summary → generate → extract → approve → accept/reject proposals", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await devAuthLogin(page, testEmail, testPassword);

    const summaryPath = `/projects/${projectId}/summary`;
    await page.goto(summaryPath);
    await expect(page.getByText("Memuat ringkasan bab…")).toBeHidden({ timeout: 30_000 });

    await expect(
      page.getByText(/API tidak tersedia|Menampilkan mock Sprint 1/i),
    ).toHaveCount(0);

    const generateBtn = page.getByRole("button", { name: /Buat Ringkasan Bab/i });
    await expect(generateBtn).toBeVisible({ timeout: 20_000 });
    await generateBtn.click();
    await expect(page.getByText(/Membuat ringkasan/i)).toBeHidden({ timeout: 60_000 });

    await expect(page.getByRole("heading", { name: "Ringkasan Bab" })).toBeVisible();
    await assertNoSummaryLeaksInDom(page);

    const extractBtn = page.getByRole("button", { name: /Ekstrak Perubahan Cerita/i });
    await expect(extractBtn).toBeVisible({ timeout: 20_000 });
    await extractBtn.click();
    await expect(page.getByText(/Mengekstrak/i)).toBeHidden({ timeout: 60_000 });

    await expect(page.getByText("Usulan Perubahan Canon")).toBeVisible({ timeout: 20_000 });
    await assertNoSummaryLeaksInDom(page);

    const approveBtn = page.getByRole("button", { name: /Setujui Ringkasan Bab/i });
    await expect(approveBtn).toBeVisible();
    await approveBtn.click();
    await expect(page.getByRole("button", { name: /^Menyetujui…$/ })).toBeHidden({
      timeout: 60_000,
    });

    await expect(page.getByText(/Disetujui|Bab Disetujui/i).first()).toBeVisible({
      timeout: 20_000,
    });

    const acceptButtons = page.getByRole("button", { name: "Terima" });
    const acceptCount = await acceptButtons.count();
    if (acceptCount > 0) {
      const firstAccept = acceptButtons.first();
      const disabled = await firstAccept.isDisabled();
      if (!disabled) {
        await firstAccept.click();
        await expect(page.getByText(/Memproses/i)).toBeHidden({ timeout: 30_000 });
      }
    }

    const rejectButtons = page.getByRole("button", { name: "Tolak" });
    if ((await rejectButtons.count()) > 0) {
      const rejectBtn = rejectButtons.first();
      if (!(await rejectBtn.isDisabled())) {
        await rejectBtn.click();
        await expect(page.getByText(/Memproses/i)).toBeHidden({ timeout: 30_000 });
      }
    }

    await assertNoSummaryLeaksInDom(page);

    await expect(page.getByText("Usulan Perubahan Canon")).toBeVisible();
  });
});