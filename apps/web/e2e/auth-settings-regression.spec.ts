import { expect, test, type Page } from "@playwright/test";

const SUPABASE_REF = process.env.SMOKE_SUPABASE_REF?.trim() || "jdxyhrnibmmwlbtbokqo";
const STORAGE_KEY = `sb-${SUPABASE_REF}-auth-token`;

const sessionUser = {
  id: "user-auth-regression",
  aud: "authenticated",
  role: "authenticated",
  email: "writer@example.com",
};

async function forceApiMode(page: Page) {
  await page.addInitScript(() => {
    (window as any).__MOCK_OVERRIDE__ = "false";
  });
}

async function injectSession(page: Page, accessToken: string, refreshToken = "refresh-token-ok") {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  await page.goto("/login");
  await page.evaluate(
    ({ key, token, refresh, exp, user }) => {
      localStorage.setItem(
        key,
        JSON.stringify({
          access_token: token,
          refresh_token: refresh,
          expires_at: exp,
          expires_in: 3600,
          token_type: "bearer",
          user,
        }),
      );
    },
    { key: STORAGE_KEY, token: accessToken, refresh: refreshToken, exp: expiresAt, user: sessionUser },
  );
}

test.describe("auth and settings regressions", () => {
  test("blocks dashboard access when signed out in API mode", async ({ page }) => {
    await forceApiMode(page);

    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText("Halo, Penulis!")).toHaveCount(0);
  });

  test("refreshes a stale access token and retries the failed API request once", async ({ page }) => {
    await forceApiMode(page);
    await injectSession(page, "stale-access-token");

    let staleProjectCalls = 0;
    let freshProjectCalls = 0;
    await page.route("**/auth/v1/token?grant_type=refresh_token*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          access_token: "fresh-access-token",
          refresh_token: "fresh-refresh-token",
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          token_type: "bearer",
          user: sessionUser,
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
              id: "credit-regression",
              userId: sessionUser.id,
              balance: 4993,
              monthlyQuota: 1000,
              monthlyUsed: 0,
              resetAt: null,
              source: "test",
              updatedAt: new Date().toISOString(),
            },
          },
        }),
      });
    });

    await page.route("**/api/projects*", async (route) => {
      const auth = route.request().headers().authorization;
      if (auth === "Bearer stale-access-token") {
        staleProjectCalls += 1;
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({
            ok: false,
            error: { code: "UNAUTHORIZED", message: "Invalid or expired access token" },
          }),
        });
        return;
      }

      expect(auth).toBe("Bearer fresh-access-token");
      freshProjectCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: [
            {
              id: "project-token-retry",
              title: "Token Retry Project",
              entryPath: "no_idea",
              workflowPhase: "outline_locked",
              status: "in_progress",
              currentChapter: 1,
              genre: "Drama",
              isActive: true,
              lastEditedAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        }),
      });
    });

    await page.goto("/dashboard");

    await expect(page.getByRole("heading", { name: "Token Retry Project" })).toBeVisible();
    await expect(page.getByText(/API tidak tersedia/i)).toHaveCount(0);
    expect(staleProjectCalls).toBeGreaterThanOrEqual(1);
    expect(freshProjectCalls).toBeGreaterThanOrEqual(1);
  });

  test("persists locally saved quality mode and shows numeric action cost estimates", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      (window as any).__MOCK_OVERRIDE__ = "true";
    });

    await page.goto("/settings");
    await page.locator('input[name="quality_mode"][value="terbaik"]').check();
    await page.getByRole("button", { name: "Simpan Perubahan" }).click();
    await page.reload();

    await expect(page.locator('input[name="quality_mode"][value="terbaik"]')).toBeChecked();
    await expect(page.getByText("Tulis Beat dengan AI: 20 kredit")).toBeVisible();
    await expect(page.getByText("Rewrite teks: 12 kredit")).toBeVisible();
    await expect(page.getByText("Publish copy: 12 kredit")).toBeVisible();
    await expect(page.getByText(/Memuat pemakaian kuota/i)).toHaveCount(0);
  });
});
