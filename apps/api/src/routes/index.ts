import type { Hono } from "hono";
import type { AppEnv } from "../types.js";
import { registerHealthRoutes } from "./health.js";
import { registerMeRoutes } from "./me.js";
import { registerProjectRoutes } from "./projects.js";
import { registerProjectSettingsRoutes } from "./project-settings.js";
import { registerFoundationRoutes } from "./foundation.js";
import { registerCharacterRoutes } from "./characters.js";
import { registerFactRoutes } from "./facts.js";
import { registerSpeechRuleRoutes } from "./speech-rules.js";
import { registerAiProposalRoutes } from "./ai-proposals.js";
import { registerCreditRoutes } from "./credits.js";
import { registerIntakeRoutes } from "./intake.js";
import { registerConceptRoutes } from "./concepts.js";
import { registerOutlineRoutes } from "./outline.js";
import { registerWriteRoutes } from "./write.js";
import { registerSummaryRoutes } from "./summary.js";
import { registerPublishRoutes } from "./publish.js";
import { registerAiRoutes } from "./ai.js";

export function registerRoutes(app: Hono<AppEnv>): void {
  registerHealthRoutes(app);
  registerMeRoutes(app);
  registerProjectRoutes(app);
  registerProjectSettingsRoutes(app);
  registerFoundationRoutes(app);
  registerCharacterRoutes(app);
  registerFactRoutes(app);
  registerSpeechRuleRoutes(app);
  registerAiProposalRoutes(app);
  registerCreditRoutes(app);
  registerIntakeRoutes(app);
  registerConceptRoutes(app);
  registerOutlineRoutes(app);
  registerWriteRoutes(app);
  registerSummaryRoutes(app);
  registerPublishRoutes(app);
  registerAiRoutes(app);
}