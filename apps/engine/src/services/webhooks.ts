import crypto from "node:crypto";
import { nanoid } from "nanoid";
import { execute } from "../db/index.js";

export type WebhookEventType = "tx.sent" | "tx.mined" | "tx.reverted" | "tx.errored";

function sign(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Records the event for audit/replay, then attempts immediate delivery if a
 * WEBHOOK_URL is configured. Delivery failures are logged but never throw.
 */
export async function fireWebhook(
  transactionId: string,
  eventType: WebhookEventType,
  payload: Record<string, unknown>
): Promise<void> {
  const id = nanoid();
  const body = JSON.stringify({ event: eventType, transactionId, ...payload, timestamp: Date.now() });

  await execute(
    `INSERT INTO webhook_events (id, transaction_id, event_type, payload) VALUES ($1, $2, $3, $4)`,
    [id, transactionId, eventType, body]
  );

  const url = process.env.WEBHOOK_URL;
  if (!url) return;

  const secret = process.env.WEBHOOK_SECRET || "";

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Engine-Signature": sign(body, secret),
      },
      body,
    });

    await execute(
      `UPDATE webhook_events SET delivered = $1, attempts = attempts + 1 WHERE id = $2`,
      [res.ok ? 1 : 0, id]
    );
  } catch {
    await execute(`UPDATE webhook_events SET attempts = attempts + 1 WHERE id = $1`, [id]);
  }
}
