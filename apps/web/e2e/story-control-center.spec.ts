import { expect, test, type Page, type Route } from "@playwright/test";

const PROJECT_ID = "project-story-control";
const CHARACTER_ID = "character-story-control";
const FACT_ID = "fact-story-control";
const REVEAL_ID = "reveal-story-control";
const SUPABASE_REF = process.env.SMOKE_SUPABASE_REF?.trim() || "jdxyhrnibmmwlbtbokqo";
const STORAGE_KEY = `sb-${SUPABASE_REF}-auth-token`;
const now = () => new Date().toISOString();

let creatorMode: "simple" | "advanced" = "advanced";
let revealPatchBody: Record<string, unknown> | null = null;

async function json(route: Route, data: unknown) {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, data }),
  });
}

async function injectSession(page: Page) {
  const user = {
    id: "story-control-owner",
    aud: "authenticated",
    role: "authenticated",
    email: "story-control@example.com",
  };
  await page.goto("/login");
  await page.evaluate(
    ({ key, sessionUser }) => {
      localStorage.setItem(
        key,
        JSON.stringify({
          access_token: "story-control-token",
          refresh_token: "story-control-refresh",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          expires_in: 3600,
          token_type: "bearer",
          user: sessionUser,
        }),
      );
    },
    { key: STORAGE_KEY, sessionUser: user },
  );
}

async function mockApis(page: Page) {
  await page.addInitScript(() => {
    (window as Window & { __MOCK_OVERRIDE__?: string }).__MOCK_OVERRIDE__ = "false";
  });

  await page.route("**/api/me", (route) => json(route, {
    user: { id: "story-control-owner", email: "story-control@example.com" },
    profile: {
      id: "story-control-owner",
      displayName: "Story Controller",
      email: "story-control@example.com",
      defaultLanguage: "id",
      planLabel: "Private beta",
      role: "writer",
      subscriptionPlan: "free",
      createdAt: now(),
      updatedAt: now(),
    },
    creditBalance: {
      id: "balance-story-control",
      userId: "story-control-owner",
      balance: 100,
      monthlyUsed: 0,
      monthlyQuota: 100,
      resetAt: null,
      source: "seed",
      updatedAt: now(),
    },
  }));
  await page.route("**/api/credits/balance", (route) => json(route, {
    id: "balance-story-control",
    userId: "story-control-owner",
    balance: 100,
    monthlyUsed: 0,
    monthlyQuota: 100,
    resetAt: null,
    source: "seed",
    updatedAt: now(),
  }));
  await page.route(/\/api\/projects(\?|$)/, (route) => json(route, [{
    id: PROJECT_ID,
    ownerId: "story-control-owner",
    title: "Serial Panjang",
    genre: "Drama",
    status: "in_progress",
    currentChapter: 3,
    entryPath: "no_idea",
    isActive: true,
    workflowPhase: "writing",
    lastEditedAt: now(),
    createdAt: now(),
    updatedAt: now(),
  }]));
  await page.route(`**/api/projects/${PROJECT_ID}/settings`, (route) => json(route, {
    creatorMode,
    qualityMode: "seimbang",
    qualityTier: "seimbang",
    defaultOutputStyle: "warm_emotional",
    defaultFormat: "hp_kbm",
  }));
  await page.route(`**/api/projects/${PROJECT_ID}/facts`, (route) => json(route, [{
    id: FACT_ID,
    projectId: PROJECT_ID,
    text: "Siska pernah tinggal di rumah lama.",
    category: "backstory",
    importance: "major",
    canonStatus: "confirmed",
    isLocked: true,
    source: "user",
    acceptedFromProposalId: null,
    createdAt: now(),
    updatedAt: now(),
  }]));
  await page.route(`**/api/projects/${PROJECT_ID}/characters`, (route) => json(route, [{
    id: CHARACTER_ID,
    projectId: PROJECT_ID,
    name: "Siska",
    roleLabel: "Tokoh Utama",
    role: "protagonist",
    description: "Perempuan yang menyimpan masa lalu.",
    importance: "main",
    status: "active",
    source: "user",
    sortOrder: 1,
    createdAt: now(),
    updatedAt: now(),
  }]));
  await page.route(`**/api/projects/${PROJECT_ID}/outline`, (route) => json(route, {
    outlinePlan: null,
    chapterOutlines: [],
    openLoops: [{
      id: "loop-story-control",
      projectId: PROJECT_ID,
      outlinePlanId: "outline-story-control",
      openedInChapterOutlineId: null,
      payoffChapterOutlineId: null,
      question: "Siapa yang meninggalkan surat itu?",
      readerFacingHint: "Tulisan tangan terasa familier.",
      status: "opened",
      importance: "major",
      metadata: {},
      createdAt: now(),
      updatedAt: now(),
    }],
    plannedReveals: [{
      id: REVEAL_ID,
      projectId: PROJECT_ID,
      outlinePlanId: "outline-story-control",
      plannedChapterOutlineId: null,
      relatedFactId: null,
      relatedProposalId: null,
      title: "Identitas pengirim surat",
      readerFacingHint: "Ada bekas tinta biru.",
      forbiddenBeforeChapter: 8,
      status: "planned",
      riskLevel: "high",
      metadata: {},
      planningTruthRedacted: true,
      createdAt: now(),
      updatedAt: now(),
    }],
    planningTruthRedacted: true,
  }));
  await page.route(`**/api/projects/${PROJECT_ID}/style-profile`, async (route) => {
    if (route.request().method() === "PUT") {
      return json(route, {
        id: "style-story-control",
        projectId: PROJECT_ID,
        version: 2,
        status: "active",
        source: "manual_story_control",
        sourceProseVersionIds: [],
        operationalRules: JSON.parse(route.request().postData() || "{}").operationalRules,
        createdAt: now(),
        updatedAt: now(),
      });
    }
    return json(route, { profile: null });
  });
  await page.route(
    `**/api/projects/${PROJECT_ID}/continuity/characters/${CHARACTER_ID}/state`,
    (route) => json(route, { characterId: CHARACTER_ID, state: null, history: [] }),
  );
  await page.route(
    `**/api/projects/${PROJECT_ID}/continuity/characters/${CHARACTER_ID}/knowledge`,
    (route) => json(route, { characterId: CHARACTER_ID, knowledge: [] }),
  );
  await page.route(
    `**/api/projects/${PROJECT_ID}/outline/reveals/${REVEAL_ID}`,
    async (route) => {
      revealPatchBody = JSON.parse(route.request().postData() || "{}");
      await json(route, {
        id: REVEAL_ID,
        projectId: PROJECT_ID,
        outlinePlanId: "outline-story-control",
        plannedChapterOutlineId: null,
        relatedFactId: null,
        relatedProposalId: null,
        title: "Identitas pengirim surat",
        readerFacingHint: "Ada bekas tinta biru.",
        forbiddenBeforeChapter: 8,
        status: "planned",
        riskLevel: "high",
        metadata: {},
        planningTruthRedacted: true,
        createdAt: now(),
        updatedAt: now(),
      });
    },
  );
}

test.describe("Story Control Center", () => {
  test.beforeEach(async ({ page }) => {
    creatorMode = "advanced";
    revealPatchBody = null;
    await mockApis(page);
    await injectSession(page);
  });

  test("advanced owner can replace redacted truth with explicit confirmation", async ({ page }) => {
    await page.goto(`/projects/${PROJECT_ID}/story-control`);

    await expect(page.getByRole("heading", { name: "Story Control Center" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Fakta Canon" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Jadwal Reveal" })).toBeVisible();
    await expect(page.getByText("Truth disembunyikan")).toBeVisible();
    await expect(page.getByText("Siska adalah pengirim surat")).toHaveCount(0);

    await page.getByRole("button", { name: "Ganti rahasia author-only" }).click();
    const truthInput = page.getByLabel("Planning truth pengganti untuk Identitas pengirim surat");
    await expect(truthInput).toHaveValue("");
    await truthInput.fill("Siska adalah pengirim surat");
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Ganti planning truth" }).click();

    await expect(page.getByText(/Planning truth diganti/)).toBeVisible();
    expect(revealPatchBody).toEqual({
      planningTruth: "Siska adalah pengirim surat",
      confirmation: "UPDATE_PLANNING_TRUTH",
    });
  });

  test("simple mode is gated and does not render control panels", async ({ page }) => {
    creatorMode = "simple";
    await page.goto(`/projects/${PROJECT_ID}/story-control`);

    await expect(
      page.getByRole("heading", { name: "Story Control khusus Creator Advanced" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Fakta Canon" })).toHaveCount(0);
  });
});
