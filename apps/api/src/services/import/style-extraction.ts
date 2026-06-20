import type { OperationalStyleRules } from "../style-profile.js";
import { DEFAULT_STYLE_RULES } from "../style-profile.js";

export function extractOperationalRules(prose: string): OperationalStyleRules {
  return { ...DEFAULT_STYLE_RULES };
}
