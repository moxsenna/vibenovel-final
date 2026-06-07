import type { Hono } from "hono";
import type { CreditBalance, UserProfile } from "@vibenovel/shared";
import { authMiddleware } from "../middleware/auth.js";
import { jsonSuccess } from "../response.js";
import { getCreditBalanceForUser } from "../services/credit.js";
import { getOrCreateProfileForAuthUser } from "../services/profile.js";
import type { AppEnv } from "../types.js";

export interface MeResponseData {
  user: {
    id: string;
    email: string;
  };
  profile: UserProfile;
  creditBalance: CreditBalance | null;
}

export function registerMeRoutes(app: Hono<AppEnv>): void {
  app.get("/api/me", authMiddleware, async (c) => {
    const user = c.get("authUser");
    const profile = await getOrCreateProfileForAuthUser(c.env, user);
    const creditBalance = await getCreditBalanceForUser(c.env, user.id);

    const body: MeResponseData = {
      user: {
        id: user.id,
        email: user.email ?? c.get("email"),
      },
      profile,
      creditBalance,
    };

    return jsonSuccess(c, body);
  });
}