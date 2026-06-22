import { expect, test, type Page } from "@playwright/test";

const PROJECT_ID = "project-sprint15-version-history";
const SESSION_ID = "session-sprint15-version-history";
const CHAPTER_ID = "chapter-sprint15-version-history";
const BEAT_ID = "beat-sprint15-version-history";
const VERSION_1_ID = "prose-sprint15-v1";
const VERSION_2_ID = "prose-sprint15-v2";
const VERSION_3_ID = "prose-sprint15-v3";
const SUPABASE_REF = process.env.SMOKE_SUPABASE_REF?.trim() || "jdxyhrnibmmwlbtbokqo";
const STORAGE_KEY = `sb-${SUPABASE_REF}-auth-token`;

const VERSION_1_TEXT =
  "Gerbang tua itu menyebut nama keluarga yang lama ia sembunyikan.";
const VERSION_2_TEXT =
  "Gerbang tua itu menyebut nama keluarga yang lama ia sembunyikan, lalu membuka jalan menuju halaman yang gelap.";
const VERSION_3_TEXT =
  "Gerbang tua itu menyebut nama keluarga yang lama ia sembunyikan, lalu menawarkan jalan pulang yang belum tentu selamat.";

const sessionUser = {
  id: "user-sprint15-version-history",
  aud: "authenticated",
  role: "authenticated",
  email: "writer-sprint15-version@example.com",
};

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
          access_token: "sprint15-access-token",
          refresh_token: "sprint15-refresh-token",
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

function nowIso() {
  return new Date().toISOString();
}

function projectPayload() {
  const now = nowIso();
  return {
    id: PROJECT_ID,
    title: "Sprint 15 Version Project",
    entryPath: "no_idea",
    workflowPhase: "outline_locked",
    status: "in_progress",
    currentChapter: 1,
    genre: "Drama",
    isActive: true,
    lastEditedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

function outlinePayload() {
  const now = nowIso();
  return {
    outlinePlan: {
      id: "outline-plan-sprint15-version",
      projectId: PROJECT_ID,
      status: "locked",
      seasonLabel: "Musim Uji",
      arcSummary: "Arc pengujian riwayat versi.",
      retentionSummary: "Hook serial tiap adegan.",
      targetChapterCount: 10,
      planningNotes: null,
      metadata: {},
      lockedAt: now,
      createdAt: now,
      updatedAt: now,
    },
    chapterOutlines: [
      {
        id: CHAPTER_ID,
        projectId: PROJECT_ID,
        outlinePlanId: "outline-plan-sprint15-version",
        chapterNumber: 1,
        title: "Gerbang yang Mengingat Nama",
        summary: "Tokoh utama diuji oleh gerbang tua.",
        purpose: "Membuka konflik keluarga.",
        chapterFunction: "setup",
        emotionalDirection: "curious",
        hook: "Gerbang menyebut nama lama.",
        endingHook: "Jalan gelap terbuka.",
        miniVictory: "Tokoh utama berani masuk.",
        povCharacterId: null,
        status: "locked",
        markers: [],
        metadata: {},
        createdAt: now,
        updatedAt: now,
      },
    ],
    openLoops: [],
    plannedReveals: [],
    planningTruthRedacted: true,
  };
}

function creditBalance() {
  return {
    id: "credit-sprint15-version",
    userId: sessionUser.id,
    balance: 120,
    monthlyQuota: 1000,
    monthlyUsed: 0,
    resetAt: null,
    source: "test",
    updatedAt: nowIso(),
  };
}

function writingSessionPayload() {
  const now = nowIso();
  return {
    session: {
      id: SESSION_ID,
      projectId: PROJECT_ID,
      chapterOutlineId: CHAPTER_ID,
      status: "active",
      activeBeatId: BEAT_ID,
      startedAt: now,
      lastActivityAt: now,
      readyForSummaryAt: null,
      metadata: {},
      createdAt: now,
      updatedAt: now,
    },
    writingState: {
      id: "state-sprint15-version",
      projectId: PROJECT_ID,
      chapterOutlineId: CHAPTER_ID,
      writingSessionId: SESSION_ID,
      status: "drafting",
      wordCount: 19,
      lastSavedAt: now,
      metadata: {},
      createdAt: now,
      updatedAt: now,
    },
  };
}

function beatPayload() {
  const now = nowIso();
  return {
    id: BEAT_ID,
    projectId: PROJECT_ID,
    chapterOutlineId: CHAPTER_ID,
    writingSessionId: SESSION_ID,
    beatNumber: 1,
    title: "Gerbang Tua",
    summary: "Tokoh utama membaca tanda di gerbang.",
    direction: "Bangun rasa penasaran tanpa membuka rahasia akhir.",
    status: "draft",
    emotionalShift: "curious",
    mustInclude: ["gerbang tua", "nama keluarga"],
    mustNotInclude: ["jawaban final"],
    wordTarget: 650,
    stopCondition: "Berhenti pada jalan yang terbuka.",
    sortOrder: 1,
    metadata: {},
    createdAt: now,
    updatedAt: now,
  };
}

function proseVersion(id: string, versionNumber: number, proseText: string, isCurrent: boolean) {
  return {
    id,
    projectId: PROJECT_ID,
    chapterBeatId: BEAT_ID,
    versionNumber,
    proseText,
    wordCount: proseText.split(/\s+/).filter(Boolean).length,
    source: versionNumber === 2 ? "ai_generated" : "user_edited",
    isCurrent,
    contextPacketLogId: versionNumber === 2 ? "packet-sprint15-version" : null,
    metadata: {},
    createdAt: nowIso(),
  };
}

async function mockWriteApis(page: Page) {
  let currentVersionId = VERSION_2_ID;
  let makeCurrentCalls = 0;
  let makeCurrentV2Calls = 0;
  let aiVersionCreated = false;

  const versionPayload = () => {
    const versions = [
      ...(aiVersionCreated
        ? [proseVersion(VERSION_3_ID, 3, VERSION_3_TEXT, currentVersionId === VERSION_3_ID)]
        : []),
      proseVersion(VERSION_2_ID, 2, VERSION_2_TEXT, currentVersionId === VERSION_2_ID),
      proseVersion(VERSION_1_ID, 1, VERSION_1_TEXT, currentVersionId === VERSION_1_ID),
    ];
    return {
      versions,
      currentVersion: versions.find((version) => version.isCurrent) ?? null,
    };
  };

  await page.route("**/api/health", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          env: {
            creditTopupEnabled: false,
            paymentProviderMock: true,
            aiGenerationEnabled: true,
          },
        },
      }),
    });
  });

  await page.route("**/api/projects", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [projectPayload()] }),
    });
  });

  await page.route(`**/api/projects/${PROJECT_ID}/settings`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          qualityMode: "seimbang",
          qualityTier: "seimbang",
          defaultOutputStyle: "warm_emotional",
          defaultFormat: "hp_kbm",
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
        data: { creditBalance: creditBalance() },
      }),
    });
  });

  await page.route(`**/api/projects/${PROJECT_ID}/outline`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: outlinePayload() }),
    });
  });

  await page.route(`**/api/projects/${PROJECT_ID}/write/sessions`, async (route) => {
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: writingSessionPayload() }),
    });
  });

  await page.route(`**/api/projects/${PROJECT_ID}/write/sessions/${SESSION_ID}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          ...writingSessionPayload(),
          chapterOutline: {
            id: CHAPTER_ID,
            chapterNumber: 1,
            title: "Gerbang yang Mengingat Nama",
            summary: "Tokoh utama diuji oleh gerbang tua.",
            status: "locked",
          },
          activeBeat: beatPayload(),
          beatsCount: 1,
        },
      }),
    });
  });

  await page.route(`**/api/projects/${PROJECT_ID}/write/sessions/${SESSION_ID}/beats`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: { beats: [beatPayload()] } }),
    });
  });

  await page.route(`**/api/projects/${PROJECT_ID}/write/beats/${BEAT_ID}/prose`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: versionPayload() }),
    });
  });

  await page.route(
    `**/api/projects/${PROJECT_ID}/write/prose/${VERSION_1_ID}/make-current`,
    async (route) => {
      makeCurrentCalls += 1;
      currentVersionId = VERSION_1_ID;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: {
            version: proseVersion(VERSION_1_ID, 1, VERSION_1_TEXT, true),
            chapterWordCount: 10,
          },
        }),
      });
    },
  );

  await page.route(
    `**/api/projects/${PROJECT_ID}/write/prose/${VERSION_2_ID}/make-current`,
    async (route) => {
      makeCurrentV2Calls += 1;
      currentVersionId = VERSION_2_ID;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: {
            version: proseVersion(VERSION_2_ID, 2, VERSION_2_TEXT, true),
            chapterWordCount: 17,
          },
        }),
      });
    },
  );

  await page.route(`**/api/projects/${PROJECT_ID}/ai/generate-prose`, async (route) => {
    aiVersionCreated = true;
    currentVersionId = VERSION_3_ID;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          version: proseVersion(VERSION_3_ID, 3, VERSION_3_TEXT, true),
          generationAttempt: {
            id: "attempt-sprint15-version",
            status: "succeeded",
            generationType: "prose_beat",
            creditCost: 10,
            outputEntityId: VERSION_3_ID,
            errorCode: null,
            errorMessageSafe: null,
          },
          creditBalance: creditBalance(),
          creditCost: 10,
          idempotentReplay: false,
        },
      }),
    });
  });

  return {
    get makeCurrentCalls() {
      return makeCurrentCalls;
    },
    get makeCurrentV2Calls() {
      return makeCurrentV2Calls;
    },
  };
}

test.describe("Sprint 15 write room version history", () => {
  test.beforeEach(async ({ page }) => {
    await forceApiMode(page);
    await injectSession(page);
  });

  test("desktop writer can compare versions and make an older version current", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const api = await mockWriteApis(page);

    await page.goto(`/projects/${PROJECT_ID}/write`);
    await expect(page.getByText(/Memuat ruang tulis/)).toBeHidden({ timeout: 15_000 });

    const versionPanel = page.getByTestId("writer-version-history");
    await expect(versionPanel.getByRole("heading", { name: "Riwayat Versi" })).toBeVisible();
    await expect(versionPanel.getByRole("button", { name: /v2.*AI/i })).toBeVisible();

    const editor = page.getByRole("textbox", { name: /Narasi adegan 1/i });
    await editor.fill(`${VERSION_2_TEXT} Kalimat tambahan.`);
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(editor).toHaveValue(VERSION_2_TEXT);
    await page.getByRole("button", { name: "Redo" }).click();
    await expect(editor).toHaveValue(`${VERSION_2_TEXT} Kalimat tambahan.`);

    await versionPanel.getByRole("button", { name: /v1.*Manual/i }).click();

    await expect(versionPanel.getByText("Dihapus dari versi aktif")).toBeVisible();
    await expect(versionPanel.getByText("Ditambahkan di versi aktif")).toBeVisible();
    await expect(versionPanel.getByText("menuju", { exact: true })).toBeVisible();
    await expect(versionPanel.getByText("halaman", { exact: true })).toBeVisible();

    await versionPanel.getByRole("button", { name: "Pakai versi ini" }).click();

    await expect(page.getByRole("textbox", { name: /Narasi adegan 1/i })).toHaveValue(
      VERSION_1_TEXT,
    );
    await expect(page.getByText(/Versi v1 dipakai/i)).toBeVisible();
    await expect.poll(() => api.makeCurrentCalls).toBe(1);
  });

  test("desktop writer can reject a newly generated AI version", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const api = await mockWriteApis(page);

    await page.goto(`/projects/${PROJECT_ID}/write`);
    await expect(page.getByText(/Memuat ruang tulis/)).toBeHidden({ timeout: 15_000 });

    await page.getByRole("button", { name: /Tulis Beat dengan AI/i }).first().click();
    const versionPanel = page.getByTestId("writer-version-history");

    await expect(versionPanel.getByText("Versi AI baru menunggu review")).toBeVisible({
      timeout: 15_000,
    });
    await expect(versionPanel.getByRole("button", { name: /v3.*AI/i })).toBeVisible();
    await expect(page.getByRole("textbox", { name: /Narasi adegan 1/i })).toHaveValue(
      VERSION_3_TEXT,
    );

    await versionPanel.getByRole("button", { name: "Tolak versi AI" }).click();

    await expect(page.getByRole("textbox", { name: /Narasi adegan 1/i })).toHaveValue(
      VERSION_2_TEXT,
    );
    await expect(versionPanel.getByText("Versi AI baru menunggu review")).toHaveCount(0);
    await expect.poll(() => api.makeCurrentV2Calls).toBe(1);
  });

  test("desktop writer sees credit cost and remaining balance before generating", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockWriteApis(page);

    await page.goto(`/projects/${PROJECT_ID}/write`);
    await expect(page.getByText(/Memuat ruang tulis/)).toBeHidden({ timeout: 15_000 });

    const assistant = page.getByRole("complementary").filter({ hasText: "Asisten AI" });
    await expect(assistant.getByText("120")).toBeVisible();
    await expect(assistant.getByText("Mode kualitas: Seimbang")).toBeVisible();
    await expect(
      assistant.getByText("Biaya Tulis Beat dengan AI: 10 kredit"),
    ).toBeVisible();
    await expect(
      assistant.getByText("Estimasi sisa setelah generate: 110 kredit"),
    ).toBeVisible();
    await expect(assistant.getByText("Biaya: 10 kredit")).toBeVisible();
  });

  test("desktop writer can open reader preview instead of showing a disabled stub", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockWriteApis(page);

    await page.goto(`/projects/${PROJECT_ID}/write`);
    await expect(page.getByText(/Memuat ruang tulis/)).toBeHidden({ timeout: 15_000 });

    const previewButton = page.getByRole("button", { name: "Pratinjau" });
    await expect(previewButton).toBeEnabled();
    await expect(page.getByRole("button", { name: "Tambah adegan" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Tutup panel asisten" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Cek Ulang Cerita" })).toHaveCount(0);

    await previewButton.click();

    const preview = page.getByRole("region", { name: "Pratinjau pembaca" });
    await expect(preview).toBeVisible();
    await expect(preview.getByText(VERSION_2_TEXT)).toBeVisible();
    await expect(previewButton).toHaveAttribute("aria-pressed", "true");

    await previewButton.click();
    await expect(preview).toHaveCount(0);
    await expect(previewButton).toHaveAttribute("aria-pressed", "false");
  });
});
