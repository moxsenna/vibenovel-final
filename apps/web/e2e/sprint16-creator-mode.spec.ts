import { expect, test, type Page } from "@playwright/test";

const PROJECT_ID = "project-sprint16-creator";
const SUPABASE_REF = process.env.SMOKE_SUPABASE_REF?.trim() || "jdxyhrnibmmwlbtbokqo";
const STORAGE_KEY = `sb-${SUPABASE_REF}-auth-token`;

const sessionUser = {
  id: "user-sprint16-creator",
  aud: "authenticated",
  role: "authenticated",
  email: "creator-mode@example.com",
};

const now = () => new Date().toISOString();

let persistedCreatorMode: "simple" | "advanced" = "simple";

function projectPayload() {
  return {
    id: PROJECT_ID,
    title: "Creator Mode Project",
    entryPath: "no_idea",
    workflowPhase: "outline",
    status: "in_progress",
    currentChapter: 0,
    genre: "Drama",
    isActive: true,
    lastEditedAt: now(),
    createdAt: now(),
    updatedAt: now(),
  };
}

function settingsPayload() {
  return {
    id: "settings-sprint16",
    projectId: PROJECT_ID,
    qualityMode: "seimbang",
    qualityTier: "seimbang",
    defaultOutputStyle: "warm_emotional",
    defaultFormat: "hp_kbm",
    outputStylePreference: "warm_emotional",
    mobileFormatPreference: "hp_kbm",
    targetLengthPlan: null,
    targetLengthBand: null,
    creatorMode: persistedCreatorMode,
    defaultLanguage: "id",
    defaultGenre: "Drama",
    createdAt: now(),
    updatedAt: now(),
  };
}

function outlineBundle() {
  return {
    outlinePlan: null,
    chapterOutlines: [],
    openLoops: [],
    plannedReveals: [],
    planningTruthRedacted: true,
  };
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
          access_token: "sprint16-access-token",
          refresh_token: "sprint16-refresh-token",
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

async function mockBaseApis(page: Page) {
  const profile = {
    id: sessionUser.id,
    displayName: "Creator Mode Writer",
    email: sessionUser.email,
    defaultLanguage: "id",
    planLabel: "Beta Premium",
    role: "writer",
    subscriptionPlan: "free",
    createdAt: now(),
    updatedAt: now(),
  };
  const creditBalance = {
    id: "credit-sprint16",
    userId: sessionUser.id,
    balance: 90,
    monthlyUsed: 10,
    monthlyQuota: 100,
    resetAt: null,
    source: "seed",
    updatedAt: now(),
  };

  await page.route("**/api/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          user: { id: sessionUser.id, email: sessionUser.email },
          profile,
          creditBalance,
        },
      }),
    });
  });

  await page.route("**/api/me/profile", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          profile,
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
          creditBalance,
        },
      }),
    });
  });

  await page.route(/\/api\/projects(\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: [projectPayload()] }),
    });
  });

  await page.route(`**/api/projects/${PROJECT_ID}/settings**`, async (route) => {
    if (route.request().method() === "PUT") {
      const body = JSON.parse(route.request().postData() || "{}") as {
        creatorMode?: "simple" | "advanced";
      };
      persistedCreatorMode = body.creatorMode ?? persistedCreatorMode;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: settingsPayload() }),
    });
  });

  await page.route(`**/api/projects/${PROJECT_ID}/outline**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: outlineBundle() }),
    });
  });
}

test.describe("Sprint 16 creator mode", () => {
  test.beforeEach(async ({ page }) => {
    persistedCreatorMode = "simple";
    await forceApiMode(page);
    await mockBaseApis(page);
    await injectSession(page);
  });

  test("persists advanced creator mode from settings after reload", async ({ page }) => {
    await page.goto("/settings");

    await expect(page.getByRole("heading", { name: "Mode Creator" })).toBeVisible();
    await expect(page.getByRole("radio", { name: /Simple/ })).toBeChecked();
    await page.getByRole("radio", { name: /Advanced/ }).check();
    await page.getByRole("button", { name: "Simpan Perubahan" }).click();
    await expect(page.getByText("Mode creator disimpan ke API.")).toBeVisible();

    await page.reload();
    await expect(page.getByRole("radio", { name: /Advanced/ })).toBeChecked();
  });

  test("advanced creator mode reveals outline planning controls", async ({ page }) => {
    persistedCreatorMode = "advanced";

    await page.goto(`/projects/${PROJECT_ID}/outline`);

    await expect(page.getByRole("heading", { name: "Kontrol Creator Advanced" })).toBeVisible();
    await expect(page.getByLabel("Jumlah bab")).toHaveValue("10");
    await expect(page.getByLabel("Kepadatan reveal")).toHaveValue("sedang");
    await expect(page.getByLabel("Intensitas retensi")).toHaveValue("seimbang");
    await expect(page.getByLabel("Target gaya prosa")).toHaveValue("hangat emosional");
  });

  test("simple mode keeps advanced outline controls hidden", async ({ page }) => {
    await page.goto(`/projects/${PROJECT_ID}/outline`);

    await expect(page.getByRole("heading", { name: "Kontrol Creator Advanced" })).toHaveCount(0);
  });
});
