import type { AppBindings } from "./env.js";
import type { AuthVariables } from "./middleware/auth.js";

export type AppEnv = {
  Bindings: AppBindings;
  Variables: AuthVariables;
};