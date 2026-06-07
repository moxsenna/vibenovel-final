import { expect, test, type Page } from "@playwright/test";

const DEMO_PROJECT_ID = "demo-project-001";
const CHAPTER2_TITLE = "Pesan di Ponsel Arman";
const CHAPTER2_SUMMARY_SNIPPET = "Nadira tidak sengaja melihat pesan yang terhapus cepat";

/** Markers chosen from visible desktop/mobile write layout (avoid hidden duplicate nodes). */
const MOCK_WRITE_HEADINGS = [/Bab 1/, "Daftar Adegan", "Asisten AI"];

const DOM_LEAK_PATTERNS = [
  /"planningTruth"\s*:/i,
  /planning_truth/i,
  /packet_json/i,
  /packetJson/i,
  /"currentChapter"\s*:\s*\{/i,
  /"revealGate"\s*:\s*\{/i,
  /"forbiddenReveals"\s*:\s*\[/i,
];

async function assertNoWriteRoomLeaksInDom(page: Page) {
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

async function assertWritePageNotBlank(page: Page) {
  await expect(page.locator("#root")).toBeVisible();
  for (const heading of MOCK_WRITE_HEADINGS) {
    await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
  }
  await expect(
    page.getByRole("button", { name: /Nadira menyiapkan makan malam/i }).first(),
  ).toBeVisible();
}

async function devAuthLogin(page: Page, email: string, password: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "Dev Auth" }).click();
  await page.getByPlaceholder("email").fill(email);
  await page.getByPlaceholder("password").fill(password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page.getByText(/Masuk:/)).toBeVisible();
}

test.describe("Sprint 5 web smoke — write mock mode", () => {
  test("write page renders mock content without planningTruth or packet_json", async ({ page }) => {
    await page.goto(`/projects/${DEMO_PROJECT_ID}/write`);
    await assertWritePageNotBlank(page);
    await assertNoWriteRoomLeaksInDom(page);
  });
});

test.describe("Sprint 5 web smoke — write API mode", () => {
  const apiModeEnabled = process.env.SMOKE_WEB_API_MODE === "true";
  const testEmail = process.env.SMOKE_TEST_EMAIL?.trim() ?? "";
  const testPassword = process.env.SMOKE_TEST_PASSWORD?.trim() ?? "";
  const projectId = process.env.SMOKE_PROJECT_ID?.trim() ?? "";

  test.skip(
    !apiModeEnabled,
    "API mode skipped — set SMOKE_WEB_API_MODE=true and run via scripts/sprint5-smoke-web.ps1 -IncludeApiMode",
  );

  test.skip(
    !testEmail || !testPassword || !projectId,
    "API mode skipped — missing SMOKE_TEST_EMAIL, SMOKE_TEST_PASSWORD, or SMOKE_PROJECT_ID",
  );

  test("outline locked → write session → context preview → prose → ready for summary", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await devAuthLogin(page, testEmail, testPassword);

    const writePath = `/projects/${projectId}/write`;
    await page.goto(writePath);
    await expect(page.getByText("Memuat ruang tulis…")).toBeHidden({ timeout: 30_000 });

    await expect(
      page.getByText(/API tidak tersedia|Menampilkan mock Sprint 1/i),
    ).toHaveCount(0);

    const generateBeatsBtn = page.getByRole("button", { name: /Buat Daftar Adegan/i });
    if ((await generateBeatsBtn.count()) > 0) {
      await expect(generateBeatsBtn).toBeVisible({ timeout: 20_000 });
      await generateBeatsBtn.click();
      await expect(page.getByText(/Membuat adegan|Membuat…/i)).toBeHidden({ timeout: 60_000 });
      await expect(page.getByText(/Adegan bab berhasil dibuat/i)).toBeVisible({ timeout: 30_000 });
    }

    await expect(page.getByRole("heading", { name: /Bab 1/ }).first()).toBeVisible({
      timeout: 20_000,
    });

    const firstBeat = page.getByRole("button", { name: /Adegan 1/i }).first();
    if ((await firstBeat.count()) > 0) {
      await firstBeat.click();
    }

    const contextBtn = page.getByRole("button", { name: /Siapkan Konteks Aman/i });
    await expect(contextBtn).toBeVisible({ timeout: 30_000 });
    await contextBtn.click();
    await expect(page.getByText(/Menyiapkan…/i)).toBeHidden({ timeout: 60_000 });
    await expect(page.getByText(/Konteks aman siap|Item wajib/i).first()).toBeVisible({
      timeout: 30_000,
    });

    await assertNoWriteRoomLeaksInDom(page);

    const proseArea = page.getByRole("textbox", { name: /Narasi adegan/i });
    await expect(proseArea).toBeVisible({ timeout: 15_000 });

    const proseV1 =
      "Nadira memangkas sayuran di dapur dengan irama yang sudah hafal di luar kepala.";
    await proseArea.fill(proseV1);
    await page.getByRole("button", { name: "Simpan" }).click();
    await expect(page.getByText(/Tersimpan|Menyimpan/i).first()).toBeVisible({ timeout: 20_000 });

    const proseV2 = "Pintu depan dibuka. Suara tawa memenuhi ruang tamu.";
    await proseArea.fill(proseV2);
    await page.getByRole("button", { name: "Simpan" }).click();
    await expect(page.getByText(/v2|Tersimpan/i).first()).toBeVisible({ timeout: 20_000 });

    await assertNoWriteRoomLeaksInDom(page);

    const finishBtn = page.getByRole("button", { name: /Selesai & Lihat Ringkasan Bab/i });
    await expect(finishBtn).toBeVisible();
    await finishBtn.click();

    await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/summary`), { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "Ringkasan Bab" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/Bab Selesai|Siap Ditinjau/i).first()).toBeVisible();

    await assertNoWriteRoomLeaksInDom(page);
  });
});