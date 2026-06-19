import { expect, test, type Page, type Route } from "@playwright/test";

const SUPABASE_REF =
  process.env.SMOKE_SUPABASE_REF?.trim() || "jdxyhrnibmmwlbtbokqo";
const STORAGE_KEYS = [
  `sb-${SUPABASE_REF}-auth-token`,
  "sb-127-auth-token",
  "supabase.auth.token",
];
const PROJECT_ID = "credit-v2-foundation-outline";
const NOW = "2026-06-19T12:00:00.000Z";

function ok(data: unknown) {
  return {
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, data }),
  };
}

function failure(
  status: number,
  code: string,
  message: string,
) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify({ ok: false, error: { code, message } }),
  };
}

async function injectApiModeSession(page: Page) {
  await page.addInitScript(() => {
    (window as Window & { __MOCK_OVERRIDE__?: string }).__MOCK_OVERRIDE__ =
      "false";
  });
  await page.goto("/login");
  await page.evaluate(
    ({ keys, expiresAt }) => {
      const payload = JSON.stringify({
        access_token: "credit-v2-access-token",
        refresh_token: "credit-v2-refresh-token",
        expires_at: expiresAt,
        expires_in: 3600,
        token_type: "bearer",
        user: {
          id: "credit-v2-user",
          email: "credit-v2@example.test",
        },
      });
      for (const key of keys) {
        localStorage.setItem(key, payload);
      }
    },
    {
      keys: STORAGE_KEYS,
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    },
  );
}

function creditBalance(balance: number) {
  return {
    id: "credit-balance-1",
    userId: "credit-v2-user",
    balance,
    monthlyQuota: 100_000,
    monthlyUsed: 0,
    resetAt: null,
    source: "admin_grant",
    updatedAt: NOW,
  };
}

function foundationBundle() {
  return {
    foundation: {
      id: "foundation-1",
      projectId: PROJECT_ID,
      premise: "Laras menemukan surat lama yang mengubah sejarah keluarganya.",
      mainConflict: "Laras harus memilih antara kebenaran dan keselamatan adiknya.",
      readerPromise: "Misteri keluarga dengan payoff emosional.",
      tone: "Emosional",
      genre: "Drama",
      targetReader: "hp_serial",
      storySecretsPreview: "Satu surat lama belum dibuka sepenuhnya.",
      styleTags: ["Drama keluarga", "Misteri"],
      readinessPercent: 82,
      readinessStatus: "siap_dimatangkan",
      status: "draft",
      isLocked: false,
      lockedAt: null,
      createdAt: NOW,
      updatedAt: NOW,
    },
    characters: [],
    facts: [],
  };
}

function proposal() {
  return {
    id: "proposal-1",
    projectId: PROJECT_ID,
    proposalType: "foundation",
    status: "proposed",
    riskLevel: "low",
    source: "ai_foundation",
    title: "Fondasi: Surat yang Hilang",
    payload: { reason: "Memperjelas konflik keluarga." },
    reviewNote: null,
    reviewedAt: null,
    reviewedBy: null,
    mergedIntoId: null,
    resultFactId: null,
    resultCharacterId: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function readiness() {
  return {
    readinessScore: 82,
    readinessLevel: "siap_dimatangkan",
    canLock: false,
    canRefine: true,
    checks: [],
    missing: ["Satu fakta canon"],
  };
}

function generatedOutlineBundle() {
  const chapters = Array.from({ length: 10 }, (_, index) => {
    const chapterNumber = index + 1;
    return {
      id: `chapter-${chapterNumber}`,
      projectId: PROJECT_ID,
      outlinePlanId: "outline-plan-1",
      chapterNumber,
      title: `Jejak Surat ${chapterNumber}`,
      summary: `Laras menelusuri petunjuk ke-${chapterNumber}.`,
      purpose: "Menaikkan tekanan keluarga.",
      chapterFunction: chapterNumber === 10 ? "payoff" : "escalation",
      emotionalDirection: chapterNumber === 10 ? "satisfying" : "tense",
      hook: `Petunjuk ${chapterNumber} muncul.`,
      endingHook: `Sebuah rahasia baru menunggu di bab ${chapterNumber + 1}.`,
      miniVictory:
        chapterNumber % 3 === 0 ? "Satu bukti berhasil diamankan." : null,
      povCharacterId: null,
      miniArcId: null,
      status: "planned",
      markers: [{ type: "hook", label: "Hook" }],
      metadata: {},
      createdAt: NOW,
      updatedAt: NOW,
    };
  });

  return {
    outlinePlan: {
      id: "outline-plan-1",
      projectId: PROJECT_ID,
      status: "generated",
      seasonLabel: "Musim Surat yang Hilang",
      arcSummary: "Laras membongkar sejarah keluarganya.",
      retentionSummary: "Sepuluh bab dengan hook beruntun.",
      targetChapterCount: 10,
      planningNotes: "Rencana awal untuk ditinjau.",
      metadata: {},
      lockedAt: null,
      createdAt: NOW,
      updatedAt: NOW,
    },
    miniArcs: [],
    chapterOutlines: chapters,
    openLoops: [],
    plannedReveals: [],
    planningTruthRedacted: true,
  };
}

async function installApiMocks(
  page: Page,
  options: { failFoundation?: boolean } = {},
) {
  let balance = 10_000;
  let foundationGenerated = false;
  let outlineGenerated = false;

  await page.route("**/api/**", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (path === "/api/projects") {
      await route.fulfill(
        ok([
          {
            id: PROJECT_ID,
            title: "Credit v2 Closure",
            genre: "Drama",
            status: "in_progress",
            currentChapter: 0,
            isActive: true,
            workflowPhase: "foundation",
            lastEditedAt: NOW,
            createdAt: NOW,
            updatedAt: NOW,
          },
        ]),
      );
      return;
    }

    if (path === "/api/me/profile") {
      await route.fulfill(
        ok({
          profile: {
            displayName: "Credit v2 Tester",
            email: "credit-v2@example.test",
            planLabel: "Beta",
          },
        }),
      );
      return;
    }

    if (path === "/api/credits/balance") {
      await route.fulfill(ok({ creditBalance: creditBalance(balance) }));
      return;
    }

    if (path === "/api/credits/estimate") {
      const feature = url.searchParams.get("feature");
      const creditCost =
        feature === "foundation_setup"
          ? 2_000
          : feature === "outline_10_chapters"
            ? 2_500
            : 0;
      await route.fulfill(
        ok({
          feature,
          qualityMode: null,
          creditCost,
          creditPricingVersion: "v2",
        }),
      );
      return;
    }

    if (path === `/api/projects/${PROJECT_ID}/foundation`) {
      await route.fulfill(ok(foundationBundle()));
      return;
    }

    if (path === `/api/projects/${PROJECT_ID}/foundation/proposals`) {
      await route.fulfill(
        ok({ proposals: foundationGenerated ? [proposal()] : [] }),
      );
      return;
    }

    if (path === `/api/projects/${PROJECT_ID}/foundation/readiness`) {
      await route.fulfill(ok(readiness()));
      return;
    }

    if (
      path === `/api/projects/${PROJECT_ID}/foundation/proposals/generate` &&
      method === "POST"
    ) {
      if (options.failFoundation) {
        await route.fulfill(
          failure(502, "AI_PROVIDER_ERROR", "Provider gagal sementara"),
        );
        return;
      }
      foundationGenerated = true;
      balance -= 2_000;
      await route.fulfill({
        ...ok({
          proposals: [proposal()],
          created: true,
          batchId: "foundation-batch-1",
          creditCost: 2_000,
          creditBalance: creditBalance(balance),
          idempotentReplay: false,
        }),
        status: 201,
      });
      return;
    }

    if (path === `/api/projects/${PROJECT_ID}/settings`) {
      await route.fulfill(
        ok({
          qualityMode: "seimbang",
          qualityTier: "seimbang",
          defaultOutputStyle: "warm_emotional",
          defaultFormat: "hp_kbm",
          creatorMode: "simple",
        }),
      );
      return;
    }

    if (path === `/api/projects/${PROJECT_ID}/timeline`) {
      await route.fulfill(ok({ events: [] }));
      return;
    }

    if (
      path === `/api/projects/${PROJECT_ID}/outline/generate` &&
      method === "POST"
    ) {
      outlineGenerated = true;
      balance -= 2_500;
      await route.fulfill({
        ...ok({
          ...generatedOutlineBundle(),
          created: true,
          regenerated: false,
          creditCost: 2_500,
          creditBalance: creditBalance(balance),
          idempotentReplay: false,
        }),
        status: 201,
      });
      return;
    }

    if (path === `/api/projects/${PROJECT_ID}/outline`) {
      await route.fulfill(
        ok(
          outlineGenerated
            ? generatedOutlineBundle()
            : {
                outlinePlan: null,
                miniArcs: [],
                chapterOutlines: [],
                openLoops: [],
                plannedReveals: [],
                planningTruthRedacted: true,
              },
        ),
      );
      return;
    }

    if (path === "/api/health") {
      await route.fulfill(
        ok({
          env: {
            creditTopupEnabled: false,
            paymentProviderMock: true,
            aiGenerationEnabled: true,
          },
        }),
      );
      return;
    }

    await route.fulfill(failure(404, "NOT_FOUND", `Unhandled mock: ${path}`));
  });
}

test("foundation and outline show server estimates and post-success balances", async ({
  page,
}) => {
  await installApiMocks(page);
  await injectApiModeSession(page);

  await page.goto(`/projects/${PROJECT_ID}/foundation`);
  await expect(page.getByText("Memuat fondasi cerita...")).toBeHidden();
  await expect(page.getByText("Biaya: 2.000 kredit")).toBeVisible();
  await expect(page.getByLabel(/Mode kualitas/i)).toHaveCount(0);

  await page.getByRole("button", { name: "Buat Usulan Fondasi" }).click();
  await expect(
    page.getByText(
      "Usulan fondasi berhasil dibuat. 2.000 kredit digunakan. Sisa kredit: 8.000.",
    ),
  ).toBeVisible();

  await page.goto(`/projects/${PROJECT_ID}/outline`);
  await expect(page.getByText("Memuat outline cerita...")).toBeHidden();
  await expect(page.getByText("Biaya: 2.500 kredit")).toBeVisible();
  await expect(page.getByLabel(/Mode kualitas/i)).toHaveCount(0);

  await page.getByRole("button", { name: "Buat Rencana 10 Bab" }).click();
  await expect(
    page.getByText(
      "Rencana 10 bab berhasil dibuat. 2.500 kredit digunakan. Sisa kredit: 5.500.",
    ),
  ).toBeVisible();
});

test("provider failure explains that credits are unused or refunded", async ({
  page,
}) => {
  await installApiMocks(page, { failFoundation: true });
  await injectApiModeSession(page);

  await page.goto(`/projects/${PROJECT_ID}/foundation`);
  await expect(page.getByText("Biaya: 2.000 kredit")).toBeVisible();
  await page.getByRole("button", { name: "Buat Usulan Fondasi" }).click();

  await expect(
    page.getByText(/Kredit tidak terpakai atau sudah dikembalikan otomatis\./),
  ).toBeVisible();
});
