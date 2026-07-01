import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  WEBHOOK_MAX_ATTEMPTS,
  WEBHOOK_RETRY_DELAYS_MS,
  nextRetryDelayMs,
} from "./webhooks.js";

describe("webhook retry backoff", () => {
  it("uses 5s, 30s, 2m, 10m, 1h delays after consecutive failures", () => {
    assert.deepEqual([...WEBHOOK_RETRY_DELAYS_MS], [5_000, 30_000, 120_000, 600_000, 3_600_000]);
    assert.equal(nextRetryDelayMs(1), 5_000);
    assert.equal(nextRetryDelayMs(2), 30_000);
    assert.equal(nextRetryDelayMs(3), 120_000);
    assert.equal(nextRetryDelayMs(4), 600_000);
    assert.equal(nextRetryDelayMs(5), 3_600_000);
    assert.equal(nextRetryDelayMs(6), null);
  });

  it("allows six total delivery attempts before dead", () => {
    assert.equal(WEBHOOK_MAX_ATTEMPTS, 6);
  });
});
