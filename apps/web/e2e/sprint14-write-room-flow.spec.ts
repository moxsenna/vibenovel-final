import { expect, test, type Page } from "@playwright/test";

const PROJECT_ID = "project-sprint14-write";
const SESSION_ID = "session-sprint14-write";
const CHAPTER_ID = "chapter-sprint14-write";
const BEAT_ID = "beat-sprint14-write";
const SUPABASE_REF = process.env.SMOKE_SUPABASE_REF?.trim() || "jdxyhrnibmmwlbtbokqo";
const STORAGE_KEY = `sb-${SUPABASE_REF}-auth-token`;

const sessionUser = {
  id: "user-sprint14-write",
  aud: "authenticated",
  role: "authenticated",
  email: "writer-sprint14@example.com",
};

async function forceApiMode(page: Page) {
  await page.addInitScript(() => {
    (window as any).__MOCK_OVERRIDE__ = "false";
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
          access_token: "sprint14-access-token",
          refresh_token: "sprint14-refresh-token",
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

function projectPayload(workflowPhase = "outline_locked") {
  const now = new Date().toISOString();
  return {
    id: PROJECT_ID,
    title: "Sprint 14 Write Project",
    entryPath: "no_idea",
    workflowPhase,
    status: "in_progress",
    currentChapter: 1,
    genre: "Drama",
    isActive: true,
    lastEditedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

function outlinePayload(options?: { locked?: boolean; includeChapter?: boolean }) {
  const locked = options?.locked ?? true;
  const includeChapter = options?.includeChapter ?? true;
  const now = new Date().toISOString();
  return {
    outlinePlan: {
      id: "outline-plan-sprint14",
      projectId: PROJECT_ID,
      status: locked ? "locked" : "generated",
      seasonLabel: "Musim Uji",
      arcSummary: "Arc pengujian ruang tulis.",
      retentionSummary: "Hook serial tiap adegan.",
      targetChapterCount: 10,
      planningNotes: "Tidak ada catatan teknis.",
      metadata: {},
      lockedAt: locked ? now : null,
      createdAt: now,
      updatedAt: now,
    },
    chapterOutlines: includeChapter
      ? [
          {
            id: CHAPTER_ID,
            projectId: PROJECT_ID,
            outlinePlanId: "outline-plan-sprint14",
            chapterNumber: 1,
            title: "Janji di Gerbang Kota",
            summary: "Tokoh utama menemukan janji lama yang mengikat keluarga.",
            purpose: "Membuka konflik utama.",
            chapterFunction: "setup",
            emotionalDirection: "curious",
            hook: "Sebuah nama muncul di balik gerbang.",
            endingHook: "Gerbang terbuka sendiri.",
            miniVictory: "Tokoh utama berani masuk.",
            povCharacterId: null,
            status: "locked",
            markers: [],
            metadata: {},
            createdAt: now,
            updatedAt: now,
          },
        ]
      : [],
    openLoops: [],
    plannedReveals: [],
    planningTruthRedacted: true,
  };
}

function creditBalance(balance = 120) {
  return {
    id: "credit-sprint14",
    userId: sessionUser.id,
    balance,
    monthlyQuota: 1000,
    monthlyUsed: 0,
    resetAt: null,
    source: "test",
    updatedAt: new Date().toISOString(),
  };
}

function writingSessionPayload() {
  const now = new Date().toISOString();
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
      id: "state-sprint14",
      projectId: PROJECT_ID,
      chapterOutlineId: CHAPTER_ID,
      writingSessionId: SESSION_ID,
      status: "drafting",
      wordCount: 32,
      lastSavedAt: now,
      metadata: {},
      createdAt: now,
      updatedAt: now,
    },
  };
}

function beatPayload() {
  const now = new Date().toISOString();
  return {
    id: BEAT_ID,
    projectId: PROJECT_ID,
    chapterOutlineId: CHAPTER_ID,
    writingSessionId: SESSION_ID,
    beatNumber: 1,
    title: "Gerbang yang Mengingat Nama",
    summary: "Tokoh utama menguji apakah gerbang itu mengenali keluarganya.",
    direction: "Bangun rasa penasaran tanpa membuka rahasia akhir.",
    status: "draft",
    emotionalShift: "curious",
    mustInclude: ["gerbang tua", "janji keluarga"],
    mustNotInclude: ["jawaban final"],
    wordTarget: 650,
    stopCondition: "Berhenti pada gerbang yang terbuka.",
    sortOrder: 1,
    metadata: {},
    createdAt: now,
    updatedAt: now,
  };
}

async function mockBaseWriteApis(
  page: Page,
  options?: {
    outlineLocked?: boolean;
    includeChapter?: boolean;
    sessionErrorMissing?: string[];
    balance?: number;
    aiErrorCode?: string;
  },
) {
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
        data: { creditBalance: creditBalance(options?.balance ?? 120) },
      }),
    });
  });

  await page.route(`**/api/projects/${PROJECT_ID}/outline`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: outlinePayload({
          locked: options?.outlineLocked ?? true,
          includeChapter: options?.includeChapter ?? true,
        }),
      }),
    });
  });

  await page.route(`**/api/projects/${PROJECT_ID}/write/sessions`, async (route) => {
    if (options?.sessionErrorMissing) {
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          error: {
            code: "CONFLICT",
            message: "Write room is not ready",
            details: { missing: options.sessionErrorMissing },
          },
        }),
      });
      return;
    }

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
            title: "Janji di Gerbang Kota",
            summary: "Tokoh utama menemukan janji lama.",
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
      body: JSON.stringify({
        ok: true,
        data: {
          versions: [
            {
              id: "prose-sprint14-v1",
              projectId: PROJECT_ID,
              chapterBeatId: BEAT_ID,
              versionNumber: 1,
              proseText:
                "Gerbang tua itu menyebut nama keluarga yang sudah lama tidak berani ia ucapkan.",
              wordCount: 14,
              source: "user_edited",
              isCurrent: true,
              contextPacketLogId: null,
              metadata: {},
              createdAt: new Date().toISOString(),
            },
          ],
          currentVersion: {
            id: "prose-sprint14-v1",
            projectId: PROJECT_ID,
            chapterBeatId: BEAT_ID,
            versionNumber: 1,
            proseText:
              "Gerbang tua itu menyebut nama keluarga yang sudah lama tidak berani ia ucapkan.",
            wordCount: 14,
            source: "user_edited",
            isCurrent: true,
            contextPacketLogId: null,
            metadata: {},
            createdAt: new Date().toISOString(),
          },
        },
      }),
    });
  });

  await page.route(`**/api/projects/${PROJECT_ID}/ai/generate-prose`, async (route) => {
    const code = options?.aiErrorCode;
    if (code) {
      await route.fulfill({
        status: code === "INSUFFICIENT_CREDIT" ? 402 : 503,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          error: {
            code,
            message: code === "AI_DISABLED" ? "AI generation is disabled" : "AI provider unavailable",
          },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          version: {
            id: "prose-sprint14-ai",
            projectId: PROJECT_ID,
            chapterBeatId: BEAT_ID,
            versionNumber: 2,
            proseText:
              "Gerbang itu bergerak perlahan, seolah mengundang ia memilih antara janji dan rasa takut.",
            wordCount: 15,
            source: "ai_generated",
            isCurrent: true,
            contextPacketLogId: "packet-sprint14",
            metadata: {},
            createdAt: new Date().toISOString(),
          },
          generationAttempt: {
            id: "attempt-sprint14",
            status: "succeeded",
            generationType: "prose_beat",
            creditCost: 10,
            outputEntityId: "prose-sprint14-ai",
            errorCode: null,
            errorMessageSafe: null,
          },
          creditBalance: creditBalance(110),
          creditCost: 10,
          idempotentReplay: false,
        },
      }),
    });
  });
}

test.describe("Sprint 14 write room recovery", () => {
  test.beforeEach(async ({ page }) => {
    await forceApiMode(page);
    await injectSession(page);
  });

  test("shows precise locked-state copy for missing prerequisites", async ({ page }) => {
    await mockBaseWriteApis(page, { outlineLocked: false });
    await page.goto(`/projects/${PROJECT_ID}/write`);

    await expect(page.getByText(/Memuat ruang tulis/)).toBeHidden({ timeout: 15_000 });
    await expect(page.getByRole("heading", { name: /Outline belum dikunci/i })).toBeVisible();
    await expect(page.getByText(/Kunci outline di halaman Outline/i)).toBeVisible();
    await expect(page.getByText(/API tidak tersedia/i)).toHaveCount(0);
  });

  test("shows precise copy when the foundation gate blocks session creation", async ({ page }) => {
    await mockBaseWriteApis(page, { sessionErrorMissing: ["foundation_locked"] });
    await page.goto(`/projects/${PROJECT_ID}/write`);

    await expect(page.getByText(/Memuat ruang tulis/)).toBeHidden({ timeout: 15_000 });
    await expect(page.getByRole("heading", { name: /Fondasi belum dikunci/i })).toBeVisible();
    await expect(page.getByText(/Kunci fondasi cerita/i)).toBeVisible();
    await expect(page.getByText(/API tidak tersedia/i)).toHaveCount(0);
  });

  for (const viewport of [
    { width: 375, height: 812 },
    { width: 430, height: 932 },
  ]) {
    test(`mobile write room is usable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await mockBaseWriteApis(page);
      await page.goto(`/projects/${PROJECT_ID}/write`);

      await expect(page.getByText(/Memuat ruang tulis/)).toBeHidden({ timeout: 15_000 });
      await expect(page.getByText(/Bab 1/).first()).toBeVisible();
      await expect(page.getByText("Pilih adegan")).toBeVisible();
      await expect(page.getByRole("textbox", { name: /Narasi adegan 1/i })).toBeVisible();
      const mobileAssistant = page.locator('section[aria-label="Asisten AI"]');
      await expect(mobileAssistant.getByRole("heading", { name: "Asisten AI" })).toBeVisible();
      await expect(mobileAssistant.getByText("Biaya Tulis Beat dengan AI: 10 kredit")).toBeVisible();
      await expect(page.getByRole("button", { name: "Tulis Beat dengan AI" })).toBeVisible();

      const noHorizontalOverflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth <= window.innerWidth &&
          document.body.scrollWidth <= window.innerWidth,
      );
      expect(noHorizontalOverflow).toBe(true);
    });
  }

  test("AI action errors use product copy for credit and provider states", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockBaseWriteApis(page, { aiErrorCode: "AI_PROVIDER_ERROR" });
    await page.goto(`/projects/${PROJECT_ID}/write`);

    await expect(page.getByText(/Memuat ruang tulis/)).toBeHidden({ timeout: 15_000 });
    await page.getByRole("button", { name: /Tulis Beat dengan AI/i }).first().click();
    await expect(page.locator("aside").getByText(/AI provider sedang tidak tersedia/i)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/API tidak tersedia/i)).toHaveCount(0);
  });
});
