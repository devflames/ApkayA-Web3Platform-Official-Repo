import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NonceManager } from "./nonceManager.js";

class MockNonceProvider {
  constructor(private pendingCount: number) {}

  async getTransactionCount(_address: string, blockTag?: string): Promise<number> {
    void blockTag;
    return this.pendingCount;
  }

  setPendingCount(count: number): void {
    this.pendingCount = count;
  }
}

describe("NonceManager", () => {
  it("assigns 10 distinct sequential nonces for 10 concurrent sends from the same wallet", async () => {
    const provider = new MockNonceProvider(5);
    const manager = new NonceManager(() => provider, 0);

    const address = "0x1111111111111111111111111111111111111111";
    const chainId = 80002;

    const nonces = await Promise.all(
      Array.from({ length: 10 }, () => manager.acquireNonce(chainId, address))
    );

    const sorted = [...nonces].sort((a, b) => a - b);
    assert.deepEqual(sorted, [5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    assert.equal(new Set(nonces).size, 10);

    manager.stop();
  });

  it("releases a nonce on broadcast failure so it can be reused", async () => {
    const provider = new MockNonceProvider(3);
    const manager = new NonceManager(() => provider, 0);
    const address = "0x2222222222222222222222222222222222222222";
    const chainId = 1;

    const first = await manager.acquireNonce(chainId, address);
    assert.equal(first, 3);

    manager.releaseNonce(chainId, address);
    const retry = await manager.acquireNonce(chainId, address);
    assert.equal(retry, 3);

    manager.stop();
  });

  it("reconciles upward when the chain pending count advances", async () => {
    const provider = new MockNonceProvider(10);
    const manager = new NonceManager(() => provider, 0);
    const address = "0x3333333333333333333333333333333333333333";
    const chainId = 1;

    await manager.acquireNonce(chainId, address);
    provider.setPendingCount(12);
    await manager.reconcile(chainId, address);

    const next = await manager.acquireNonce(chainId, address);
    assert.equal(next, 12);

    manager.stop();
  });
});
