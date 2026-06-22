import { expect, test } from "@playwright/test";

const DEMO_PROJECT_ID = "demo-project-001";

/**
 * Sprint 19 — Asisten Narra unified agent web smoke (mock mode).
 *
 * Covers the product rename + Foundation maturation entry points:
 * - sidebar active-project nav says "Asisten Narra" (not "Mulai Proyek"),
 * - the "Proyek Baru" creation button is untouched,
 * - the Foundation readiness card renders and may offer "Matangkan dengan Narra".
 */
test.describe("Sprint 19 Asisten Narra web smoke — mock mode", () => {
  test("sidebar uses Asisten Narra and keeps Proyek Baru, drops Mulai Proyek", async ({ page }) => {
    await page.goto(`/projects/${DEMO_PROJECT_ID}/foundation`);

    const nav = page.locator("nav[aria-label='Navigasi utama']");
    await expect(nav).toBeVisible();
    await expect(nav.getByText("Asisten Narra")).toBeVisible();
    await expect(nav.getByText("Proyek Baru")).toBeVisible();
    await expect(nav.getByText("Mulai Proyek", { exact: true })).toHaveCount(0);
  });

  test("foundation readiness card renders and may offer Narra maturation", async ({ page }) => {
    await page.goto(`/projects/${DEMO_PROJECT_ID}/foundation`);

    await expect(page.getByText("Kesiapan Fondasi")).toBeVisible();

    // The CTA only appears in the 75-84% refine band, so treat it as optional.
    const narraCta = page.getByRole("link", { name: /Matangkan dengan Narra/i });
    if (await narraCta.count()) {
      await expect(narraCta.first()).toBeVisible();
    }
  });
});

/**
 * API-mode flow — gated behind env, skipped by default. Mirrors the
 * sprint3 smoke convention.
 */
test.describe("Sprint 19 Asisten Narra web smoke — API mode", () => {
  const apiModeEnabled = process.env.SMOKE_WEB_API_MODE === "true";
  const projectId = process.env.SMOKE_PROJECT_ID?.trim() ?? "";

  test.skip(!apiModeEnabled, "API mode skipped — set SMOKE_WEB_API_MODE=true");
  test.skip(!projectId, "API mode skipped — missing SMOKE_PROJECT_ID");

  test("foundation CTA opens Narra chat in foundation mode", async ({ page }) => {
    await page.goto(`/projects/${projectId}/foundation`);
    await expect(page.getByText("Memuat fondasi cerita...")).toBeHidden({ timeout: 20_000 });

    const narraCta = page.getByRole("link", { name: /Matangkan dengan Narra/i });
    if (await narraCta.count()) {
      await narraCta.first().click();
      await expect(page).toHaveURL(/\/intake\?mode=foundation/, { timeout: 20_000 });
      await expect(page.getByText("Asisten Narra").first()).toBeVisible({ timeout: 20_000 });
    }
  });
});
