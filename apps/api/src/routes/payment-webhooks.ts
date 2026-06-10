import type { Hono } from "hono";
import { AppError } from "../errors.js";
import { jsonSuccess } from "../response.js";
import { processDuitkuPaymentCallback } from "../services/process-duitku-payment-callback.js";
import { processMayarPaymentWebhook } from "../services/process-mayar-payment-webhook.js";
import type { AppEnv } from "../types.js";

export function registerPaymentWebhookRoutes(app: Hono<AppEnv>): void {
  app.post("/api/payments/mayar/webhook", async (c) => {
    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      throw AppError.badRequest("Invalid JSON body");
    }

    const result = await processMayarPaymentWebhook(c.env, rawBody);

    return jsonSuccess(c, {
      ok: result.ok,
      duplicate: result.duplicate,
      granted: result.granted,
      alreadyGranted: result.alreadyGranted,
      ignored: result.ignored,
      failed: result.failed,
      orderId: result.orderId,
      reason: result.reason,
      webhookEventId: result.webhookEventId,
    });
  });

  app.post("/api/payments/duitku/callback", async (c) => {
    const result = await processDuitkuPaymentCallback(c.env, c.req.raw);

    return jsonSuccess(c, {
      ok: result.ok,
      duplicate: result.duplicate,
      granted: result.granted,
      alreadyGranted: result.alreadyGranted,
      ignored: result.ignored,
      failed: result.failed,
      orderId: result.orderId,
      reason: result.reason,
      webhookEventId: result.webhookEventId,
    });
  });
}