import "dotenv/config";
import pino from "pino";
import { runMigrations } from "../db/index.js";
import { claimPendingWebhooks, deliverWebhookEvent } from "../services/webhooks.js";

const log = pino({ level: process.env.LOG_LEVEL || "info", name: "webhook-worker" });

const POLL_INTERVAL_MS = Number(process.env.WEBHOOK_WORKER_POLL_INTERVAL_MS ?? 5000);
const BATCH_SIZE = Number(process.env.WEBHOOK_WORKER_BATCH_SIZE ?? 20);

async function loop(): Promise<void> {
  if (!process.env.WEBHOOK_URL) {
    log.debug("WEBHOOK_URL not configured — retry worker idle");
  } else {
    const batch = await claimPendingWebhooks(BATCH_SIZE);
    if (batch.length > 0) {
      log.debug({ count: batch.length }, "delivering webhook batch");
      await Promise.all(
        batch.map(async (event) => {
          await deliverWebhookEvent(event);
          if (event.delivery_status === "pending") {
            log.info({ eventId: event.id, attempts: event.attempts + 1 }, "webhook delivery retried");
          }
        })
      );
    }
  }

  setTimeout(loop, POLL_INTERVAL_MS);
}

async function main(): Promise<void> {
  await runMigrations();
  log.info("webhook retry worker starting");
  loop();
}

main().catch((err) => {
  log.error({ err }, "webhook worker failed to start");
  process.exit(1);
});
