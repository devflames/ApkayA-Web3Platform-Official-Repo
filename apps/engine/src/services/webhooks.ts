import crypto from "node:crypto";
import { nanoid } from "nanoid";
import { execute, query, queryOne } from "../db/index.js";
import { serializeRow, serializeRows } from "../db/serialize.js";

export type WebhookEventType = "tx.sent" | "tx.mined" | "tx.reverted" | "tx.errored";
export type WebhookDeliveryStatus = "pending" | "delivered" | "dead";

/** Backoff after failed attempts 1–5: 5s, 30s, 2m, 10m, 1h. Attempt 6+ marks dead. */
export const WEBHOOK_RETRY_DELAYS_MS = [5_000, 30_000, 120_000, 600_000, 3_600_000] as const;
export const WEBHOOK_MAX_ATTEMPTS = WEBHOOK_RETRY_DELAYS_MS.length + 1;

export interface WebhookEventRecord {
  id: string;
  transaction_id: string;
  event_type: string;
  payload: string;
  delivered: number;
  attempts: number;
  created_at: string;
  next_attempt_at: string | null;
  last_error: string | null;
  delivery_status: WebhookDeliveryStatus;
}

function sign(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export function nextRetryDelayMs(attemptsAfterFailure: number): number | null {
  const index = attemptsAfterFailure - 1;
  if (index < 0 || index >= WEBHOOK_RETRY_DELAYS_MS.length) return null;
  return WEBHOOK_RETRY_DELAYS_MS[index];
}

/**
 * Records a webhook event and attempts immediate delivery when WEBHOOK_URL is set.
 * Failures are scheduled for retry by the webhook worker.
 */
export async function fireWebhook(
  transactionId: string,
  eventType: WebhookEventType,
  payload: Record<string, unknown>
): Promise<void> {
  const id = nanoid();
  const body = JSON.stringify({ event: eventType, transactionId, ...payload, timestamp: Date.now() });

  await execute(
    `INSERT INTO webhook_events
      (id, transaction_id, event_type, payload, delivery_status, next_attempt_at)
     VALUES ($1, $2, $3, $4, 'pending', NOW())`,
    [id, transactionId, eventType, body]
  );

  if (!process.env.WEBHOOK_URL) return;

  const event = await getWebhookEvent(id);
  if (event) await deliverWebhookEvent(event);
}

export async function getWebhookEvent(id: string): Promise<WebhookEventRecord | undefined> {
  const row = await queryOne<WebhookEventRecord>(
    `SELECT * FROM webhook_events WHERE id = $1`,
    [id]
  );
  return row ? serializeRow(row) : undefined;
}

/** Returns pending events whose next_attempt_at has elapsed. */
export async function claimPendingWebhooks(limit: number): Promise<WebhookEventRecord[]> {
  const rows = await query<WebhookEventRecord>(
    `SELECT * FROM webhook_events
     WHERE delivery_status = 'pending'
       AND (next_attempt_at IS NULL OR next_attempt_at <= NOW())
     ORDER BY next_attempt_at ASC NULLS FIRST, created_at ASC
     LIMIT $1`,
    [limit]
  );
  return serializeRows(rows);
}

export async function deliverWebhookEvent(event: WebhookEventRecord): Promise<void> {
  const url = process.env.WEBHOOK_URL;
  if (!url) return;

  const secret = process.env.WEBHOOK_SECRET || "";

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Engine-Signature": sign(event.payload, secret),
      },
      body: event.payload,
    });

    if (res.ok) {
      await execute(
        `UPDATE webhook_events
         SET delivered = 1, delivery_status = 'delivered', attempts = attempts + 1,
             next_attempt_at = NULL, last_error = NULL
         WHERE id = $1`,
        [event.id]
      );
      return;
    }

    await recordWebhookFailure(event.id, event.attempts + 1, `HTTP ${res.status} ${res.statusText}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await recordWebhookFailure(event.id, event.attempts + 1, message);
  }
}

async function recordWebhookFailure(id: string, newAttempts: number, error: string): Promise<void> {
  const delayMs = nextRetryDelayMs(newAttempts);

  if (delayMs === null || newAttempts >= WEBHOOK_MAX_ATTEMPTS) {
    await execute(
      `UPDATE webhook_events
       SET attempts = $1, delivery_status = 'dead', last_error = $2, next_attempt_at = NULL
       WHERE id = $3`,
      [newAttempts, error, id]
    );
    return;
  }

  await execute(
    `UPDATE webhook_events
     SET attempts = $1, delivered = 0, last_error = $2,
         next_attempt_at = NOW() + ($3 * interval '1 millisecond')
     WHERE id = $4`,
    [newAttempts, error, delayMs, id]
  );
}
