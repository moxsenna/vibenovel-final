import type { Hono } from "hono";
import type { CreditBalance } from "@vibenovel/shared";
import { authMiddleware } from "../middleware/auth.js";
import { jsonSuccess } from "../response.js";
import { getCreditBalanceForUser } from "../services/credit.js";
import type { AppEnv } from "../types.js";

export interface CreditBalanceResponseData {
  creditBalance: CreditBalance | null;
}

export function registerCreditRoutes(app: Hono<AppEnv>): void {
  app.get("/api/credits/balance", authMiddleware, async (c) => {
    const userId = c.get("userId");
    const creditBalance = await getCreditBalanceForUser(c.env, userId);

    const body: CreditBalanceResponseData = { creditBalance };
    return jsonSuccess(c, body);
  });
}