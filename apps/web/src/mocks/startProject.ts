import {
  resolveDemoStartProjectRoute,
  START_PROJECT_OPTIONS,
  type StartProjectOptionDef,
} from "@/config/startProjectOptions";

/** @deprecated Use StartProjectOptionDef from config/startProjectOptions */
export type StartProjectOption = StartProjectOptionDef & { to: string };

/** Sprint 1 typed mock — demo routes only (production uses StartProjectPage API flow). */
export const mockStartProjectOptions: StartProjectOption[] = START_PROJECT_OPTIONS.map(
  (option) => ({
    ...option,
    to: resolveDemoStartProjectRoute(option.target),
  }),
);