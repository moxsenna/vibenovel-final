import { expect, test } from "@playwright/test";

const SUPABASE_REF = process.env.SMOKE_SUPABASE_REF?.trim() || "jdxyhrnibmmwlbtbokqo";
const STORAGE_KEY = `sb-${SUPABASE_REF}-auth-token`;

async function injectFakeSession(page: any) {
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
}

test.describe("Sprint 10b — Intake Assistant and Concept Generator Pipeline", () => {
  // --- MOCK MODE TEST SUITE ---
  test.describe("Mock-mode", () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      // Force mock override true to ensure client uses local mocks or we mock routes
      await page.addInitScript(() => {
        (window as any).__MOCK_OVERRIDE__ = "false";
      });

      // Intercept profile and credit indicator API calls
      await page.route("**/api/me/profile", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            data: {
              profile: {
                displayName: "Penulis Mock",
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
                balance: 100,
                monthlyUsed: 0,
                monthlyQuota: 100,
                resetAt: null,
              },
            },
          }),
        });
      });

      // Mock creation and list projects
      let projectWorkflowPhase = "intake";
      let conceptsGenerated = false;
      let selectedConceptId = null as string | null;

      await page.route(/\/api\/projects(\?|$)/, async (route) => {
        if (route.request().method() === "POST") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              ok: true,
              data: {
                id: "test-project-123",
                title: "Cerita Baru",
                entryPath: "no_idea",
                workflowPhase: projectWorkflowPhase,
                status: "in_progress",
                currentChapter: 0,
                isActive: true,
                lastEditedAt: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              ok: true,
              data: [
                {
                  id: "test-project-123",
                  title: "Cerita Baru",
                  entryPath: "no_idea",
                  workflowPhase: projectWorkflowPhase,
                  status: "in_progress",
                  currentChapter: 0,
                  isActive: true,
                  lastEditedAt: new Date().toISOString(),
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
              ],
            }),
          });
        }
      });

      await page.route("**/api/projects/test-project-123", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            data: {
              id: "test-project-123",
              title: "Cerita Baru",
              entryPath: "no_idea",
              workflowPhase: projectWorkflowPhase,
              status: "in_progress",
              currentChapter: 0,
              isActive: true,
              lastEditedAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          }),
        });
      });

      // Mock messages list and append
      const messages = [
        {
          id: "msg-1",
          projectId: "test-project-123",
          sessionId: "session-123",
          role: "agent",
          content: "Halo! Ceritakan ide ceritamu di sini.",
          metadata: {},
          createdAt: new Date().toISOString(),
        },
      ];

      await page.route("**/api/projects/test-project-123/intake", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            data: {
              session: {
                id: "session-123",
                projectId: "test-project-123",
                status: "active",
                phase: "idea_collection",
                progressPercent: 14,
                summary: null,
                metadata: {},
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
              messages,
              signals: [],
            },
          }),
        });
      });

      await page.route("**/api/projects/test-project-123/intake/messages*", async (route) => {
        if (route.request().method() === "POST") {
          const body = JSON.parse(route.request().postData() || "{}");
          const userMsg = {
            id: `msg-user-${Date.now()}`,
            projectId: "test-project-123",
            sessionId: "session-123",
            role: "user",
            content: body.content,
            metadata: {},
            createdAt: new Date().toISOString(),
          };
          const agentMsg = {
            id: `msg-agent-${Date.now()}`,
            projectId: "test-project-123",
            sessionId: "session-123",
            role: "agent",
            content: "Aku menangkap nuansa cerita drama rumah tangga. Bagaimana dengan kelanjutan tokohnya?",
            metadata: {},
            createdAt: new Date().toISOString(),
          };
          messages.push(userMsg);
          messages.push(agentMsg);

          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              ok: true,
              data: {
                userMessage: userMsg,
                agentMessage: agentMsg,
                session: {
                  id: "session-123",
                  projectId: "test-project-123",
                  status: "active",
                  phase: "signal_detection",
                  progressPercent: 28,
                  summary: null,
                  metadata: {},
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
              },
            }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              ok: true,
              data: {
                sessionId: "session-123",
                messages,
              },
            }),
          });
        }
      });

      // Mock signals endpoint
      await page.route("**/api/projects/test-project-123/intake/signals*", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            data: {
              sessionId: "session-123",
              signals: [
                {
                  id: "sig-1",
                  projectId: "test-project-123",
                  sessionId: "session-123",
                  type: "genre",
                  label: "Drama Rumah Tangga",
                  value: "drama rumah tangga",
                  confidence: 0.9,
                  status: "detected",
                  sourceMessageId: "msg-user-1",
                  metadata: {},
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
              ],
            },
          }),
        });
      });

      // Mock extract-signals endpoint
      await page.route("**/api/projects/test-project-123/intake/extract-signals*", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            data: {
              sessionId: "session-123",
              signals: [
                {
                  id: "sig-1",
                  projectId: "test-project-123",
                  sessionId: "session-123",
                  type: "genre",
                  label: "Drama Rumah Tangga",
                  value: "drama rumah tangga",
                  confidence: 0.9,
                  status: "detected",
                  sourceMessageId: "msg-user-1",
                  metadata: {},
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
              ],
            },
          }),
        });
      });

      // Mock concepts endpoint
      await page.route("**/api/projects/test-project-123/concepts/generate", async (route) => {
        conceptsGenerated = true;
        projectWorkflowPhase = "concepts";
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            data: {
              concepts: [
                {
                  id: "concept-1",
                  projectId: "test-project-123",
                  title: "Luka yang Dibayar Mahal",
                  shortPitch: "Seorang perempuan menghadapi tekanan keluarga...",
                  readerPromise: "Perjalanan menemukan suara...",
                  coreConflict: "Keluarga vs keadilan...",
                  genre: "Drama Rumah Tangga",
                  tone: "Emosional",
                  targetReader: "hp_serial",
                  status: "proposed",
                  source: "stub",
                  score: 85,
                  payload: {
                    badgeLabel: "Drama / Emosional",
                    badgeIcon: "favorite",
                  },
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
              ],
              created: true,
            },
          }),
        });
      });

      await page.route("**/api/projects/test-project-123/concepts", async (route) => {
        if (!conceptsGenerated) {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ ok: true, data: [] }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              ok: true,
              data: [
                {
                  id: "concept-1",
                  projectId: "test-project-123",
                  title: "Luka yang Dibayar Mahal",
                  shortPitch: "Seorang perempuan menghadapi tekanan keluarga...",
                  readerPromise: "Perjalanan menemukan suara...",
                  coreConflict: "Keluarga vs keadilan...",
                  genre: "Drama Rumah Tangga",
                  tone: "Emosional",
                  targetReader: "hp_serial",
                  status: selectedConceptId === "concept-1" ? "selected" : "proposed",
                  source: "stub",
                  score: 85,
                  payload: {
                    badgeLabel: "Drama / Emosional",
                    badgeIcon: "favorite",
                  },
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
              ],
            }),
          });
        }
      });

      await page.route("**/api/projects/test-project-123/concepts/concept-1/select", async (route) => {
        selectedConceptId = "concept-1";
        projectWorkflowPhase = "foundation";
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            data: {
              concept: {
                id: "concept-1",
                projectId: "test-project-123",
                status: "selected",
              },
              project: {
                id: "test-project-123",
                selectedConceptId: "concept-1",
                workflowPhase: "foundation",
              },
            },
          }),
        });
      });

      await page.route("**/api/projects/test-project-123/foundation", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            data: {
              foundation: {
                id: "f-1",
                projectId: "test-project-123",
                premise: "Luka yang Dibayar Mahal",
                mainConflict: "Keluarga vs keadilan...",
                readerPromise: "Perjalanan menemukan suara...",
                storySecretsPreview: "",
                styleTags: [],
                readinessPercent: 40,
                readinessStatus: "belum_siap",
                isLocked: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
              characters: [],
              facts: [],
            },
          }),
        });
      });
    });

    test("runs end-to-end project intake chat and concept selection", async ({ page }) => {
      page.on("console", (msg) => {
        console.log(`BROWSER LOG: [${msg.type()}] ${msg.text()}`);
      });
      page.on("pageerror", (err) => {
        console.error(`BROWSER ERROR: ${err.message}`);
      });
      page.on("response", (response) => {
        if (response.status() >= 400) {
          console.log(`BROWSER RESPONSE ERROR: [${response.status()}] ${response.url()}`);
        }
      });

      // 1. Login
      await page.goto("/login");
      await injectFakeSession(page);
      await page.goto("/dashboard");
      await page.waitForURL(/\/dashboard/);

      // 2. Start Project
      await page.goto("/start");
      try {
        await expect(page.getByRole("heading", { name: "Kamu mulai dari mana?" })).toBeVisible();
      } catch (err) {
        console.log("DEBUG: Current page URL is:", page.url());
        console.log("DEBUG: Current page HTML is:\n", await page.content());
        throw err;
      }

      const startBtn = page.getByRole("button", { name: "Mulai dari nol" });
      await expect(startBtn).toBeVisible();
      await startBtn.click();

      // Should redirect to intake page
      await page.waitForURL(/\/projects\/test-project-123\/intake/);
      await expect(page.getByRole("heading", { name: "Ceritakan Ide Anda" })).toBeVisible();

      // 3. Send message
      const input = page.locator("textarea");
      await expect(input).toBeVisible();
      await input.fill("Drama rumah tangga tentang istri diremehkan keluarga suami.");

      const sendBtn = page.locator('[aria-label="Kirim"]');
      await sendBtn.click();

      // Assert user and agent messages appear
      await expect(page.locator("span").filter({ hasText: "Drama rumah tangga tentang istri diremehkan keluarga suami." }).first()).toBeVisible();
      await expect(page.locator("span").filter({ hasText: "Aku menangkap nuansa cerita drama rumah tangga." }).first()).toBeVisible();

      // 4. Move to Concepts Page
      const toConceptsLink = page.getByRole("link", { name: "Lanjut ke Konsep" });
      await expect(toConceptsLink).toBeVisible();
      await toConceptsLink.click();

      await page.waitForURL(/\/projects\/test-project-123\/concepts/);
      await expect(page.getByRole("heading", { name: "Pilih Arah Ceritamu" })).toBeVisible();

      // Generate concepts
      const genBtn = page.getByRole("button", { name: "Buat 3 Konsep Cerita" });
      await expect(genBtn).toBeVisible();
      await genBtn.click();

      // Check concept cards
      const conceptCard = page.getByRole("heading", { name: "Luka yang Dibayar Mahal" });
      await expect(conceptCard).toBeVisible();

      // Select concept
      const selectBtn = page.getByRole("button", { name: "Pilih Konsep Ini" });
      await expect(selectBtn).toBeVisible();
      await selectBtn.click();

      // Should transition to foundation
      await page.waitForURL(/\/projects\/test-project-123\/foundation/);
      await expect(page.getByRole("heading", { name: "Fondasi Cerita" })).toBeVisible();
    });
  });

  // --- REAL AI-MODE CONTRACT TEST ---
  test.describe("AI-mode contract (OpenRouter)", () => {
    // Helper to determine if we are running against real API and expected to test AI
    test("verifies real OpenRouter response and output specificity", async ({ page }) => {
      // Find what base URL/API URL is in use
      const webUrl = page.viewportSize() ? page.url() : "";
      
      // Hit health check to query backend capabilities
      let healthRes;
      try {
        const apiBase = process.env.VITE_API_URL?.trim() || "http://127.0.0.1:8787";
        healthRes = await page.request.get(`${apiBase}/api/health`);
      } catch (err) {
        healthRes = await page.request.get("/api/health");
      }

      const health = await healthRes.json();
      const aiEnabled = health?.data?.env?.aiGenerationEnabled;
      const providerMock = health?.data?.env?.aiProviderMock;

      const requireRealAi =
        process.env.TEST_REAL_AI === "true" ||
        process.env.SMOKE_AI_ENABLED === "true" ||
        (health?.data?.env?.appEnv === "production" && !providerMock);

      if (!requireRealAi) {
        test.skip(
          !aiEnabled || providerMock,
          "Skipping real AI contract test because AI is mocked/disabled and TEST_REAL_AI/SMOKE_AI_ENABLED is not set."
        );
      } else {
        if (!aiEnabled || providerMock) {
          throw new Error(
            `BLOCKED: AI-mode contract test expected real OpenRouter to be active, but health check says: aiGenerationEnabled=${aiEnabled}, aiProviderMock=${providerMock}. Check your OPENROUTER_API_KEY and backend env.`
          );
        }
      }

      // If we are here, we are testing the REAL AI pipeline!
      // Let's create two different projects and verify the AI returns distinct, non-mock concepts.
      
      // Log in a real user or use founder credentials
      const testEmail = process.env.SMOKE_TEST_EMAIL?.trim() || `test-real-ai-${Date.now()}@example.com`;
      const testPassword = process.env.SMOKE_TEST_PASSWORD?.trim() || "VibeNovel-Real-123!";

      // Sign up or log in
      await page.goto("/login");
      
      // Inject session if env vars are present (like on production/founder smoke tests)
      const token = process.env.SMOKE_ACCESS_TOKEN?.trim();
      const refresh = process.env.SMOKE_REFRESH_TOKEN?.trim();
      const userJson = process.env.SMOKE_USER_JSON?.trim();
      
      if (token && refresh && userJson) {
        const expiresAt = Math.floor(Date.now() / 1000) + 3600;
        await page.evaluate(
          ({ key, accessToken, refreshToken, expiresAt: exp, user }) => {
            const payload = {
              access_token: accessToken,
              refresh_token: refreshToken,
              expires_at: exp,
              expires_in: 3600,
              token_type: "bearer",
              user: JSON.parse(user),
            };
            localStorage.setItem(key, JSON.stringify(payload));
          },
          {
            key: STORAGE_KEY,
            accessToken: token,
            refreshToken: refresh,
            expiresAt,
            user: userJson,
          }
        );
        await page.goto("/dashboard");
      } else {
        // Sign up a new user on local backend
        await page.getByRole("button", { name: "Daftar" }).click();
        await page.getByPlaceholder("email").fill(testEmail);
        await page.getByPlaceholder("password").fill(testPassword);
        await page.getByRole("button", { name: "Buat akun" }).click();
        
        // Wait for sign in redirection switch
        await page.waitForTimeout(1000);
        await page.getByPlaceholder("email").fill(testEmail);
        await page.getByPlaceholder("password").fill(testPassword);
        await page.getByRole("button", { name: "Masuk" }).click();
      }

      await page.waitForURL(/\/dashboard/, { timeout: 30000 });

      // Run Project A: Drama Rumah Tangga
      const projectAId = await createAndRunIntake(
        page,
        "Project A Drama",
        "Drama rumah tangga tentang istri diremehkan keluarga suami."
      );

      // Run Project B: Fantasy Academy
      const projectBId = await createAndRunIntake(
        page,
        "Project B Fantasy",
        "Fantasy academy tentang murid miskin dengan kekuatan tersembunyi."
      );

      // Verify Project A concepts
      const conceptsA = await getConceptsForProject(page, projectAId);
      // Verify Project B concepts
      const conceptsB = await getConceptsForProject(page, projectBId);

      // Check outputs are distinct
      console.log("Concepts A:", conceptsA);
      console.log("Concepts B:", conceptsB);

      expect(conceptsA.length).toBe(3);
      expect(conceptsB.length).toBe(3);

      // Output must not equal the deterministic mock template values
      const forbiddenTitles = ["Luka yang Dibayar Mahal", "Setelah Aku Pergi", "Istri yang Mereka Remehkan"];
      for (const title of conceptsA) {
        expect(forbiddenTitles).not.toContain(title);
      }
      for (const title of conceptsB) {
        expect(forbiddenTitles).not.toContain(title);
      }

      // Ensure they don't contain Nadira, Arman, Siska
      const forbiddenNames = [/Nadira/i, /Arman/i, /Siska/i];
      for (const title of [...conceptsA, ...conceptsB]) {
        for (const namePat of forbiddenNames) {
          expect(title).not.toMatch(namePat);
        }
      }

      // Assert Project A and Project B concepts are different from each other
      const intersection = conceptsA.filter(x => conceptsB.includes(x));
      expect(intersection.length).toBeLessThan(3); // Must be meaningfully different

      // Select concept for Project A to verify transition
      await page.goto(`/projects/${projectAId}/concepts`);
      await page.getByRole("button", { name: "Pilih Konsep Ini" }).first().click();
      await page.waitForURL(/\/projects\/.*\/foundation/);
      expect(page.url()).toContain(projectAId);
    });
  });
});

async function createAndRunIntake(page: any, title: string, description: string): Promise<string> {
  await page.goto("/start");
  await page.getByRole("button", { name: "Mulai dari nol" }).click();
  await page.waitForURL(/\/projects\/.*\/intake/);
  
  const url = page.url();
  const projectId = url.split("/projects/")[1].split("/intake")[0];

  // Send description in intake chat
  const input = page.locator("textarea");
  await input.fill(description);
  await page.locator('[aria-label="Kirim"]').click();

  // Wait for agent reply
  await expect(page.locator("div.chat-bubble-agent").first()).toBeVisible({ timeout: 45000 });
  
  // Verify conversational response
  const lastBubbleText = await page.locator("div.chat-bubble-agent").last().innerText();
  expect(lastBubbleText.length).toBeGreaterThan(10);
  
  // Clean up/wait
  await page.waitForTimeout(2000);
  return projectId;
}

async function getConceptsForProject(page: any, projectId: string): Promise<string[]> {
  await page.goto(`/projects/${projectId}/concepts`);
  
  const generateBtn = page.getByRole("button", { name: "Buat 3 Konsep Cerita" });
  if (await generateBtn.isVisible()) {
    await generateBtn.click();
    await page.waitForTimeout(5000); // Wait for generation
  }

  // Locate the titles of the 3 concept cards
  const titlesLocator = page.locator("h3.text-on-surface");
  await expect(titlesLocator.first()).toBeVisible({ timeout: 60000 });
  
  const count = await titlesLocator.count();
  const titles: string[] = [];
  for (let i = 0; i < count; i++) {
    const text = await titlesLocator.nth(i).innerText();
    titles.push(text.trim());
  }
  return titles;
}
