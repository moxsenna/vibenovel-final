import { expect, test } from "@playwright/test";

const SUPABASE_REF = process.env.SMOKE_SUPABASE_REF?.trim() || "jdxyhrnibmmwlbtbokqo";
const STORAGE_KEY = `sb-${SUPABASE_REF}-auth-token`;

test.describe("Sprint 10a Regression — Mock Boundary, Credits, and Routing", () => {
  test.beforeEach(async ({ page }) => {
    // Force API mode in the browser via window override
    await page.addInitScript(() => {
      (window as any).__MOCK_OVERRIDE__ = "false";
    });

    // Intercept profile and credits APIs
    await page.route("**/api/me/profile", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: {
            profile: {
              displayName: "Test Penulis",
              email: "test@narraza.web.id",
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
              balance: 45,
              monthlyUsed: 5,
              monthlyQuota: 50,
              resetAt: "2026-07-10T18:30:43Z",
            },
          },
        }),
      });
    });
  });

  test("credit indicator displays 45 kredit and not hardcoded 1.250", async ({ page }) => {
    // Mock active project intake
    await page.route("**/api/projects*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: [
            {
              id: "project-intake-123",
              title: "Proyek Pertama",
              genre: "Drama",
              status: "in_progress",
              currentChapter: 0,
              isActive: true,
              workflowPhase: "intake",
              lastEditedAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        }),
      });
    });

    // Login and load dashboard
    await page.goto("/login");
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    await page.evaluate(
      ({ key, exp }) => {
        const payload = {
          access_token: "fake-access-token",
          refresh_token: "fake-refresh-token",
          expires_at: exp,
          expires_in: 3600,
          token_type: "bearer",
          user: { id: "fake-user-id", email: "test@narraza.web.id" },
        };
        localStorage.setItem(key, JSON.stringify(payload));
      },
      { key: STORAGE_KEY, exp: expiresAt }
    );

    await page.goto("/dashboard");
    await page.waitForURL(/\/dashboard/);

    // Verify credits indicator displays the intercepted 45 credits
    const creditBadge = page.locator("[aria-label='45 kredit tersisa']");
    await expect(creditBadge).toBeVisible();
    await expect(creditBadge).toContainText("45");
    await expect(creditBadge).toContainText("kredit");

    // Ensure no hardcoded 1.250 exists in the DOM
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toMatch(/1\.250/);
    expect(bodyText).not.toMatch(/1250/);
  });

  test("dashboard ActiveProjectCard routing for intake phase", async ({ page }) => {
    // Mock active project in intake phase
    await page.route("**/api/projects*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: [
            {
              id: "project-intake-123",
              title: "Proyek Pertama",
              genre: "Drama",
              status: "in_progress",
              currentChapter: 0,
              isActive: true,
              workflowPhase: "intake",
              lastEditedAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        }),
      });
    });

    // Login and load dashboard
    await page.goto("/login");
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    await page.evaluate(
      ({ key, exp }) => {
        const payload = {
          access_token: "fake-access-token",
          refresh_token: "fake-refresh-token",
          expires_at: exp,
          expires_in: 3600,
          token_type: "bearer",
          user: { id: "fake-user-id", email: "test@narraza.web.id" },
        };
        localStorage.setItem(key, JSON.stringify(payload));
      },
      { key: STORAGE_KEY, exp: expiresAt }
    );

    await page.goto("/dashboard");
    await page.waitForURL(/\/dashboard/);

    // Verify CTA points to intake route and has correct label
    const ctaButton = page.getByRole("link", { name: "Lanjutkan Obrolan Intake" });
    await expect(ctaButton).toBeVisible();
    await expect(ctaButton).toHaveAttribute("href", "/projects/project-intake-123/intake");
  });

  test("dashboard ActiveProjectCard routing for outline_locked phase", async ({ page }) => {
    // Mock active project in outline_locked phase
    await page.route("**/api/projects*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: [
            {
              id: "project-outline-locked-456",
              title: "Outline Terkunci",
              genre: "Romansa",
              status: "in_progress",
              currentChapter: 1,
              isActive: true,
              workflowPhase: "outline_locked",
              lastEditedAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        }),
      });
    });

    // Login and load dashboard
    await page.goto("/login");
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    await page.evaluate(
      ({ key, exp }) => {
        const payload = {
          access_token: "fake-access-token",
          refresh_token: "fake-refresh-token",
          expires_at: exp,
          expires_in: 3600,
          token_type: "bearer",
          user: { id: "fake-user-id", email: "test@narraza.web.id" },
        };
        localStorage.setItem(key, JSON.stringify(payload));
      },
      { key: STORAGE_KEY, exp: expiresAt }
    );

    await page.goto("/dashboard");
    await page.waitForURL(/\/dashboard/);

    // Verify CTA points to write route and has correct label
    const ctaButton = page.getByRole("link", { name: "Lanjut Tulis Bab 1" });
    await expect(ctaButton).toBeVisible();
    await expect(ctaButton).toHaveAttribute("href", "/projects/project-outline-locked-456/write");
  });

  test("production/mock boundary prevents rendering Nadira, Arman, Siska mock names", async ({ page }) => {
    // Intercept projects list to return empty list (no projects)
    await page.route("**/api/projects*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: [],
        }),
      });
    });

    // Login and load dashboard
    await page.goto("/login");
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    await page.evaluate(
      ({ key, exp }) => {
        const payload = {
          access_token: "fake-access-token",
          refresh_token: "fake-refresh-token",
          expires_at: exp,
          expires_in: 3600,
          token_type: "bearer",
          user: { id: "fake-user-id", email: "test@narraza.web.id" },
        };
        localStorage.setItem(key, JSON.stringify(payload));
      },
      { key: STORAGE_KEY, exp: expiresAt }
    );

    await page.goto("/dashboard");
    await page.waitForURL(/\/dashboard/);

    // Verify the page doesn't contain any occurrences of Sprint 1 mock names
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toMatch(/Nadira/);
    expect(bodyText).not.toMatch(/Arman/);
    expect(bodyText).not.toMatch(/Siska/);
  });
});
