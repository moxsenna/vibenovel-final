import type { OperationalStyleRules } from "../style-profile.js";
import { DEFAULT_STYLE_RULES } from "../style-profile.js";

export function extractOperationalRules(): OperationalStyleRules {
  return { ...DEFAULT_STYLE_RULES };
}
