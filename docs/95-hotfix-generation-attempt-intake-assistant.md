# Technical Report: Hotfix — Fix Failed to Create Generation Attempt in Intake Assistant (Task 10.31a-hotfix)

## 1. Root Cause Analysis
The intake assistant and concept generator API endpoints failed with `Failed to create generation attempt` when triggered from the production browser. 

The error originated from a database constraint mismatch:
* The `generation_attempts` table schema (migration `00008_sprint8_ai_generation_credit.sql`) specifies:
  ```sql
  chapter_outline_id uuid REFERENCES public.chapter_outlines (id) ON DELETE SET NULL
  ```
* During the intake and concept phases, the project does not have any generated chapters or outline plans yet.
* The API code previously attempted to bypass the TypeScript required field check by inserting a dummy UUID placeholder:
  ```typescript
  chapterOutlineId: "00000000-0000-0000-0000-000000000000"
  ```
* The database engine rejected this value because the UUID did not exist in the referenced `chapter_outlines` table, raising a foreign key constraint violation (`23503`).

## 2. Before/After Payload Shapes

### Before
```json
{
  "project_id": "test-project-uuid",
  "user_id": "user-uuid",
  "chapter_outline_id": "00000000-0000-0000-0000-000000000000", // VIOLATES FOREIGN KEY
  "generation_type": "publish_copy",
  "status": "pending",
  "credit_cost": 1,
  "metadata": {
    "actualGenerationType": "intake_assistant"
  }
}
```

### After
```json
{
  "project_id": "test-project-uuid",
  "user_id": "user-uuid",
  "chapter_outline_id": null, // SECURELY NULLABLE
  "generation_type": "publish_copy",
  "status": "pending",
  "credit_cost": 1,
  "metadata": {
    "actualGenerationType": "intake_assistant"
  }
}
```

## 3. Resolving Type Definitions & Logic
1. **Interface Correction:** Relaxed the `CreateGenerationAttemptInput` typescript type definition in [generation-attempt.ts](file:///d:/Coding/vibenovel-unified-blueprint/apps/api/src/services/generation-attempt.ts) to mark `chapterOutlineId` as optional:
   ```typescript
   chapterOutlineId?: string | null;
   ```
2. **Database Insert Mapping:** Updated the insert block to fall back to `null` if the property is omitted:
   ```typescript
   chapter_outline_id: input.chapterOutlineId ?? null
   ```
3. **API Callers Refactoring:** Removed `chapterOutlineId` arguments from [intake.ts](file:///d:/Coding/vibenovel-unified-blueprint/apps/api/src/services/intake.ts) and [concept.ts](file:///d:/Coding/vibenovel-unified-blueprint/apps/api/src/services/concept.ts) calls.
4. **Verbose Logging:** Modified the error logging in `createGenerationAttempt` to output the exact database error, preventing silent failures:
   ```typescript
   console.error("generation_attempts insert failed:", error);
   ```

## 4. Verification & Regression Results
* **Typecheck:** Passed cleanly.
* **E2E Tests:** Passed mock-mode runs and verified skip conditions for OpenRouter integration.
* **Production Deploy:** Successful Docker compilation and image push to EC2; healthy status returned from the live backend.
