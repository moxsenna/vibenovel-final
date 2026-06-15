import { expect, test, type Page } from "@playwright/test";

const PROJECT_ID = "project-draft-import-123";
const DRAFT_IMPORT_ID = "draft-import-123";
const SUPABASE_REF = process.env.SMOKE_SUPABASE_REF?.trim() || "jdxyhrnibmmwlbtbokqo";
const STORAGE_KEY = `sb-${SUPABASE_REF}-auth-token`;

const sessionUser = {
  id: "user-draft-import",
  aud: "authenticated",
  role: "authenticated",
  email: "writer-draft-import@example.com",
};

const now = () => new Date().toISOString();

const draftText = [
  "Nadira berdiri di ruang makan keluarga Arman saat semua orang menertawakan gaun lamanya.",
  "Mereka menyebutnya istri yang tidak pantas duduk bersama keluarga pemilik hotel paling terkenal di kota.",
  "Ia menyimpan rahasia bahwa kontrak lama ayahnya adalah alasan semua kekayaan itu berdiri.",
  "Ketika Arman memilih diam, Nadira sadar ia harus bangkit sendiri dan membalas penghinaan itu dengan cara elegan.",
  "Bab berikutnya memperlihatkan janji pembaca: perempuan yang diremehkan akan menemukan bukti, membongkar rahasia keluarga, dan memaksa semua orang mengakui nilainya.",
].join(" ");

function projectPayload() {
  return {
    id: PROJECT_ID,
    title: "Draft Saya",
    entryPath: "has_draft",
    workflowPhase: "intake",
    status: "in_progress",
    currentChapter: 0,
    genre: "Drama",
    isActive: true,
    lastEditedAt: now(),
    createdAt: now(),
    updatedAt: now(),
  };
}

function draftImportPayload(status = "uploaded") {
  return {
    id: DRAFT_IMPORT_ID,
    projectId: PROJECT_ID,
    ownerId: sessionUser.id,
    contentHash: "a".repeat(64),
    excerptPreview: "Nadira berdiri di ruang makan keluarga Arman saat semua orang menertawakan gaun lamanya.",
    wordCount: 74,
    status,
    metadata: { source: "imported_draft" },
    createdAt: now(),
    updatedAt: now(),
  };
}

function importJobPayload(status = "running", currentPhase = "uploaded", progressPercent = 5) {
  return {
    id: "import-job-123",
    projectId: PROJECT_ID,
    ownerId: sessionUser.id,
    draftImportId: DRAFT_IMPORT_ID,
    status,
    currentPhase,
    progressPercent,
    errorCode: null,
    errorMessageSafe: null,
    phaseState: { resumedFrom: null },
    metadata: { resumeCount: 0 },
    startedAt: now(),
    finishedAt: null,
    createdAt: now(),
    updatedAt: now(),
  };
}

function extractedSignals() {
  return [
    {
      id: "signal-genre",
      draftImportId: DRAFT_IMPORT_ID,
      projectId: PROJECT_ID,
      type: "genre",
      label: "Drama Rumah Tangga",
      value: "genre dominan: drama rumah tangga",
      confidence: 0.82,
      metadata: { source: "imported_draft" },
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: "signal-protagonist",
      draftImportId: DRAFT_IMPORT_ID,
      projectId: PROJECT_ID,
      type: "protagonist",
      label: "Tokoh utama: Nadira",
      value: "Nadira menjadi pusat konflik dan pembuktian diri.",
      confidence: 0.76,
      metadata: { source: "imported_draft" },
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: "signal-conflict",
      draftImportId: DRAFT_IMPORT_ID,
      projectId: PROJECT_ID,
      type: "core_conflict",
      label: "Konflik status",
      value: "Penghinaan keluarga elite memicu pembalasan elegan.",
      confidence: 0.78,
      metadata: { source: "imported_draft" },
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: "signal-reader",
      draftImportId: DRAFT_IMPORT_ID,
      projectId: PROJECT_ID,
      type: "target_reader",
      label: "Pembaca serial mobile",
      value: "Cocok untuk pembaca drama cepat dengan hook kuat.",
      confidence: 0.7,
      metadata: { source: "imported_draft" },
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: "signal-continuity",
      draftImportId: DRAFT_IMPORT_ID,
      projectId: PROJECT_ID,
      type: "continuity_warning",
      label: "Periksa rahasia",
      value: "Rahasia kontrak lama perlu dilacak sebelum menjadi canon.",
      confidence: 0.74,
      metadata: { source: "imported_draft" },
      createdAt: now(),
      updatedAt: now(),
    },
  ];
}

async function forceApiMode(page: Page) {
  await page.addInitScript(() => {
    (window as Window & { __MOCK_OVERRIDE__?: string }).__MOCK_OVERRIDE__ = "false";
  });
}

async function injectSession(page: Page) {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  await page.goto("/login");
  await page.evaluate(
    ({ key, exp, user }) => {
      localStorage.setItem(
        key,
        JSON.stringify({
          access_token: "draft-import-access-token",
          refresh_token: "draft-import-refresh-token",
          expires_at: exp,
          expires_in: 3600,
          token_type: "bearer",
          user,
        }),
      );
    },
    { key: STORAGE_KEY, exp: expiresAt, user: sessionUser },
  );
}

async function mockShellApis(page: Page) {
  await page.route("**/api/me/profile", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          profile: {
            displayName: "Penulis Draft",
            email: sessionUser.email,
            planLabel: "Beta Premium",
          },
        },
      }),
    });
  });

  await page.route("**/api/credits/balance", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          creditBalance: {
            balance: 120,
            monthlyUsed: 0,
            monthlyQuota: 1000,
            resetAt: null,
          },
        },
      }),
    });
  });
}

async function mockDraftImportApis(page: Page) {
  await page.route(/\/api\/projects(\?|$)/, async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, data: projectPayload() }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [projectPayload()] }),
    });
  });

  await page.route(`**/api/projects/${PROJECT_ID}/draft-imports`, async (route) => {
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: { draftImport: draftImportPayload() },
      }),
    });
  });

  await page.route(
    `**/api/projects/${PROJECT_ID}/draft-imports/${DRAFT_IMPORT_ID}/extract-signals`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: {
            draftImport: draftImportPayload("signals_extracted"),
            signals: extractedSignals(),
          },
        }),
      });
    },
  );

  await page.route(
    `**/api/projects/${PROJECT_ID}/draft-imports/${DRAFT_IMPORT_ID}/import-jobs/resume`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: {
            importJob: importJobPayload(),
            resumed: false,
          },
        }),
      });
    },
  );

  await page.route(
    `**/api/projects/${PROJECT_ID}/draft-imports/${DRAFT_IMPORT_ID}/materialize-proposals`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: {
            draftImport: draftImportPayload("signals_extracted"),
            proposalCount: 4,
            proposalIds: ["proposal-character", "proposal-fact", "proposal-style", "proposal-voice"],
            proposalTypes: ["character", "fact", "style"],
          },
        }),
      });
    },
  );
}

test.describe("Sprint 15 draft import continuation", () => {
  test.beforeEach(async ({ page }) => {
    await forceApiMode(page);
    await mockShellApis(page);
    await mockDraftImportApis(page);
    await injectSession(page);
  });

  test("routes the has-draft start option to draft import", async ({ page }) => {
    await page.goto("/start");
    await page.getByRole("button", { name: "Lanjutkan draft" }).click();

    await page.waitForURL(`/projects/${PROJECT_ID}/import-draft`);
    await expect(page.getByRole("heading", { name: "Lanjutkan dari naskah yang sudah ada" })).toBeVisible();
  });

  test("imports draft text and extracts continuation signals", async ({ page }) => {
    await page.goto(`/projects/${PROJECT_ID}/import-draft`);

    await page.getByRole("textbox", { name: "Isi draft" }).fill(draftText);
    await page.getByRole("button", { name: "Import draft" }).click();
    await expect(page.getByText("74 kata terdeteksi.")).toBeVisible();
    await expect(page.getByText(/Progress prep.*5%/i)).toBeVisible();

    await page.getByRole("button", { name: "Deteksi sinyal" }).click();
    await expect(page.getByText("5 sinyal")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Drama Rumah Tangga" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Tokoh utama: Nadira" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Konflik status" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pembaca serial mobile" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Periksa rahasia" })).toBeVisible();
    await page.getByRole("button", { name: /Buat proposal review/i }).click();
    await expect(page.getByText(/4 proposal siap direview/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /Review di Fondasi/i })).toHaveAttribute(
      "href",
      `/projects/${PROJECT_ID}/foundation`,
    );
  });
});
