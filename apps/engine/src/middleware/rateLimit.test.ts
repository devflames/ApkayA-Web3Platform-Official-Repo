import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import type { Request, Response } from "express";
import { rateLimitByApiKey, resetRateLimitBucketsForTests } from "./rateLimit.js";

function mockReq(apiKeyId?: string, rateLimitPerMinute?: number | null): Request {
  return {
    apiKeyId,
    apiKeyRateLimitPerMinute: rateLimitPerMinute,
    ip: "127.0.0.1",
    socket: { remoteAddress: "127.0.0.1" },
  } as Request;
}

function mockRes(): Response & { statusCode?: number; body?: unknown } {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as Response & { statusCode?: number; body?: unknown };
}

describe("rateLimitByApiKey", () => {
  beforeEach(() => {
    process.env.DEFAULT_API_KEY_RATE_LIMIT_PER_MINUTE = "3";
    resetRateLimitBucketsForTests();
  });

  it("returns 429 after exceeding the per-key limit", () => {
    const req = mockReq("key_test", 3);
    const calls: number[] = [];

    for (let i = 0; i < 4; i++) {
      const res = mockRes();
      let nextCalled = false;
      rateLimitByApiKey(req, res, () => {
        nextCalled = true;
      });
      calls.push(nextCalled ? 1 : 0);
    }

    assert.deepEqual(calls, [1, 1, 1, 0]);
  });

  it("uses per-key override when set on the request", () => {
    const req = mockReq("key_vip", 10);
    for (let i = 0; i < 10; i++) {
      const res = mockRes();
      let allowed = false;
      rateLimitByApiKey(req, res, () => {
        allowed = true;
      });
      assert.equal(allowed, true);
    }

    const blocked = mockRes();
    let blockedNext = false;
    rateLimitByApiKey(req, blocked, () => {
      blockedNext = true;
    });
    assert.equal(blockedNext, false);
    assert.equal(blocked.statusCode, 429);
  });
});
