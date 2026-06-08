import { expect, test } from "@playwright/test";

/**
 * Sprint 9 credit UI — complements sprint8-write-ai-flow.spec.ts.
 * Run via: npm run smoke:web:credit-ui
 */

test.describe("Sprint 9 web smoke — credit UI mock mode", () => {
  test("write page mock mode hides live credit card", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/projects/demo-project-001/write");
    await expect(page.getByRole("button", { name: /Tulis Beat dengan AI/i }).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/Saldo Kredit/i)).toHaveCount(0);
    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/estimated_cost_usd/i);
    expect(body).not.toMatch(/credit_ledger/i);
  });
});