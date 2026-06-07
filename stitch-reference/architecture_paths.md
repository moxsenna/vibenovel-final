# ARCHITECTURE_PATHS.md

Status: Developer path map  
Purpose: Give AI coding agents exact file/folder responsibilities and future path conventions.

---

## 1. Current MVP Paths

```txt
apps/web/src/main.tsx
```

MVP UI scaffold. Should eventually be split into pages/components.

```txt
apps/web/src/lib/api.ts
```

Frontend API wrapper. Should handle auth token later.

```txt
apps/api/src/index.ts
```

Current Worker API entry. Contains MVP routes. Can be split later.

```txt
apps/api/src/lib/supabase.ts
```

Server-side Supabase client.

```txt
apps/api/src/ai/modelRouter.ts
```

Maps task/tier to backend model IDs.

```txt
apps/api/src/ai/openrouter.ts
```

Calls OpenRouter API.

```txt
apps/api/src/ai/prompts.ts
```

MVP prompt functions.

```txt
apps/api/src/ai/contextPacket.ts
```

Builds safe writer context.

```txt
apps/api/src/ai/validators.ts
```

Basic validator functions.

```txt
supabase/migrations/0001_initial_schema.sql
```

Initial database schema.

---

## 2. Future API Route Paths

When `index.ts` becomes too large, split into:

```txt
apps/api/src/routes/health.ts
apps/api/src/routes/projects.ts
apps/api/src/routes/storyBible.ts
apps/api/src/routes/outline.ts
apps/api/src/routes/beats.ts
apps/api/src/routes/prose.ts
apps/api/src/routes/chapters.ts
apps/api/src/routes/publish.ts
apps/api/src/routes/usage.ts
apps/api/src/routes/retention.ts
apps/api/src/routes/billing.ts
apps/api/src/routes/analytics.ts
```

Rule:
Do not split too early. Split when a route group becomes hard to maintain.

---

## 3. Future API Module Paths

```txt
apps/api/src/modules/story-state/
  facts.service.ts
  characters.service.ts
  reveals.service.ts
  knowledge.service.ts

apps/api/src/modules/planning/
  outline.service.ts
  beatContract.service.ts

apps/api/src/modules/context/
  contextPacket.service.ts
  revealGate.service.ts
  breadcrumbCompiler.service.ts

apps/api/src/modules/writing/
  beatWriter.service.ts
  proseVersion.service.ts

apps/api/src/modules/validation/
  instructionValidator.ts
  revealValidator.ts
  canonValidator.ts
  mobileValidator.ts

apps/api/src/modules/retention/
  retentionJudge.service.ts
  miniVictory.service.ts
  openLoop.service.ts

apps/api/src/modules/billing/
  creditLedger.service.ts
  paymentWebhook.service.ts

apps/api/src/modules/analytics/
  eventLogger.service.ts
```

---

## 4. Future AI Agent Paths

```txt
apps/api/src/ai/agents/
  storyIntakeAgent.ts
  storyBibleAgent.ts
  conceptOptionsAgent.ts
  outlinePlannerAgent.ts
  beatWriterAgent.ts
  basicValidatorAgent.ts
  repairAgent.ts
  chapterDeltaAgent.ts
  publishPackageAgent.ts
  revealGateAgent.ts
  retentionJudgeAgent.ts
  authorVoiceAgent.ts
  importDraftExtractorAgent.ts
```

Prompt templates should reference:

```txt
docs/AGENT_PROMPT_TEMPLATES.md
```

---

## 5. Future Web Paths

```txt
apps/web/src/pages/
  DashboardPage.tsx
  ProjectPage.tsx
  StoryIntakePage.tsx
  StoryBiblePage.tsx
  OutlinePage.tsx
  WriterPage.tsx
  PublishPage.tsx
  SettingsPage.tsx
```

```txt
apps/web/src/components/story/
  StoryBibleEditor.tsx
  CharacterCard.tsx
  FactList.tsx
  RevealSchedule.tsx
  ChapterOutline.tsx
```

```txt
apps/web/src/components/writer/
  BeatList.tsx
  BeatWriterPanel.tsx
  ProseEditor.tsx
  ModelTierSelector.tsx
  ValidationPanel.tsx
```

```txt
apps/web/src/components/retention/
  OpenLoopPanel.tsx
  MiniVictoryPanel.tsx
  UnlockabilityPanel.tsx
```

---

## 6. Future Supabase Migration Paths

```txt
supabase/migrations/
  0001_initial_schema.sql
  0002_rls_policies.sql
  0003_billing.sql
  0004_retention_tables.sql
  0005_import_export.sql
  0006_analytics_events.sql
```

Rule:
Never edit an old migration after it has been applied to production. Create a new migration.

---

## 7. Naming Conventions

### Tables
Use plural snake_case:

```txt
story_bibles
character_knowledge
chapter_deltas
ai_usage_logs
```

### API endpoints
Use kebab-case:

```txt
/story-bible/generate
/publish-package
```

### TypeScript files
Use camelCase or domain names:

```txt
contextPacket.ts
modelRouter.ts
beatWriterAgent.ts
```

### Prompt versions
Use snake_case with version:

```txt
beat_writer_v1
story_bible_agent_v1
chapter_delta_extractor_v1
```

---

## 8. What Not to Do

Do not create:

```txt
apps/api/src/random/
apps/api/src/utils2/
apps/web/src/components/misc/
```

Do not put:
- OpenRouter calls in frontend.
- Supabase service role key in frontend.
- raw prompt logic spread across UI components.
- future full-feature logic directly inside MVP routes without service abstraction.

---

## 9. TODO

- TODO: update this file after route split.
- TODO: add actual UI page paths after frontend grows.
